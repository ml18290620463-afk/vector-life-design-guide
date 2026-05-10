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
