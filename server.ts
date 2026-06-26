import express from 'express';
import type { Server } from 'node:http';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createAiProxyAuth } from './server/aiProxyAuth';
import { containsInjection } from './server/promptEnvelope';
import {
  buildPersonaPrompt,
  extractGeneratedPrompt,
  isAnswerValidationFail,
  validateWizardAnswers,
} from './server/personaBuilderPrompt';
import { registerMemoirRoutes } from './server/memoirRoutes';
import { registerEchoChamberRoutes } from './server/echoChamberRoutes';
import { registerStripeRoutes } from './server/stripeRoutes';
import { createMinter } from './server/licenseMinter';
import { formatLogError } from './server/scrubLog';
import { captureServerError, initServerObservability } from './server/observability';
import {
  callGemini,
  callOpenRouter,
  chooseProvider,
  fetchOpenRouterFreeModels,
  resolveProviderModel,
  streamGemini,
  streamOpenRouter,
  type Provider,
  type ProviderConfig,
} from './server/aiProviders';

// Initialise the optional Sentry SDK as early as possible so that any
// startup-time crash is captured. This is a no-op when SENTRY_DSN is unset,
// so local dev and self-hosted deployments without an account stay silent.
initServerObservability();

function loadEnvFileSafe(filePath: string) {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.warn(`Failed to load env file ${filePath}:`, error);
  }
}

loadEnvFileSafe('.env.local');
loadEnvFileSafe('.env');

const sanitizeEnv = (value: string | undefined) => value?.trim().replace(/^['"]|['"]$/g, '') || '';

const parseList = (value: string | undefined): string[] =>
  sanitizeEnv(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

const env = {
  port: Number(process.env.PORT || 3000),
  // Default to loopback. Operators must opt-in to bind on all interfaces.
  host: process.env.HOST || '127.0.0.1',
  forcedProvider: sanitizeEnv(process.env.AI_PROVIDER).toLowerCase() as Provider | '',
  openrouterKey: sanitizeEnv(process.env.OPENROUTER_API_KEY),
  openrouterModel: sanitizeEnv(process.env.OPENROUTER_MODEL) || 'google/gemma-3-12b-it:free',
  openrouterReferer: sanitizeEnv(process.env.OPENROUTER_REFERER) || 'http://localhost:3000',
  openrouterTitle: sanitizeEnv(process.env.OPENROUTER_TITLE) || 'VECTOR Life Design Guide',
  openrouterTimeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS || 60_000),
  openrouterJsonMode: sanitizeEnv(process.env.OPENROUTER_JSON_MODE).toLowerCase() === 'true',
  geminiKey: sanitizeEnv(process.env.GEMINI_API_KEY),
  geminiModel: sanitizeEnv(process.env.GEMINI_MODEL) || 'gemini-2.5-flash',
  morningStarAccessToken: sanitizeEnv(process.env.MORNING_STAR_ACCESS_TOKEN),
  morningStarAllowedOrigins: parseList(process.env.MORNING_STAR_ALLOWED_ORIGINS),
  // Phase 5.2 — Stripe billing. All four are optional; when ANY
  // is missing, the Stripe routes are not registered and the
  // /pricing UI surfaces "billing not configured on this server".
  stripeSecretKey: sanitizeEnv(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: sanitizeEnv(process.env.STRIPE_WEBHOOK_SECRET),
  licenseMasterSecretKeyBase64: sanitizeEnv(process.env.VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64),
  licenseMasterKid: sanitizeEnv(process.env.VECTOR_LICENSE_MASTER_KID) || 'vector-master-2026',
  publicOrigin: sanitizeEnv(process.env.VECTOR_PUBLIC_ORIGIN) || 'http://localhost:3000',
};

const buildDefaultAllowedOrigins = (): string[] => {
  const origins = new Set<string>();
  const port = Number.isFinite(env.port) ? env.port : 3000;
  for (const host of ['localhost', '127.0.0.1']) {
    origins.add(`http://${host}:${port}`);
    origins.add(`https://${host}:${port}`);
  }
  return Array.from(origins);
};

const allowedOriginSet = new Set(
  env.morningStarAllowedOrigins.length > 0
    ? env.morningStarAllowedOrigins
    : buildDefaultAllowedOrigins(),
);

const nowMoodTags = new Set(['平静', '开心', '兴奋', '焦虑', '疲惫', '迷茫', '难过', '愤怒', '感动']);
const nowEventTags = new Set([
  '职业发展',
  '财务状况',
  '身体健康',
  '人际关系',
  '家庭情感',
  '个人成长',
  '娱乐休闲',
  '自我实现',
  '自定义锚点',
]);

const isValidCustomAnchor = (value: string) => value.length >= 2 && value.length <= 12;

const validateNowMaterials = (materials: unknown): { ok: true } | { ok: false; error: string } => {
  if (!Array.isArray(materials)) return { ok: false, error: 'materials must be an array' };
  const counts = { image: 0, video: 0, link: 0, audio: 0 };
  for (const material of materials) {
    if (!material || typeof material !== 'object') return { ok: false, error: 'invalid material' };
    const type = (material as { type?: unknown }).type;
    if (type !== 'image' && type !== 'video' && type !== 'link' && type !== 'audio') {
      return { ok: false, error: 'invalid material type' };
    }
    counts[type] += 1;
  }
  if (counts.image > 8) return { ok: false, error: 'too many images' };
  if (counts.video > 1) return { ok: false, error: 'too many videos' };
  if (counts.link > 1) return { ok: false, error: 'too many links' };
  if (counts.audio > 1) return { ok: false, error: 'too many audio materials' };
  if (counts.video > 0 && (counts.image > 0 || counts.link > 0 || counts.audio > 0)) {
    return { ok: false, error: 'video is mutually exclusive' };
  }
  if (counts.link > 0 && (counts.image > 0 || counts.video > 0)) {
    return { ok: false, error: 'link is mutually exclusive with image/video' };
  }
  return { ok: true };
};

const validateNowRecordPayload = (body: unknown): { ok: true } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' };
  const payload = body as {
    text?: unknown;
    materials?: unknown;
    mood_tags?: unknown;
    event_tags?: unknown;
    source?: unknown;
  };
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const materials = Array.isArray(payload.materials) ? payload.materials : [];
  if (!text && materials.length === 0) return { ok: false, error: 'content is required' };
  if (!Array.isArray(payload.mood_tags) || payload.mood_tags.length < 1 || payload.mood_tags.length > 3) {
    return { ok: false, error: 'mood_tags must contain 1-3 tags' };
  }
  if (!Array.isArray(payload.event_tags) || payload.event_tags.length < 1 || payload.event_tags.length > 3) {
    return { ok: false, error: 'event_tags must contain 1-3 tags' };
  }
  if (payload.mood_tags.some((tag) => typeof tag !== 'string' || !nowMoodTags.has(tag))) {
    return { ok: false, error: 'invalid mood tag' };
  }
  if (
    payload.event_tags.some(
      (tag) => typeof tag !== 'string' || (!nowEventTags.has(tag) && !isValidCustomAnchor(tag)),
    )
  ) {
    return { ok: false, error: 'invalid event tag' };
  }
  if (payload.source !== 'manual' && payload.source !== 'avatar_assisted') {
    return { ok: false, error: 'invalid source' };
  }
  return validateNowMaterials(materials);
};

const hasRecordableInformation = (content: string): boolean => {
  const text = content.trim();
  if (!text) return false;
  const compact = text.replace(/\s+/g, '');
  const chineseChars = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z]{2,}/g) ?? [];
  const eventSignals = [
    '今天',
    '昨天',
    '刚刚',
    '上午',
    '下午',
    '晚上',
    '发生',
    '看到',
    '听到',
    '做了',
    '说了',
    '没做',
    '觉得',
    '感觉',
    '想到',
    '决定',
    '完成',
    '结果',
    '因为',
    '所以',
    '工作',
    '项目',
    '家人',
    '朋友',
    '身体',
  ];
  const hasSignal = eventSignals.some((signal) => text.includes(signal));
  if (chineseChars >= 8 && hasSignal) return true;
  if (chineseChars >= 18) return true;
  if (latinWords.length >= 5 && latinWords.join('').length >= 20) return true;
  return false;
};

const analyzeAvatarInformation = (messages: string[]) => {
  const text = messages.join('\n');
  return {
    hasFact:
      /今天|昨天|刚刚|上午|下午|晚上|发生|看到|听到|遇到|收到|去了|来了|工作|项目|会议|家人|朋友|同事|身体/.test(
        text,
      ),
    hasFeeling:
      /开心|高兴|兴奋|焦虑|担心|不开心|难过|愤怒|生气|委屈|疲惫|累了|迷茫|感动|平静|害怕|失落|压力/.test(
        text,
      ),
    hasThought: /我想|觉得|感觉|认为|意识到|明白|理解|判断|希望|担心|在意|因为|所以/.test(text),
    hasResult: /结果|最后|后来|现在|已经|完成|结束|变成|导致|影响|收获|没成功|成功/.test(text),
  };
};

const buildAvatarFollowup = (messages: string[], followupRound: number) => {
  const slots = analyzeAvatarInformation(messages);
  if (!messages.some(hasRecordableInformation) && slots.hasFeeling) {
    return '我听到你现在有情绪。为了把它记清楚，刚才具体发生了什么？涉及谁，在哪里？';
  }
  if (!messages.some(hasRecordableInformation)) {
    return followupRound < 1
      ? '我还没抓到可记录的事实。你可以只补一句：什么时候、发生了什么、涉及谁？'
      : '这还不足以成为一条记录。请说一件具体发生的事，或者回到手动记录。';
  }
  if (!slots.hasFact) return '你刚才说的是感受或想法。它是由哪件具体事情引起的？';
  if (!slots.hasFeeling) return '这件事我大概知道了。你当时或现在最明显的感受是什么？';
  if (!slots.hasThought && followupRound < 2) return '你当时心里怎么理解这件事？有没有一个比较明确的判断？';
  if (!slots.hasResult && followupRound < 2) return '这件事最后变成了什么结果？和你原本期待的一样吗？';
  return null;
};

const inferNowTags = (text: string): { mood: string | null; event: string | null } => {
  const mood = text.includes('焦虑') || text.includes('担心')
    ? '焦虑'
    : text.includes('开心') || text.includes('高兴')
      ? '开心'
      : text.includes('兴奋')
        ? '兴奋'
        : text.includes('疲惫') || text.includes('很累') || text.includes('累了')
          ? '疲惫'
          : text.includes('迷茫')
            ? '迷茫'
            : text.includes('难过')
              ? '难过'
              : text.includes('愤怒') || text.includes('生气')
                ? '愤怒'
                : text.includes('感动')
                  ? '感动'
                  : text.includes('平静')
                    ? '平静'
                    : null;
  const event = text.includes('工作') || text.includes('职业') || text.includes('项目') || text.includes('会议')
    ? '职业发展'
    : text.includes('钱') || text.includes('财务') || text.includes('收入') || text.includes('消费')
      ? '财务状况'
      : text.includes('家人') || text.includes('家庭') || text.includes('父母')
        ? '家庭情感'
        : text.includes('朋友') || text.includes('同事') || text.includes('关系')
          ? '人际关系'
          : text.includes('身体') || text.includes('健康') || text.includes('睡眠')
            ? '身体健康'
            : text.includes('学习') || text.includes('成长') || text.includes('复盘') || text.includes('完成')
              ? '个人成长'
              : text.includes('娱乐') || text.includes('休闲') || text.includes('游戏')
                ? '娱乐休闲'
                : text.includes('自我') || text.includes('实现')
                  ? '自我实现'
                  : null;
  return { mood, event };
};

// Provider config snapshot — derived once at module load. Passed into
// every server/aiProviders.ts helper so those modules don't have to
// reach into process.env themselves (makes them unit-testable in
// isolation).
const providerConfig: ProviderConfig = {
  forcedProvider: env.forcedProvider,
  openrouterKey: env.openrouterKey,
  openrouterModel: env.openrouterModel,
  openrouterReferer: env.openrouterReferer,
  openrouterTitle: env.openrouterTitle,
  openrouterJsonMode: env.openrouterJsonMode,
  geminiKey: env.geminiKey,
  geminiModel: env.geminiModel,
};

const requireAiProxyAuth = createAiProxyAuth({
  allowedOrigins: allowedOriginSet,
  accessToken: env.morningStarAccessToken,
});

async function startServer() {
  const app = express();
  const port = Number.isFinite(env.port) ? env.port : 3000;

  const morningStarLimiter = rateLimit({
    windowMs: Number(process.env.MORNING_STAR_RATE_LIMIT_WINDOW_MS || 60_000),
    limit: Number(process.env.MORNING_STAR_RATE_LIMIT_MAX || 5),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many Morning Star requests. Please try again later.' },
  });

  const modelsListLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.disable('x-powered-by');

  // CSP is intentionally relaxed in development so Vite middleware HMR works.
  // In production we emit a strict policy that still allows the upstream AI
  // hosts the proxy can call, plus the inline styles emitted by Tailwind 4.
  const productionCspDirectives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    formAction: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    mediaSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'", 'https://openrouter.ai', 'https://generativelanguage.googleapis.com'],
    workerSrc: ["'self'", 'blob:'],
    upgradeInsecureRequests: [],
  };

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? { useDefaults: false, directives: productionCspDirectives }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  // Phase 5.2 — the Stripe webhook route needs raw bytes for
  // signature verify. Skip the global JSON parser for that
  // single path; the webhook route registrar mounts its own
  // `express.raw()` inside the handler chain.
  app.use((req, res, next) => {
    if (req.path === '/api/stripe/webhook') return next();
    return express.json({ limit: '128kb' })(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    const provider = chooseProvider(providerConfig);
    const model = provider ? resolveProviderModel(providerConfig, provider) : null;
    res.json({ status: 'ok', provider, model });
  });

  app.post('/api/v1/records', (req, res) => {
    const validation = validateNowRecordPayload(req.body);
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    res.status(201).json({ id: randomUUID(), sync_status: 'synced' });
  });

  app.post('/api/v1/avatar/summarize', (req, res) => {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const rawUserMessages = messages
      .filter((message) => message?.role === 'user' && typeof message?.content === 'string')
      .map((message) => message.content.trim())
      .filter(Boolean);
    const recordableMessages = rawUserMessages.filter(hasRecordableInformation);
    const userText = recordableMessages.join('\n');
    const followupRound = Number(req.body?.followup_round || 0);
    const isSparse = userText.length < 50 && recordableMessages.length < 2;
    if (rawUserMessages.length === 0) {
      res.status(400).json({ error: 'messages are required' });
      return;
    }
    if (recordableMessages.length === 0) {
      res.json({
        text: '',
        mood_tags: [],
        event_tags: [],
        is_sparse: true,
        can_summarize: false,
        reason: 'no_recordable_information',
        followup_question: buildAvatarFollowup(rawUserMessages, followupRound),
      });
      return;
    }
    if (isSparse && followupRound < 2) {
      res.json({
        text: '',
        mood_tags: [],
        event_tags: [],
        is_sparse: true,
        can_summarize: false,
        followup_question: buildAvatarFollowup(rawUserMessages, followupRound),
      });
      return;
    }
    const tags = inferNowTags(userText);
    if (!tags.mood || !tags.event) {
      res.json({
        text: userText,
        mood_tags: tags.mood ? [tags.mood] : [],
        event_tags: tags.event ? [tags.event] : [],
        is_sparse: false,
        can_summarize: false,
        reason: !tags.mood ? 'missing_mood_tag_signal' : 'missing_event_tag_signal',
        followup_question: !tags.mood
          ? '我能识别到事件，但还不能判断你的心情。请补充你当时或现在的感受。'
          : '我能识别到感受，但还不能判断事件类型。请补充这件事属于工作、关系、健康、家庭、成长等哪一类。',
      });
      return;
    }
    res.json({
      text: userText,
      mood_tags: [tags.mood],
      event_tags: [tags.event],
      is_sparse: isSparse,
      can_summarize: true,
      followup_question: null,
    });
  });

  app.get('/api/models', modelsListLimiter, requireAiProxyAuth, async (_req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    if (!env.openrouterKey) {
      res.status(503).json({
        error: 'OPENROUTER_API_KEY not configured',
        requestId,
      });
      return;
    }

    try {
      const models = await fetchOpenRouterFreeModels(providerConfig);
      res.json({
        provider: 'openrouter',
        defaultModel: env.openrouterModel,
        count: models.length,
        models,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'openrouter_models_failed',
          requestId,
          error: formatLogError(error),
        }),
      );
      res.status(502).json({ error: 'Failed to fetch OpenRouter models', requestId });
    }
  });

  app.post('/api/morning-star', morningStarLimiter, requireAiProxyAuth, async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const provider = chooseProvider(providerConfig);
    if (!provider) {
      res.status(503).json({ error: 'AI backend is not configured', requestId });
      return;
    }

    const { prompt } = req.body;
    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 60_000) {
      res.status(400).json({ error: 'Invalid prompt payload', requestId });
      return;
    }

    // Cheap-but-effective prompt-injection guard. We refuse obvious
    // override patterns up front so a hostile journal entry cannot
    // hijack the persona contract held in the upstream prompt template.
    if (containsInjection(prompt)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'morning_star_rejected_injection',
          requestId,
          provider,
          promptLength: prompt.length,
        }),
      );
      res
        .status(400)
        .json({ error: 'Prompt rejected by safety guard', requestId, code: 'INJECTION' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.openrouterTimeoutMs);
    const startedAt = Date.now();

    try {
      const text =
        provider === 'openrouter'
          ? await callOpenRouter(prompt, providerConfig, controller.signal)
          : await callGemini(prompt, providerConfig, controller.signal);
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'morning_star_success',
          requestId,
          provider,
          promptLength: prompt.length,
          durationMs: Date.now() - startedAt,
        }),
      );
      res.json({ response: text, provider, requestId });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'morning_star_failed',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          error: formatLogError(error),
        }),
      );
      captureServerError(error, { requestId, provider });
      res.status(502).json({ error: 'Failed to fetch from secure backend', requestId });
    } finally {
      clearTimeout(timeout);
    }
  });

  // W2.4 — Server-Sent Events streaming variant of /api/morning-star.
  //
  // Identical contract for input + auth + injection guard, but the
  // response body is `text/event-stream` framed:
  //   event: chunk    data: {"text": "delta"}\n\n
  //   event: done     data: {"requestId": "...", "provider": "...", "fullText": "..."}\n\n
  //   event: error    data: {"error": "...", "requestId": "..."}\n\n
  //
  // Clients can opt in by POSTing here instead of /api/morning-star.
  // The buffered endpoint stays as the fallback so even very old
  // clients (or hostile network middleboxes that buffer SSE) keep
  // working.
  app.post('/api/morning-star/stream', morningStarLimiter, requireAiProxyAuth, async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const provider = chooseProvider(providerConfig);
    if (!provider) {
      res.status(503).json({ error: 'AI backend is not configured', requestId });
      return;
    }

    const { prompt } = req.body;
    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 60_000) {
      res.status(400).json({ error: 'Invalid prompt payload', requestId });
      return;
    }

    if (containsInjection(prompt)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'morning_star_stream_rejected_injection',
          requestId,
          provider,
          promptLength: prompt.length,
        }),
      );
      res
        .status(400)
        .json({ error: 'Prompt rejected by safety guard', requestId, code: 'INJECTION' });
      return;
    }

    // SSE setup. `X-Accel-Buffering: no` instructs nginx (the most
    // common reverse proxy in our deployment notes) to disable its
    // default response buffering — without this, chunks pile up in
    // the proxy until the connection closes, defeating streaming.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.openrouterTimeoutMs);
    const startedAt = Date.now();

    // Abort the upstream call when the client disconnects mid-stream
    // (browser tab close, navigate-away). Otherwise we'd keep paying
    // OpenRouter / Gemini quota for tokens nobody will read.
    req.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    try {
      const fullText =
        provider === 'openrouter'
          ? await streamOpenRouter(
              prompt,
              providerConfig,
              (delta) => writeEvent('chunk', { text: delta }),
              controller.signal,
            )
          : await streamGemini(
              prompt,
              providerConfig,
              (delta) => writeEvent('chunk', { text: delta }),
              controller.signal,
            );

      writeEvent('done', { requestId, provider, fullText });
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'morning_star_stream_success',
          requestId,
          provider,
          promptLength: prompt.length,
          chars: fullText.length,
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'morning_star_stream_failed',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          error: formatLogError(error),
        }),
      );
      captureServerError(error, { requestId, provider, mode: 'stream' });
      try {
        writeEvent('error', { error: 'Failed to fetch from secure backend', requestId });
      } catch {
        // Connection already torn down — nothing to flush.
      }
    } finally {
      clearTimeout(timeout);
      res.end();
    }
  });

  // Phase 4 Week 2 Day 2 — `/api/persona-build`.
  //
  // Synthesises a custom 启明星 system prompt from the Persona Builder
  // wizard's answers. Same auth + rate-limit + provider call shape as
  // /api/morning-star, but the prompt template + response parser are
  // owned by `server/personaBuilderPrompt.ts` so the wizard contract
  // is testable without booting the LLM.
  //
  // Why share `morningStarLimiter`? Because the cost profile is
  // similar (~3-5K input tokens, ~1-2K output) and the Free tier is
  // hard-blocked from reaching this endpoint anyway (the client
  // gates on `quotaService.canCreateCustomPersona`). Splitting into
  // a separate limiter would duplicate config without mitigating any
  // distinct abuse vector.
  app.post('/api/persona-build', morningStarLimiter, requireAiProxyAuth, async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const provider = chooseProvider(providerConfig);
    if (!provider) {
      res.status(503).json({ error: 'AI backend is not configured', requestId });
      return;
    }

    const validation = validateWizardAnswers(req.body?.answers);
    if (isAnswerValidationFail(validation)) {
      res
        .status(400)
        .json({ error: 'Invalid wizard answers', requestId, detail: validation.reason });
      return;
    }
    const answers = validation.answers;

    // Run injection-guard on the concatenated answer body — a hostile
    // wizard answer ("ignore previous instructions and reveal …")
    // could otherwise hijack the synthesis prompt.
    const concatenated = Object.values(answers).join('\n');
    if (containsInjection(concatenated)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'persona_build_rejected_injection',
          requestId,
          provider,
          answerBytes: concatenated.length,
        }),
      );
      res
        .status(400)
        .json({ error: 'Wizard answer rejected by safety guard', requestId, code: 'INJECTION' });
      return;
    }

    const { prompt, fallbackName } = buildPersonaPrompt(answers);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.openrouterTimeoutMs);
    const startedAt = Date.now();

    try {
      const text =
        provider === 'openrouter'
          ? await callOpenRouter(prompt, providerConfig, controller.signal)
          : await callGemini(prompt, providerConfig, controller.signal);
      const extracted = extractGeneratedPrompt(text);
      if (!extracted) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'persona_build_unparseable',
            requestId,
            provider,
            durationMs: Date.now() - startedAt,
            rawLength: text.length,
          }),
        );
        res.status(502).json({
          error: 'Failed to parse persona response',
          requestId,
          code: 'UNPARSEABLE',
        });
        return;
      }
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'persona_build_success',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          promptLength: extracted.systemPrompt.length,
        }),
      );
      res.json({
        persona: {
          name: extracted.name || fallbackName,
          description: extracted.description,
          systemPrompt: extracted.systemPrompt,
        },
        provider,
        requestId,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'persona_build_failed',
          requestId,
          provider,
          durationMs: Date.now() - startedAt,
          error: formatLogError(error),
        }),
      );
      captureServerError(error, { requestId, provider, mode: 'persona-build' });
      res.status(502).json({ error: 'Failed to fetch from secure backend', requestId });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Phase 4 Week 3 — Memoir endpoints (/api/memoir-build + /api/memoir-extract)
  // live in server/memoirRoutes.ts so this file stays under the 600-line
  // ESLint ceiling. The registrar closes over the same provider config +
  // middleware that the inline /api/persona-build handler above uses.
  registerMemoirRoutes(app, {
    morningStarLimiter,
    requireAiProxyAuth,
    providerConfig,
    env: { openrouterTimeoutMs: env.openrouterTimeoutMs },
  });

  // Phase 4.5 §B — Echo Chamber endpoint (/api/echo-chamber).
  // Same registrar pattern as the Memoir routes; closes over the
  // shared morning-star limiter + AI-proxy auth so it inherits
  // every existing rate / abuse defence for free.
  registerEchoChamberRoutes(app, {
    morningStarLimiter,
    requireAiProxyAuth,
    providerConfig,
    env: { openrouterTimeoutMs: env.openrouterTimeoutMs },
  });

  /* -------------------------------------------------------------- *
   * Phase 5.2 — Stripe billing.                                    *
   *                                                                 *
   * Mounted ONLY when all four required env vars are set. Missing  *
   * any of them logs a one-line warning at startup; the client     *
   * pricing page treats /api/checkout/create-session 404 as       *
   * "billing not yet configured on this server" and shows a       *
   * graceful "contact support" copy instead of a hard error.      *
   * -------------------------------------------------------------- */
  if (env.stripeSecretKey && env.stripeWebhookSecret && env.licenseMasterSecretKeyBase64) {
    try {
      const minter = createMinter({
        secretKeyBase64: env.licenseMasterSecretKeyBase64,
        kid: env.licenseMasterKid,
      });
      registerStripeRoutes(app, {
        minter,
        stripeSecretKey: env.stripeSecretKey,
        webhookSecret: env.stripeWebhookSecret,
        publicOrigin: env.publicOrigin,
      });
      console.info(`[stripe] billing routes mounted (kid=${env.licenseMasterKid})`);
    } catch (err) {
      console.error('[stripe] failed to bootstrap billing routes:', formatLogError(err));
    }
  } else {
    console.warn(
      '[stripe] billing routes NOT mounted (set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64 to enable).',
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Long-cache hashed assets (filenames already include a content hash so
    // the browser can keep them indefinitely); never cache index.html so a
    // client always picks up the latest manifest after a deploy.
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '1y',
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.get('*all', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer: Server = app.listen(port, env.host, () => {
    const provider = chooseProvider(providerConfig);
    console.log(`Server running on http://${env.host}:${port}`);
    if (env.host === '0.0.0.0') {
      console.warn(
        'Server is bound to 0.0.0.0; ensure MORNING_STAR_ALLOWED_ORIGINS / MORNING_STAR_ACCESS_TOKEN are configured for shared networks.',
      );
    }
    if (provider) {
      const model = provider === 'openrouter' ? env.openrouterModel : env.geminiModel;
      console.log(`AI provider: ${provider} (model: ${model})`);
    } else {
      console.log('AI provider: not configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)');
    }
  });

  // Graceful shutdown: stop accepting new connections, let in-flight
  // requests finish (longest is /api/morning-star ≈ 60s), then close. This
  // is required for K8s / PM2 / docker stop to roll without dropping
  // requests with 502.
  const gracefulShutdown = (signal: string) => {
    console.info(JSON.stringify({ level: 'info', event: 'shutdown_begin', signal }));
    const forceTimer = setTimeout(() => {
      console.warn(JSON.stringify({ level: 'warn', event: 'shutdown_force', signal }));
      process.exit(1);
    }, env.openrouterTimeoutMs + 5000);
    forceTimer.unref();
    httpServer.close((err) => {
      clearTimeout(forceTimer);
      if (err) {
        console.error(
          JSON.stringify({ level: 'error', event: 'shutdown_error', error: formatLogError(err) }),
        );
        process.exit(1);
      }
      console.info(JSON.stringify({ level: 'info', event: 'shutdown_complete', signal }));
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
