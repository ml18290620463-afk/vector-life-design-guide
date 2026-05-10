import type { Memory, MemoryCategory } from '../types';

/**
 * Phase 4 Week 4 (§2.2 of [`docs/memoir-memory-system.md`](
 * ../docs/memoir-memory-system.md)) — `services/memoryDedup.ts`
 *
 * Approximate dedup for incoming memory candidates. The Week 3
 * extractor runs each Morning Star round in isolation, so the same
 * fact ("用户上周面试通过了") will get re-extracted in slightly
 * different forms across rounds. Without dedup the bank pollutes
 * with near-duplicates that inflate the recall ranker's output and
 * burn through the per-Memoir capacity ceiling.
 *
 * The dedup heuristic:
 *
 * 1. **Bigram-Jaccard similarity** is computed against every
 *    *non-deleted, same-category, same-Memoir* memory.
 *    - Cost is O(M × |body|) but |body| ≤ 240 chars and M is
 *      bounded by the per-tier capacity ceiling (≤ 1000).
 *    - Pure character bigrams (no tokenisation) so the heuristic
 *      works equally well for Chinese ("面试通过") and English
 *      ("passed the interview").
 * 2. **Three outcomes** based on the max similarity:
 *    - `>= 0.55` ⇒ **collapse**. Drop the new candidate; bump
 *      the matched memory's `updatedAt` so the decay scorer
 *      treats it as reinforced (§2.1 reinforce boost).
 *    - `[0.30, 0.55)` ⇒ **insert with soft pointer**. Keep both,
 *      stamp `relatedTo = matched.id` on the new memory for a
 *      future merge UI to surface.
 *    - `< 0.30` ⇒ **insert clean**.
 *
 * Why bigram-Jaccard (not edit distance / vector embed):
 *   - Edit distance is sensitive to phrase reordering ("面试通过"
 *     vs "通过了面试") which is exactly the case dedup needs to
 *     catch.
 *   - Vector embeddings would mean either bundling an embed
 *     model (kills bundle) or sending memories to an embed API
 *     (kills 铁律 1 — local-first).
 *   - Bigram-Jaccard handles word-order shuffles + minor surface
 *     variants well enough at ≤ 1K memories per Memoir.
 *
 * The function is **pure** + side-effect free; the consumer
 * (`useMemoryStore.addMemory`) is responsible for actually
 * persisting the resulting verdict. Same testability posture as
 * `memoryDecay.ts`.
 */

/** Surface-level similarity threshold above which the new
 *  candidate is folded into the matched memory. Empirical sweet
 *  spot from the design doc; tunable via constant — never inline. */
export const COLLAPSE_THRESHOLD = 0.55;

/** Lower bound for keeping a `relatedTo` soft pointer. Below this
 *  the memories are too dissimilar to be considered related at all. */
export const RELATED_THRESHOLD = 0.3;

/* ------------------------------------------------------------------ */
/*  Bigram extraction                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build the multiset of character bigrams of a body. Whitespace is
 * collapsed first (so "面试  通过" and "面试 通过" produce the same
 * bigrams). Returns an array (not a Set) so multiplicities count
 * — a body that says "面试" twice should be more similar to a
 * matching body that also says it twice.
 *
 * Exposed for testing.
 */
export const characterBigrams = (body: string): string[] => {
  const cleaned = body.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    out.push(cleaned.slice(i, i + 2));
  }
  return out;
};

/**
 * Multiset Jaccard similarity = |intersection| / |union| with
 * multiplicity. Returns 0 for either-empty input. Range: [0, 1].
 *
 * Exposed for testing.
 */
export const bigramJaccard = (a: string, b: string): number => {
  const ag = characterBigrams(a);
  const bg = characterBigrams(b);
  if (ag.length === 0 || bg.length === 0) return 0;
  const aMap = new Map<string, number>();
  for (const g of ag) aMap.set(g, (aMap.get(g) ?? 0) + 1);
  const bMap = new Map<string, number>();
  for (const g of bg) bMap.set(g, (bMap.get(g) ?? 0) + 1);
  let inter = 0;
  let union = 0;
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
  for (const key of allKeys) {
    const av = aMap.get(key) ?? 0;
    const bv = bMap.get(key) ?? 0;
    inter += Math.min(av, bv);
    union += Math.max(av, bv);
  }
  return union === 0 ? 0 : inter / union;
};

/* ------------------------------------------------------------------ */
/*  Verdict                                                            */
/* ------------------------------------------------------------------ */

export type DedupVerdict =
  | { kind: 'insert-clean' }
  | { kind: 'insert-related'; matchId: string; similarity: number }
  | { kind: 'collapse'; matchId: string; similarity: number };

export interface DedupCandidateInput {
  memoirId: string;
  category: MemoryCategory;
  body: string;
}

/**
 * Run a candidate body through the dedup heuristic and return a
 * verdict. The caller decides what to do with each outcome:
 *
 *   - `'collapse'`  ⇒ skip insert; bump matched memory's updatedAt.
 *   - `'insert-related'` ⇒ insert; stamp `relatedTo = matchId`.
 *   - `'insert-clean'`   ⇒ insert; `relatedTo` stays undefined.
 *
 * Filters scope:
 *   - Same `memoirId` (memories are hermetic per Memoir).
 *   - Same `category` (a `fact` and an `emotion` about the same
 *     event are intentionally separate signals — never collapse
 *     across categories).
 *   - Excludes soft-deleted memories from the candidate pool.
 */
export const dedupVerdict = (
  candidate: DedupCandidateInput,
  existing: readonly Memory[],
): DedupVerdict => {
  let bestMatchId: string | null = null;
  let bestScore = 0;
  for (const m of existing) {
    if (m.deletedAt !== undefined) continue;
    if (m.memoirId !== candidate.memoirId) continue;
    if (m.category !== candidate.category) continue;
    const score = bigramJaccard(candidate.body, m.body);
    if (score > bestScore) {
      bestScore = score;
      bestMatchId = m.id;
    }
  }
  if (bestMatchId === null || bestScore < RELATED_THRESHOLD) {
    return { kind: 'insert-clean' };
  }
  if (bestScore >= COLLAPSE_THRESHOLD) {
    return { kind: 'collapse', matchId: bestMatchId, similarity: bestScore };
  }
  return { kind: 'insert-related', matchId: bestMatchId, similarity: bestScore };
};

/**
 * Apply a `'collapse'` verdict to the in-memory list: bump the
 * matched memory's `updatedAt` to `now`. Returns a new array
 * (immutable update) so the caller's render path picks up the
 * change. The matched memory's `body` is NOT modified — the
 * existing body is kept (it survived dedup, after all), only
 * its freshness signal is updated.
 *
 * Exposed separately so the consumer (`useMemoryStore.addMemory`)
 * can persist the change atomically with the new candidate insert
 * (or, in the collapse case, the no-op insert).
 */
export const applyCollapse = (
  memories: readonly Memory[],
  matchId: string,
  now: number,
): Memory[] => memories.map((m) => (m.id === matchId ? { ...m, updatedAt: now } : m));
