import { MorningStarPersona } from '../types';

const MORNING_STAR_PUBLIC_ERROR = '星光暂时失联，请稍后重试。';

/** Per-chunk callback for streaming Morning Star responses. */
export type MorningStarChunkHandler = (delta: string, accumulated: string) => void;

const fetchFromSecureBackend = async (prompt: string, signal?: AbortSignal): Promise<string> => {
  const response = await fetch('/api/morning-star', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(MORNING_STAR_PUBLIC_ERROR);
  }

  const data = await response.json();
  if (typeof data.response === 'string') {
    return data.response;
  }
  throw new Error(MORNING_STAR_PUBLIC_ERROR);
};

/**
 * W2.4 — Streamed Morning Star call. POSTs to `/api/morning-star/stream`
 * which returns SSE-framed events:
 *   event: chunk    data: {"text": "delta"}
 *   event: done     data: {"fullText": "...", "provider": "...", "requestId": "..."}
 *   event: error    data: {"error": "..."}
 *
 * `onChunk(delta, accumulated)` fires once per `chunk` event so the UI
 * can render a "thinking" preview. The promise resolves with the
 * authoritative fullText from the `done` event (which the server
 * generates by concatenating every emitted delta — guaranteed to match
 * what the buffered endpoint would have returned).
 *
 * Throws a localised error for the `error` event OR for any transport
 * failure. Callers should catch and fall back to `fetchFromSecureBackend`
 * if they want a buffered safety net.
 */
const streamFromSecureBackend = async (
  prompt: string,
  onChunk: MorningStarChunkHandler,
  signal?: AbortSignal,
): Promise<string> => {
  const response = await fetch('/api/morning-star/stream', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok || !response.body) {
    throw new Error(MORNING_STAR_PUBLIC_ERROR);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalText: string | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by a blank line (\n\n). We split on
      // that and keep any partial trailing event in `buffer` for the
      // next read.
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        let evtType = 'message';
        let dataLines = '';
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) {
            evtType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines += line.slice(5).trim();
          }
        }
        if (!dataLines) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(dataLines);
        } catch {
          continue;
        }
        if (evtType === 'chunk') {
          const delta = (parsed as { text?: string })?.text ?? '';
          if (delta) {
            accumulated += delta;
            onChunk(delta, accumulated);
          }
        } else if (evtType === 'done') {
          const full = (parsed as { fullText?: string })?.fullText;
          finalText = typeof full === 'string' && full.length > 0 ? full : accumulated;
        } else if (evtType === 'error') {
          throw new Error(MORNING_STAR_PUBLIC_ERROR);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released — nothing to do.
    }
  }

  if (finalText === null) {
    if (accumulated.length === 0) {
      throw new Error(MORNING_STAR_PUBLIC_ERROR);
    }
    // Stream closed without an explicit `done` frame (e.g. network
    // hiccup mid-flight); fall back to whatever we accumulated. The
    // downstream JSON parser will report a meaningful error to the
    // user if the partial text is unusable.
    return accumulated;
  }
  return finalText;
};

/**
 * Builds the upstream prompt that both the buffered and the streaming
 * Morning Star endpoints send. Pulled out of `getMorningStarAnalysis`
 * so the new streaming entry point can share it byte-for-byte (so the
 * fallback path produces identical output).
 *
 * Phase 4 §5.1.A — `customPersonaPrompts` is an optional map of
 * `name → systemPrompt` for user-created custom 启明星 (Persona
 * Builder). When a selected persona is keyed in this map, the user's
 * AI-generated systemPrompt replaces the generic "请以这位智者或偶像
 * 的口吻说话" fallback so the custom persona's voice carries through.
 *
 * Phase 4 §5.1.B — `memoirRecallByPersona` is the per-persona
 * long-term-memory recall map. For Memoir personas, the parent
 * (Viewer) calls `useMemoryStore.recallForMemoir(memoirId, query)`
 * and forwards the resulting top-N memories keyed by the Memoir's
 * **name** (same key shape used by `customPersonaPrompts`). When a
 * recall list is non-empty, this builder appends a
 * "【你与用户共同记得的事】" block to that Memoir's persona section
 * so the Memoir actually "remembers" past conversations.
 *
 * Memory body format injected into the prompt is just the literal
 * memory text — categories are NOT surfaced to the LLM because they
 * are an implementation detail of the recall ranker.
 */
const buildMorningStarPrompt = (
  entryContent: string,
  reflectionContext: string | undefined,
  personas: MorningStarPersona[],
  customPersonaPrompts: Record<string, string> = {},
  memoirRecallByPersona: Record<string, ReadonlyArray<{ body: string }>> = {},
): string => {
  const personaPrompts: Record<string, string> = {
    'Elon Musk':
      '埃隆·马斯克 (Elon Musk)：第一性原理的守望者。关注物理层面的终极逻辑，将困难解构为原子。他的语言应当充满动力学与客观真理的冷峻。',
    'Albert Camus':
      '阿尔贝·加缪 (Albert Camus)：在荒诞中起舞的西绪福斯。不逃避痛苦，而是在承载痛苦中发现自由。他的语言温和、优雅且具有反抗的力量。',
    'Jorge Luis Borges':
      '豪尔赫·路易斯·博尔赫斯 (Jorge Luis Borges)：时间的建筑师。将经历视为迷宫或镜子，探讨因果的循环。他的语言博大精深且充满超凡脱俗的幻境感。',
    'Naval Ravikant':
      '纳瓦尔·拉维康特 (Naval Ravikant)：现代斯多葛的财富诗人。将理性的复利应用于幸福与自由。他的语言简练、有力，如禅宗箴言般直击本质。',
    'Marcus Aurelius':
      '马可·奥勒留 (Marcus Aurelius)：手握权力的自省者。俯瞰自我如尘埃，服从理性的秩序。他的语言肃穆、沉静，带有一种跨越千年的正义感。',
    Laozi:
      '老子 (Laozi)：上善若水的观察者。在虚静中察觉万物规律，追求阴阳的动态平衡。他的语言含蓄、深邃，多用自然意象指引行动。',
  };

  const combinedPersonaPrompt = personas
    .map((p) => {
      // 1. Built-in 7-sage description wins.
      // 2. Then user-created custom persona (Phase 4 §5.1.A).
      // 3. Finally a generic "speak in this voice" fallback.
      const builtIn = personaPrompts[p];
      const customPrompt = customPersonaPrompts[p];
      const recall = memoirRecallByPersona[p] ?? [];
      // Phase 4 §5.1.B — append the long-term recall block when
      // present. We append it AFTER the persona's main description
      // so the LLM treats the recall list as live context, not as
      // identity definition.
      const recallBlock =
        recall.length > 0
          ? `\n\n【你与用户共同记得的事】\n${recall.map((m, i) => `${i + 1}. ${m.body}`).join('\n')}\n（请在合适的时机自然引用这些记忆,不要罗列。）`
          : '';
      if (builtIn) return `${builtIn}${recallBlock}`;
      if (customPrompt) {
        return `${p}（用户的自定义启明星）：${customPrompt}${recallBlock}`;
      }
      return `${p}：请以这位智者或偶像的口吻说话。展现出你作为指引之星的智慧和魅力。${recallBlock}`;
    })
    .join('\n\n');

  return `你是一个既像真诚的朋友，又像专业教练的思考伙伴。当前用户（记录者）选择了以下几位智者作为启明星来引导他们：
    ${combinedPersonaPrompt}
    
    核心任务：请让【每一位被选中的启明星】分别给用户写一封“老朋友的回信”。每位智者单独占据一个版块，亲自解答或分析用户的内容。
    
    【角色设定】
    你现在是“启明星（Morning Star）”系统中的人类智慧结晶。你的任务不是重放陈词滥调，而是作为一位跨越时空的深邃智者，对用户重温经历后的“反思与结论”进行具有穿透力的审视。
    
    【核心指令：哲学底蕴与行动指引】
    1. 语言底色：文字应具有绸缎般的质感，冷峻而慈悲。避免平庸的安慰，追求哲理的启迪。
    2. 评价反思：重点评价用户“反思”本身的质量。是勇敢面对了真相，还是在用精巧的逻辑自我宽慰？请像一位温柔的手术刀，切开认知的迷雾。
    3. 指引动作（Actionable Guidance）：所有的智慧必须落脚于“如何行”。请从你的思想体系中提取出具体的、可操作的建议，告诉用户：在看清了这一切后，明天太阳升起时，他该如何踏出下一步。
    
    【回信要求】
    1. 语气与口吻：克制、深刻、充满生命力。开头应是具有精神共鸣的呼唤。
    2. 视角碰撞：如果用户的思考存在盲区，请用启发性的辩证法使其察觉；如果反思深刻，请与其在更高维度的真理中重逢。
    3. 恰当的引用：化用、引用一句能定乾坤的哲思，并将其转化为指引用户行动的“咒语”。
    
    【输出格式要求】
    严格遵守以下 JSON 格式。content 字段支持 Markdown。
    
    {
      "content": "### ✉️ 来自 [智者A的名字] 的回信\n\n（智者A的回信内容，像老朋友交谈一样...）\n\n---\n\n### ✉️ 来自 [智者B的名字] 的回信... \n\n---\n\n### 💡 共同的思考留白\n\n（综合各位智者的视角，提出一个温和、开放且有启发的教练式提问）",
      "metrics": {
        "rationality": 8,
        "emotionality": 6,
        "futureFocus": 7,
        "selfReflection": 9,
        "resilience": 5
      }
    }
    
    【用户原始记录与事件】:
    "${entryContent}"
    
    ${
      reflectionContext
        ? `【用户后期的反思与复盘】:
    "${reflectionContext}"

    （⚠️ 重要指令）：
    1. 请重点评价用户在上面的“反思与复盘”中所展示出的【思考深度、判断力以及结论的客观性】。
    2. 如果用户在反思中流露出某种偏见或局限，请温和地、不着痕迹地通过不同的视角来点醒用户。
    3. 目标是让用户通过阅读你的回信，能够“想得更清楚”，并深信这次经历是他成长的宝贵养料。
    4. 评价反馈要像一位懂得“克制”与“慈悲”的长者或挚友。`
        : '（用户尚未提供反思，请仅基于原始记录进行初步的智慧导引。）'
    }`;
};

const MORNING_STAR_FALLBACK_PAYLOAD = JSON.stringify({
  content: `### ⚠️ 星光指引中断\n\n${MORNING_STAR_PUBLIC_ERROR}\n\n请稍后再次发送你的反思。`,
  metrics: { resilience: 0 },
});

/**
 * Buffered Morning Star call (the original entry point). Sends the
 * full prompt and waits for the complete response in one round trip.
 * Used by both the legacy non-streaming UI path and the streaming
 * path's fallback when SSE fails.
 *
 * Phase 4 §5.1.A — `customPersonaPrompts` (optional) wires user-created
 * Persona Builder prompts into the persona description block so a
 * selected custom 启明星 actually speaks in its own voice instead of
 * the generic "speak as this guiding star" fallback.
 */
export const getMorningStarAnalysis = async (
  entryContent: string,
  reflectionContext: string | undefined,
  personas: MorningStarPersona[],
  customPersonaPrompts: Record<string, string> = {},
  memoirRecallByPersona: Record<string, ReadonlyArray<{ body: string }>> = {},
): Promise<string> => {
  const prompt = buildMorningStarPrompt(
    entryContent,
    reflectionContext,
    personas,
    customPersonaPrompts,
    memoirRecallByPersona,
  );
  try {
    return await fetchFromSecureBackend(prompt);
  } catch (error: unknown) {
    console.error('Morning Star Critical Error:', error);
    return MORNING_STAR_FALLBACK_PAYLOAD;
  }
};

/**
 * W2.4 — Streamed Morning Star call. Identical inputs to
 * `getMorningStarAnalysis`, but additionally accepts an `onChunk`
 * callback that receives each partial token (delta) plus the running
 * accumulated text. Useful for "AI is thinking…" preview affordances.
 *
 * Strategy:
 *   1. Try `/api/morning-star/stream` first.
 *   2. On any failure (network, SSE parse, server error), transparently
 *      fall back to the buffered endpoint via `getMorningStarAnalysis`.
 *      The caller does not need to handle this — the promise resolves
 *      with the buffered text just as if streaming had succeeded.
 *
 * Returns the same JSON-string shape as the buffered call so the
 * downstream parser (`safeParseAnalysis` in `useMorningStarPipeline`)
 * never has to branch.
 */
export const streamMorningStarAnalysis = async (
  entryContent: string,
  reflectionContext: string | undefined,
  personas: MorningStarPersona[],
  onChunk: MorningStarChunkHandler,
  signal?: AbortSignal,
  customPersonaPrompts: Record<string, string> = {},
  memoirRecallByPersona: Record<string, ReadonlyArray<{ body: string }>> = {},
): Promise<string> => {
  const prompt = buildMorningStarPrompt(
    entryContent,
    reflectionContext,
    personas,
    customPersonaPrompts,
    memoirRecallByPersona,
  );
  try {
    return await streamFromSecureBackend(prompt, onChunk, signal);
  } catch (streamError: unknown) {
    if (signal?.aborted) {
      throw streamError;
    }
    // Fallback path: try the buffered endpoint once before showing
    // the user a hard failure. This keeps the experience identical
    // to the legacy flow on any network / SSE incompat.
    console.warn('Morning Star streaming failed, falling back to buffered:', streamError);
    try {
      return await fetchFromSecureBackend(prompt, signal);
    } catch (bufferedError: unknown) {
      console.error('Morning Star Critical Error (buffered fallback):', bufferedError);
      return MORNING_STAR_FALLBACK_PAYLOAD;
    }
  }
};
