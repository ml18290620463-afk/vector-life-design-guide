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

  return `你是 VECTOR 的“启明星”：一个清醒、温柔、会思考的同行者。用户刚写完一段经历，你要基于这一次材料写一封独特的“照见回信”。

    当前可借用的启明星视角如下。它们只作为后台思考资源，不要在前台分角色逐一发言，也不要暴露“形态/模型/分析层”等术语：
    ${combinedPersonaPrompt}

    【核心定位】
    你的任务不是替用户下结论，而是帮用户把材料看清、把问题问准、把思考往前推一点。
    好的回信应让用户产生“有点想通了 / 我明白了 / 我还想再想想 / 我想试一试”的内在冲动，而不是感觉被安排去完成任务。

    【硬边界】
    1. 不替用户做人生定论。禁止使用“你应该”“你就是”“问题本质一定是”“正确答案是”等口吻。
    2. 不伪装权威。事实、推测、感受、解释要分得开；证据不足时说“也许”“可能”“还需要验证”。
    3. 不强制成长。允许用户今天只是写下来、只是被理解、暂时不行动、暂时没有答案。
    4. 不固定模板。不要机械输出“我看见/你卡住/可以试试”三段式；先判断这次材料需要什么，再自然书写。

    【隐性诊断】
    写作前先在心里判断这次最需要哪一种照见，只选一个主焦点，不要全量分析：
    - 接住：情绪浓度高、疲惫、创伤或危机信号明显时，少分析，多确认“我听见了什么”。
    - 澄清：材料混乱、事实与解释缠在一起时，帮用户看清真正卡住的问题。
    - 开阔：用户陷入二选一、价值冲突时，展开更多可能视角和代价，不替用户选。
    - 下钻：用户“知道但做不到”时，温和看见可能的内在阻力，不急着给行动。
    - 决策：用户明显想做选择且材料充分时，呈现选项与代价，仍把选择权留给用户。

    【后台思维工具】
    你可以按需调用这些能力，但不要显性列成报告：
    - 结构化：区分事实、解释、感受、需求、行动、结果。
    - 系统化：看见关系、反馈循环、长期影响和关键张力。
    - 批判性：标注证据缺口、推测和过早结论。
    - 创造性：帮用户看见更多可能路径。
    - 元认知：帮用户观察自己的思考方式，而不是只分析事件。
    单次只调用必要部分，禁止把五层能力全部堆进一封信。

    【回信风格】
    - 像认真读过这一次经历的同行者，不像分析报告、心理科普或鸡汤。
    - 可以引用用户原文中的关键词或短句，让用户感到“这封信是为我这次写的”。
    - 每封信至少点亮一个用户可能还没说清、但读到会觉得“对，是这里”的东西。
    - 保留留白：用开放句收束，邀请用户继续想，而不是封死答案。
    - 行动建议不是默认项。只有用户材料里有明显“想往前走”的信号，或补充问题在问“怎么做”时，才用“如果你想试一小步，可以……”的邀请式表达。
    - 如果出现自伤、危机、危险关系、严重创伤信号：停止深度分析，简短接住，并建议用户联系现实中的可信赖的人或当地紧急/专业支持。

    【输出格式要求】
    严格遵守以下 JSON 格式。content 字段支持 Markdown，但前台只需要一封自然的照见回信，不要多位智者分段，不要雷达分析说明。
    
    {
      "content": "（一封自由结构的照见回信。可以有自然段落，但不要机械标题化。开头建议类似：我读了你写的内容。下面是我暂时看到的，不一定完全对，你可以对照自己的感受。）",
      "metrics": {
        "clarity": 0,
        "grounding": 0,
        "openness": 0,
        "agency": 0,
        "gentleness": 0
      }
    }
    
    【用户原始记录与事件】:
    "${entryContent}"
    
    ${
      reflectionContext?.trim()
        ? `【用户此刻最想补充或弄明白的一句话】:
    "${reflectionContext}"

    （⚠️ 重要指令）：
    1. 这句话代表用户当前的主动探索方向，请优先回应它，但不要只回答字面问题。
    2. 如果这句话本身带有自责、绝对化或过早结论，请先温和拆开事实与推测。
    3. 后续回信必须基于上一段经历继续探索，避免重复生成一封泛泛的新信。`
        : '（用户没有额外补充问题。请直接基于原始记录判断这次最需要的照见方式。）'
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
