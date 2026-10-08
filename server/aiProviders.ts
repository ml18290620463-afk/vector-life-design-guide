/**
 * Server-side AI provider adapters (OpenRouter + Google Gemini).
 *
 * Pulled out of `server.ts` as part of Phase 4 §W2.3 so:
 *   1. The route handlers in `server.ts` stay thin and read as a flat
 *      composition of "auth → rate-limit → call provider → respond".
 *   2. The upcoming §W2.4 SSE streaming refactor has a single seam to
 *      modify per provider (`callOpenRouterStream` / `callGeminiStream`)
 *      without bloating the route file.
 *   3. Provider helpers can be unit-tested in isolation by passing a
 *      `ProviderConfig` literal — `server.ts` still owns env parsing.
 *
 * Contract: every helper takes the user's already-validated prompt
 * plus the resolved provider config plus an optional AbortSignal.
 * Failures throw `Error` (no provider-specific subclass yet — the
 * route handler converts them to a generic 502 with a request-id, so
 * the upstream error shape doesn't leak to clients).
 */

import { GoogleGenAI } from '@google/genai';

export type Provider = 'openrouter' | 'gemini';

export interface ProviderConfig {
  /** Forced provider override (e.g. AI_PROVIDER=openrouter). Empty string = auto. */
  forcedProvider: Provider | '';
  openrouterKey: string;
  openrouterModel: string;
  openrouterReferer: string;
  openrouterTitle: string;
  /** Whether OpenRouter should set `response_format: { type: 'json_object' }`. */
  openrouterJsonMode: boolean;
  geminiKey: string;
  geminiModel: string;
}

/**
 * Pick the active provider. Forced provider wins when its key is
 * present; otherwise OpenRouter takes precedence over Gemini (matches
 * the README's "auto" semantics + the existing free-tier defaults).
 */
export const chooseProvider = (cfg: ProviderConfig): Provider | null => {
  if (cfg.forcedProvider === 'openrouter' && cfg.openrouterKey) return 'openrouter';
  if (cfg.forcedProvider === 'gemini' && cfg.geminiKey) return 'gemini';
  if (cfg.openrouterKey) return 'openrouter';
  if (cfg.geminiKey) return 'gemini';
  return null;
};

/** Convenience: returns the model id the resolved provider will use. */
export const resolveProviderModel = (cfg: ProviderConfig, provider: Provider): string =>
  provider === 'openrouter' ? cfg.openrouterModel : cfg.geminiModel;

/**
 * Buffered (non-streaming) OpenRouter completion. Returns the assistant
 * message string. Throws on non-2xx upstream or empty content.
 */
export const callOpenRouter = async (
  prompt: string,
  cfg: ProviderConfig,
  signal?: AbortSignal,
): Promise<string> => {
  const body: Record<string, unknown> = {
    model: cfg.openrouterModel,
    messages: [{ role: 'user', content: prompt }],
  };
  if (cfg.openrouterJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${cfg.openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': cfg.openrouterReferer,
      'X-Title': cfg.openrouterTitle,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('Empty OpenRouter response');
  }
  return content;
};

/**
 * Buffered (non-streaming) Gemini completion. Wraps the SDK promise in
 * an AbortSignal-aware wrapper because `@google/genai`'s
 * `generateContent` doesn't accept a signal natively in the version we
 * pin.
 */
export const callGemini = async (
  prompt: string,
  cfg: ProviderConfig,
  signal?: AbortSignal,
): Promise<string> => {
  const client = new GoogleGenAI({ apiKey: cfg.geminiKey });
  const generation = client.models.generateContent({
    model: cfg.geminiModel,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  if (!signal) {
    const response = await generation;
    return response.text || '';
  }

  if (signal.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  const response = await new Promise<Awaited<typeof generation>>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    generation
      .then((value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
  });

  return response.text || '';
};

/**
 * Receives one streamed token / token-fragment at a time (whatever the
 * upstream provider emits). Implementations must be cheap — they fire
 * once per chunk and the route handler relays them to the SSE client.
 */
export type StreamChunkHandler = (chunk: string) => void;

/**
 * Streamed OpenRouter completion. Sends `stream: true` so the upstream
 * responds with `text/event-stream` framing (`data: {...}\n\n`,
 * terminated by `data: [DONE]`). Returns the full concatenated text
 * once the stream closes; emits each delta through `onChunk` as it
 * arrives.
 *
 * `signal` aborts the upstream fetch; the reader loop checks the
 * signal between reads so cancellation propagates within a few ms.
 */
export const streamOpenRouter = async (
  prompt: string,
  cfg: ProviderConfig,
  onChunk: StreamChunkHandler,
  signal?: AbortSignal,
): Promise<string> => {
  const body: Record<string, unknown> = {
    model: cfg.openrouterModel,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  };
  if (cfg.openrouterJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${cfg.openrouterKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'HTTP-Referer': cfg.openrouterReferer,
      'X-Title': cfg.openrouterTitle,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${detail.slice(0, 300)}`);
  }
  if (!response.body) {
    throw new Error('OpenRouter stream has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          // Tolerate keep-alive / heartbeat lines that aren't JSON.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) {
    throw new Error('Empty OpenRouter stream');
  }
  return fullText;
};

/**
 * Streamed Gemini completion. Wraps `generateContentStream` (an async
 * iterable returning `{ text }` chunks) with a manual abort check so
 * cancellation is responsive even when the upstream is slow to close
 * the underlying connection.
 */
export const streamGemini = async (
  prompt: string,
  cfg: ProviderConfig,
  onChunk: StreamChunkHandler,
  signal?: AbortSignal,
): Promise<string> => {
  if (signal?.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  const client = new GoogleGenAI({ apiKey: cfg.geminiKey });
  const stream = await client.models.generateContentStream({
    model: cfg.geminiModel,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (signal?.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
    const delta = chunk?.text;
    if (typeof delta === 'string' && delta.length > 0) {
      fullText += delta;
      onChunk(delta);
    }
  }

  if (!fullText) {
    throw new Error('Empty Gemini stream');
  }
  return fullText;
};

export interface FreeModelSummary {
  id: string;
  name: string;
  context_length: number | null;
  description: string;
}

interface OpenRouterModelEntry {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  description?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
}

/**
 * Fetch the OpenRouter model catalogue and project the free tier into
 * a small summary shape suitable for the `/api/models` endpoint.
 * Filters in two ways: explicit `:free` suffix OR pricing.prompt and
 * pricing.completion both 0 (catches new free models that haven't
 * adopted the suffix convention yet).
 */
export const fetchOpenRouterFreeModels = async (
  cfg: ProviderConfig,
): Promise<FreeModelSummary[]> => {
  const headers: Record<string, string> = {};
  if (cfg.openrouterKey) {
    headers.Authorization = `Bearer ${cfg.openrouterKey}`;
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
  if (!response.ok) {
    throw new Error(`Upstream ${response.status}`);
  }
  const data = await response.json();
  const items: OpenRouterModelEntry[] = Array.isArray(data?.data) ? data.data : [];

  return items
    .filter((model) => {
      const id = String(model?.id || '');
      const promptPrice = Number(model?.pricing?.prompt ?? 1);
      const completionPrice = Number(model?.pricing?.completion ?? 1);
      return id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0);
    })
    .map(
      (model): FreeModelSummary => ({
        id: String(model?.id || ''),
        name: String(model?.name || model?.id || ''),
        context_length: typeof model?.context_length === 'number' ? model.context_length : null,
        description: String(model?.description || '').slice(0, 220),
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
};
