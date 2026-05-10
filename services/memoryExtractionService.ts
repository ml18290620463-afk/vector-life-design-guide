import type { MemoryCategory } from '../types';

/**
 * Phase 4 Week 3.5 — `services/memoryExtractionService.ts`
 *
 * Client wrapper around `POST /api/memoir-extract`. Sister to
 * [`services/geminiService.ts`](./geminiService.ts) but with a
 * **deliberately silent failure mode**:
 *
 *   - Memory extraction is a *background* enrichment of the
 *     Memoir's long-term memory bank. It must NEVER bubble an
 *     error to the user — the conversation itself already
 *     succeeded. A 502 from the extractor or a hung network
 *     simply means "no new memories this round".
 *   - The caller (`hooks/useMemoirMemoryHarvest`) treats the
 *     return value as a maybe-list: an empty array on success-
 *     with-nothing-to-extract is interchangeable with `null` on
 *     network failure.
 *
 * Privacy posture: this wrapper only forwards the conversation
 * transcript that the user has already produced. It does NOT
 * persist anything; the surviving candidates land in the local
 * `useMemoryStore` after the caller re-runs them through
 * `services/memoryService.detectUnsafeMemoryBody`.
 */

export interface MemoirConversationTurn {
  role: 'user' | 'memoir';
  content: string;
}

export interface ExtractedMemoryCandidate {
  category: MemoryCategory;
  body: string;
}

export interface ExtractMemoirMemoriesArgs {
  transcript: MemoirConversationTurn[];
  /** Optional fetch override — tests inject a stub. Defaults to the
   *  global `fetch`. */
  fetcher?: typeof fetch;
  /** AbortSignal so callers can cancel the harvest if the user
   *  navigates away mid-call. */
  signal?: AbortSignal;
}

const ENDPOINT = '/api/memoir-extract';

/**
 * Hit `/api/memoir-extract` and return the parsed candidate list.
 *
 * Returns:
 *   - `Candidate[]` (possibly empty) when the request resolves
 *     successfully.
 *   - `null` on ANY failure (network, non-2xx, parse, abort).
 *     The caller MUST be prepared for null and treat it as
 *     "skip the harvest this round".
 */
export const extractMemoirMemories = async (
  args: ExtractMemoirMemoriesArgs,
): Promise<ExtractedMemoryCandidate[] | null> => {
  const fetcher = args.fetcher ?? fetch;
  if (!Array.isArray(args.transcript) || args.transcript.length === 0) {
    return null;
  }
  try {
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: args.transcript }),
      signal: args.signal,
    });
    if (!response.ok) {
      // Silent failure — log for ops visibility but don't propagate.
      // 4xx = our request shape was wrong (caller's bug, not user's).
      // 5xx = upstream / proxy issue (transient).
      console.warn(`memoir-extract: non-2xx ${response.status} — skipping harvest`);
      return null;
    }
    const body = (await response.json()) as {
      memories?: ExtractedMemoryCandidate[];
    };
    if (!body || !Array.isArray(body.memories)) return null;
    return body.memories;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return null;
    console.warn('memoir-extract: network error — skipping harvest', err);
    return null;
  }
};
