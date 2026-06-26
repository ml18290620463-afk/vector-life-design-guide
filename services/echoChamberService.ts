/**
 * Phase 4.5 §B (Echo Chamber) — `services/echoChamberService.ts`
 *
 * Client wrapper for `POST /api/echo-chamber`. Sister to
 * [`services/memoryExtractionService.ts`](./memoryExtractionService.ts):
 * mostly a thin facade that defends against malformed responses
 * and surfaces a tagged-failure type the caller can act on.
 *
 * Unlike `memoryExtractionService.extractMemoirMemories` (which
 * silently swallows failures because extraction is a background
 * enrichment), Echo Chamber is **user-initiated** — the modal
 * needs to know precisely which failure mode occurred so it can
 * render the right inline message.
 */

export interface RunEchoChamberArgs {
  query: string;
  personaNames: readonly string[];
  /** Per-persona system prompt overrides (e.g. user's custom
   *  persona builder output). Same map shape the Morning Star
   *  pipeline uses elsewhere. */
  customPersonaPrompts?: Record<string, string>;
  /** Per-Memoir long-term memory recall (`name → top-N memories`).
   *  Computed by the caller via `useMemoryStore.recallForMemoir`
   *  with the `query` as the recall hint. */
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>;
  /** Optional fetch override for tests. */
  fetcher?: typeof fetch;
  /** AbortSignal so the modal can cancel a long-running call when
   *  the user hits Esc / closes mid-flight. */
  signal?: AbortSignal;
}

export type RunEchoChamberFailureReason =
  | 'invalid-input'
  | 'rate-limited'
  | 'rejected-by-injection-guard'
  | 'ai-unavailable'
  | 'empty-response'
  | 'aborted'
  | 'unknown';

export type RunEchoChamberResult =
  | { ok: true; markdown: string; provider?: string }
  | { ok: false; reason: RunEchoChamberFailureReason; detail?: string };

const ENDPOINT = '/api/echo-chamber';

/** Map a server-returned `code` field to our discriminated reason. */
const reasonFromServer = (
  status: number,
  code: string | undefined,
): RunEchoChamberFailureReason => {
  if (code === 'INJECTION') return 'rejected-by-injection-guard';
  if (code === 'EMPTY') return 'empty-response';
  if (status === 400) return 'invalid-input';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'ai-unavailable';
  return 'unknown';
};

export const runEchoChamber = async (args: RunEchoChamberArgs): Promise<RunEchoChamberResult> => {
  const fetcher = args.fetcher ?? fetch;
  if (!Array.isArray(args.personaNames) || args.personaNames.length === 0) {
    return { ok: false, reason: 'invalid-input', detail: 'personaNames is empty' };
  }
  if (typeof args.query !== 'string' || args.query.trim().length === 0) {
    return { ok: false, reason: 'invalid-input', detail: 'query is empty' };
  }
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: args.signal,
      body: JSON.stringify({
        query: args.query,
        personaNames: args.personaNames,
        ...(args.customPersonaPrompts && Object.keys(args.customPersonaPrompts).length > 0
          ? { customPersonaPrompts: args.customPersonaPrompts }
          : {}),
        ...(args.memoirRecallByPersona && Object.keys(args.memoirRecallByPersona).length > 0
          ? { memoirRecallByPersona: args.memoirRecallByPersona }
          : {}),
      }),
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return { ok: false, reason: 'aborted' };
    }
    console.warn('runEchoChamber: network error', err);
    return { ok: false, reason: 'ai-unavailable', detail: String(err) };
  }
  if (!response.ok) {
    let detail: string | undefined;
    let code: string | undefined;
    try {
      const errBody = (await response.json()) as {
        detail?: string;
        error?: string;
        code?: string;
      };
      detail = errBody.detail || errBody.error;
      code = errBody.code;
    } catch {
      // empty / non-JSON body — fall through with bare reason
    }
    return {
      ok: false,
      reason: reasonFromServer(response.status, code),
      detail,
    };
  }
  let body: { markdown?: string; provider?: string };
  try {
    body = (await response.json()) as { markdown?: string; provider?: string };
  } catch {
    return { ok: false, reason: 'empty-response', detail: 'response body not JSON' };
  }
  if (!body.markdown || body.markdown.trim().length === 0) {
    return { ok: false, reason: 'empty-response' };
  }
  return { ok: true, markdown: body.markdown, provider: body.provider };
};
