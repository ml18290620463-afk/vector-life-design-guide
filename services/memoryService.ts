import type { Memory, MemoryCategory } from '../types';
import { generateSecureId } from './idGenerator';
import { memorySalience } from './memoryDecay';

/**
 * Phase 4 Week 3 (§5.1.B) — `services/memoryService.ts`
 *
 * Pure (side-effect-free) data layer for **心象 (Memoir) long-term
 * memories**. Same architectural posture as `services/personaService.ts`:
 *
 *   - All schema validation, id minting, and category classification
 *     lives here.
 *   - Persistence (IDB / localStorage mirror) lives in
 *     `hooks/useMemoryStore`, which calls into this module for shape
 *     enforcement on every read and write.
 *   - The Memoir conversation pipeline (`hooks/useMemoirChat`, Day 6)
 *     reads memories via `selectMemoriesForRecall` to inject the
 *     top-N most relevant memories into the system prompt.
 *
 * Privacy posture (CRITICAL — read [`docs/product-vision-2026Q2.md`](
 * ../docs/product-vision-2026Q2.md) §1 铁律 1):
 *
 *   1. Memories are extracted by an LLM but **stored locally only**.
 *      No memory body ever leaves the device except as transient
 *      context passed back to the AI proxy at recall time, and even
 *      that flows through the same "no-log" proxy as the rest of the
 *      app.
 *   2. The **safety check** below (`detectUnsafeMemoryBody`) runs on
 *      every memory before it is persisted. Bodies that look like
 *      they contain phone numbers, email addresses, or other
 *      third-party PII are rejected; the extractor is expected to
 *      keep them out, and this is the belt-and-braces second line
 *      of defence.
 *   3. The user has **full control**. `MemoryManagementPanel`
 *      (Day 5) wires `updateMemory`, `deleteMemory`, and
 *      `clearMemoirMemories` to user-facing actions.
 *
 * Anti-pattern note: do NOT inline these helpers into the hook. Tests
 * for the schema, the safety check, and the recall ranking all live
 * in `services/memoryService.test.ts` and depend on the helpers being
 * pure functions free of React imports.
 */

const MEMORY_BODY_MAX = 240;
const MEMORY_SOURCE_REF_MAX = 80;

/* ------------------------------------------------------------------ */
/*  Type guards + sanitisation                                         */
/* ------------------------------------------------------------------ */

const isMemoryCategory = (value: unknown): value is MemoryCategory =>
  value === 'fact' || value === 'emotion' || value === 'relationship' || value === 'milestone';

/** Schema-tight predicate consumed by both runtime CRUD and the
 *  v3-backup importer. Returns false (rather than throwing) for any
 *  shape that would corrupt the memories list. */
export const looksLikeMemory = (value: unknown): value is Memory => {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string' || c.id.length === 0) return false;
  if (typeof c.memoirId !== 'string' || c.memoirId.length === 0) return false;
  if (!isMemoryCategory(c.category)) return false;
  if (typeof c.body !== 'string' || c.body.trim().length === 0) return false;
  if (typeof c.createdAt !== 'number' || !Number.isFinite(c.createdAt)) return false;
  if (typeof c.updatedAt !== 'number' || !Number.isFinite(c.updatedAt)) return false;
  if (c.sourceRef !== undefined && typeof c.sourceRef !== 'string') return false;
  // Phase 4 W4: optional soft-delete + relatedTo. Same posture as
  // sourceRef — undefined is fine, anything else must match shape.
  if (
    c.deletedAt !== undefined &&
    (typeof c.deletedAt !== 'number' || !Number.isFinite(c.deletedAt))
  ) {
    return false;
  }
  if (c.relatedTo !== undefined && typeof c.relatedTo !== 'string') return false;
  return true;
};

/** Trims + caps every text field. Same posture as
 *  `personaService.sanitizePersona`. */
export const sanitizeMemory = (input: unknown): Memory | null => {
  if (!looksLikeMemory(input)) return null;
  const trimmedBody = input.body.trim().slice(0, MEMORY_BODY_MAX);
  if (trimmedBody.length === 0) return null;
  return {
    id: input.id,
    memoirId: input.memoirId,
    category: input.category,
    body: trimmedBody,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    sourceRef: input.sourceRef ? input.sourceRef.slice(0, MEMORY_SOURCE_REF_MAX) : undefined,
    deletedAt: input.deletedAt,
    relatedTo: input.relatedTo,
  };
};

/** Hydrate a list of memories read from storage. Drops anything that
 *  fails schema validation rather than poisoning the runtime list. */
export const hydrateMemories = (raw: unknown): Memory[] => {
  if (!Array.isArray(raw)) return [];
  const out: Memory[] = [];
  for (const item of raw) {
    const sane = sanitizeMemory(item);
    if (sane) out.push(sane);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  Safety check                                                       */
/* ------------------------------------------------------------------ */

/**
 * Detect memory bodies that look like they contain third-party PII.
 * The extractor's prompt template explicitly forbids these patterns;
 * this regex bank is the runtime second line of defence.
 *
 * Heuristics deliberately err on the side of a few false positives —
 * a memory that gets rejected can be re-extracted on the next round
 * with a slightly different question, but a memory that leaks an
 * email or a phone number is a data-protection incident.
 */
const PII_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, reason: 'email-address' },
  // CN national id checked BEFORE the phone regex because the phone
  // regex would otherwise swallow the 18-contiguous-digit shape.
  { pattern: /\b\d{17}[0-9X]\b/i, reason: 'national-id' },
  // Phone numbers: 7+ contiguous digits OR groups separated by spaces / dashes.
  { pattern: /(?:\+?\d[\s.-]?){7,}/, reason: 'phone-number' },
];

export interface MemorySafetyVerdict {
  safe: boolean;
  /** First matching reason; null when `safe === true`. */
  reason: string | null;
}

/** Returns `{ safe: true }` when the body passes all PII heuristics;
 *  otherwise returns the first matching reason for the caller to log. */
export const detectUnsafeMemoryBody = (body: string): MemorySafetyVerdict => {
  if (typeof body !== 'string') return { safe: false, reason: 'not-a-string' };
  for (const { pattern, reason } of PII_PATTERNS) {
    if (pattern.test(body)) return { safe: false, reason };
  }
  return { safe: true, reason: null };
};

/* ------------------------------------------------------------------ */
/*  CRUD primitives                                                    */
/* ------------------------------------------------------------------ */

export interface MintMemoryInput {
  memoirId: string;
  category: MemoryCategory;
  body: string;
  sourceRef?: string;
  /** Skip the safety check — used ONLY by tests / by the v3-backup
   *  importer (because every backup memory has already been through
   *  the check at write time). Production callers should leave this
   *  undefined. */
  skipSafetyCheck?: boolean;
}

export interface MintMemoryFailure {
  ok: false;
  reason: string;
}

export interface MintMemorySuccess {
  ok: true;
  memory: Memory;
}

export type MintMemoryResult = MintMemorySuccess | MintMemoryFailure;

/** Mint a brand-new `Memory` from extractor output. Returns the
 *  failure branch when the body fails the PII safety check. Sets
 *  `id`, `createdAt`, `updatedAt`, applies field caps. */
export const mintMemory = (input: MintMemoryInput): MintMemoryResult => {
  if (!input.memoirId) return { ok: false, reason: 'missing-memoirId' };
  if (!isMemoryCategory(input.category)) {
    return { ok: false, reason: 'invalid-category' };
  }
  const body = (input.body ?? '').trim().slice(0, MEMORY_BODY_MAX);
  if (body.length === 0) return { ok: false, reason: 'empty-body' };
  if (!input.skipSafetyCheck) {
    const safety = detectUnsafeMemoryBody(body);
    if (!safety.safe) return { ok: false, reason: `unsafe:${safety.reason}` };
  }
  const now = Date.now();
  const candidate: Memory = {
    id: generateSecureId('memory'),
    memoirId: input.memoirId,
    category: input.category,
    body,
    createdAt: now,
    updatedAt: now,
    sourceRef: input.sourceRef ? input.sourceRef.slice(0, MEMORY_SOURCE_REF_MAX) : undefined,
  };
  const sane = sanitizeMemory(candidate);
  if (!sane) return { ok: false, reason: 'sanitisation-failed' };
  return { ok: true, memory: sane };
};

/** Patch a memory body / category by id. Bumps `updatedAt`. Returns
 *  the same array reference if no memory matched. The user-facing
 *  edit surface (Day 5 `MemoryManagementPanel`) re-runs the safety
 *  check on the patched body before persisting. */
export const updateMemory = (
  memories: Memory[],
  id: string,
  patch: { body?: string; category?: MemoryCategory },
): Memory[] => {
  let found = false;
  const next = memories.map((m) => {
    if (m.id !== id) return m;
    found = true;
    const candidate: Memory = {
      ...m,
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      updatedAt: Date.now(),
    };
    return sanitizeMemory(candidate) ?? m;
  });
  return found ? next : memories;
};

/**
 * Hard-remove a single memory by id. Used by the recycle-bin
 * "delete forever" action and by the v3 backup importer when the
 * incoming payload omits a previously-known id (i.e. user explicitly
 * cleared on another device).
 *
 * Phase 4 W4 (§2.5) — for the user-initiated delete from the
 * management panel, callers should prefer `softDeleteMemory`
 * instead. The two-step soft delete + 30-day recycle bin gives
 * users an undo and is the new default destructive action.
 */
export const deleteMemory = (memories: Memory[], id: string): Memory[] =>
  memories.filter((m) => m.id !== id);

/**
 * Phase 4 W4 (§2.5) — soft delete: stamp `deletedAt = now` on the
 * matched memory. The recall ranker filters on `deletedAt === undefined`
 * so a soft-deleted memory immediately disappears from prompts; the
 * `purgeExpiredSoftDeletes` sweep on store mount hard-removes
 * anything whose `deletedAt < now - 30d`.
 *
 * Returns the same array reference if the id is not found, so the
 * consumer can early-return.
 */
const SOFT_DELETE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const softDeleteMemory = (
  memories: Memory[],
  id: string,
  now: number = Date.now(),
): Memory[] => {
  let found = false;
  const next = memories.map((m) => {
    if (m.id !== id) return m;
    found = true;
    return { ...m, deletedAt: now };
  });
  return found ? next : memories;
};

/** Reverse a soft-delete: clear the `deletedAt` field on the
 *  matched memory. No-op if id not found OR memory was not soft-
 *  deleted. */
export const restoreSoftDeletedMemory = (memories: Memory[], id: string): Memory[] => {
  let found = false;
  const next = memories.map((m) => {
    if (m.id !== id || m.deletedAt === undefined) return m;
    found = true;
    const { deletedAt: _drop, ...rest } = m;
    void _drop;
    return rest;
  });
  return found ? next : memories;
};

/**
 * Background sweep — hard-removes any soft-deleted memory whose
 * `deletedAt` is older than the 30-day retention window. Pure;
 * the consumer (`useMemoryStore` mount effect) decides when to
 * run it. Safe to call on every mount — O(M) and a no-op when
 * nothing has expired.
 */
export const purgeExpiredSoftDeletes = (memories: Memory[], now: number = Date.now()): Memory[] =>
  memories.filter((m) => m.deletedAt === undefined || now - m.deletedAt < SOFT_DELETE_RETENTION_MS);

/** Convenience: get the soft-deleted memories of a Memoir, sorted
 *  most-recently-deleted first. Used by the recycle-bin tab. */
export const listSoftDeletedForMemoir = (memories: readonly Memory[], memoirId: string): Memory[] =>
  memories
    .filter((m) => m.memoirId === memoirId && m.deletedAt !== undefined)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

/** Wipe every memory belonging to one Memoir persona. Used both for
 *  the user's "清空这位心象的记忆" CTA and as a cascade when the
 *  Memoir persona itself is deleted. Bypasses the soft-delete
 *  recycle bin — the user has explicitly opted into a hard wipe. */
export const clearMemoirMemories = (memories: Memory[], memoirId: string): Memory[] =>
  memories.filter((m) => m.memoirId !== memoirId);

/* ------------------------------------------------------------------ */
/*  Capacity + eviction (Phase 4 W4 §2.3)                              */
/* ------------------------------------------------------------------ */

/** Score multiplier applied during eviction comparison only —
 *  relationship memories are stickier than their raw salience
 *  suggests because they describe long-running ties that the
 *  user is unlikely to want auto-evicted. Decay still pulls them
 *  down over time; this just slows the slide. */
const EVICTION_CATEGORY_BIAS: Record<MemoryCategory, number> = {
  milestone: 1.0, // exempt from eviction entirely (see below)
  relationship: 1.5,
  emotion: 1.0,
  fact: 1.0,
};

/**
 * Count *live* (non-soft-deleted) memories belonging to a Memoir.
 * The capacity ceiling enforced by `evictLowestSalience` compares
 * against this count, NOT the raw `length`, so soft-deleted entries
 * sitting in the recycle bin don't squeeze out new ones.
 */
export const countLiveMemoriesForMemoir = (
  memories: readonly Memory[],
  memoirId: string,
): number => {
  let n = 0;
  for (const m of memories) {
    if (m.memoirId === memoirId && m.deletedAt === undefined) n += 1;
  }
  return n;
};

/**
 * If the Memoir is at-or-above its `cap`, drop the lowest-eviction-
 * score live memory and return the trimmed list. Otherwise return
 * the input unchanged (identity equality holds). Pure.
 *
 * `milestone` memories are **exempt from eviction** — they fade in
 * salience but never get culled. The user can still delete them
 * manually via the management panel.
 *
 * Returns the same array reference if no eviction was needed —
 * useful for the consumer to know whether to re-persist.
 */
export const evictLowestSalience = (
  memories: Memory[],
  memoirId: string,
  cap: number,
  now: number = Date.now(),
): Memory[] => {
  if (cap <= 0) return memories;
  const live = countLiveMemoriesForMemoir(memories, memoirId);
  if (live < cap) return memories;
  // Find the lowest-eviction-score live, non-milestone memory.
  let victimId: string | null = null;
  let victimScore = Infinity;
  for (const m of memories) {
    if (m.memoirId !== memoirId) continue;
    if (m.deletedAt !== undefined) continue;
    if (m.category === 'milestone') continue;
    const score = memorySalience(m, now) * EVICTION_CATEGORY_BIAS[m.category];
    if (score < victimScore) {
      victimScore = score;
      victimId = m.id;
    }
  }
  if (victimId === null) {
    // Bank is at cap but every memory is a milestone — refuse to
    // evict (caller decides whether to also refuse the new insert
    // OR insert and accept temporary over-cap; current consumer
    // accepts over-cap for milestone-saturated banks).
    return memories;
  }
  return memories.filter((m) => m.id !== victimId);
};

/* ------------------------------------------------------------------ */
/*  Recall ranking                                                     */
/* ------------------------------------------------------------------ */

export interface SelectRecallOptions {
  memoirId: string;
  /** Maximum number of memories to return. Default 12 — empirical
   *  sweet spot from the product-vision spec (enough context to feel
   *  remembered, not enough to bloat the prompt). */
  limit?: number;
  /** Optional query string used for naive keyword overlap scoring. */
  query?: string;
  /** Provide `Date.now()` from the caller so tests stay deterministic. */
  now?: number;
}

const DEFAULT_LIMIT = 12;

/* ------------------------------------------------------------------ */
/*  Recall ranking — v2 (Phase 4 W4 §2.4)                              */
/* ------------------------------------------------------------------ */

// Tokeniser used by both the BM25-ish term-frequency component and
// the category-prior shape detection. Splits on whitespace +
// punctuation, drops single-char tokens (most useful Chinese
// "words" are 2+ chars). Pure.
const QUERY_SEPARATORS = /[\s,.\u3001\u3002\uff01\uff1f!?;:"'()\[\]{}<>·、]+/u;
const tokenise = (s: string): string[] =>
  s
    .toLowerCase()
    .split(QUERY_SEPARATORS)
    .filter((t) => t.length >= 2);

// Date-shape detection for the category-prior boost. Catches both
// English ("today / tomorrow / last week") and Chinese (今天 /
// 明天 / 上周 / yyyy 年) idioms — extending this list is a one-
// line change.
const DATE_HINTS = [
  '今天',
  '明天',
  '昨天',
  '本周',
  '上周',
  '下周',
  '本月',
  '上个月',
  'today',
  'tomorrow',
  'yesterday',
  'this week',
  'last week',
  'next week',
];
const EMOTION_HINTS = [
  '难过',
  '焦虑',
  '开心',
  '伤心',
  '害怕',
  '愤怒',
  '失望',
  '紧张',
  'happy',
  'sad',
  'anxious',
  'angry',
  'scared',
  'lonely',
  'tired',
];

const queryHasShape = (query: string, hints: readonly string[]): boolean => {
  const q = query.toLowerCase();
  for (const h of hints) {
    if (q.includes(h)) return true;
  }
  return false;
};

/**
 * Count substring occurrences of `needle` in `haystack`. Used by
 * the BM25-ish ranker because Chinese bodies do NOT tokenise on
 * whitespace; "面试" only appears as a substring, never as a
 * standalone token. Pure helper — exported only for unit testing.
 */
const countOccurrences = (haystack: string, needle: string): number => {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return count;
    count += 1;
    from = idx + needle.length;
  }
};

/**
 * BM25-ish term-frequency × IDF score for a single document
 * (memory body) against a query. We treat the bank as the corpus,
 * so IDF is dynamic per recall call.
 *
 * Term presence is detected by **substring** containment (not by
 * whitespace tokenisation) so the ranker works equally well for
 * Chinese ("面试" inside "今天面试很顺利") and English. Length
 * normalisation uses character count for the same reason.
 *
 * Returns 0 when the query is empty so callers can shortcut.
 */
const bm25Score = (
  memory: Memory,
  queryTokens: readonly string[],
  corpus: readonly Memory[],
): number => {
  if (queryTokens.length === 0) return 0;
  const body = memory.body.toLowerCase();
  if (body.length === 0) return 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgLen = corpus.reduce((acc, m) => acc + m.body.length, 0) / Math.max(1, corpus.length);
  let score = 0;
  for (const term of queryTokens) {
    const tf = countOccurrences(body, term);
    if (tf === 0) continue;
    const docFreq = corpus.reduce((n, m) => (m.body.toLowerCase().includes(term) ? n + 1 : n), 0);
    const idf = Math.log(1 + (corpus.length - docFreq + 0.5) / (docFreq + 0.5));
    const norm = tf * (k1 + 1);
    const denom = tf + k1 * (1 - b + b * (body.length / Math.max(1, avgLen)));
    score += idf * (norm / denom);
  }
  return Math.max(0, score);
};

const categoryPrior = (memory: Memory, query: string): number => {
  if (queryHasShape(query, DATE_HINTS)) {
    if (memory.category === 'milestone' || memory.category === 'fact') return 0.3;
  }
  if (queryHasShape(query, EMOTION_HINTS) && memory.category === 'emotion') {
    return 0.3;
  }
  return 0;
};

/**
 * Pick the top-N most relevant memories for a Memoir conversation
 * turn. The Memoir chat pipeline calls this immediately before
 * composing the system prompt.
 *
 * Phase 4 W4 §2.4 — the v2 ranker combines:
 *   1. **Salience** (`memorySalience`) — exponential decay per
 *      category, plus reinforcement boost when the user re-mentions
 *      a fact and dedup collapses the new candidate into the
 *      matched memory.
 *   2. **BM25-ish word overlap** with the query — replaces the
 *      v1 substring count, gives proper IDF weighting so generic
 *      words ("today") don't drown out specific ones.
 *   3. **Category prior** — boosts `milestone` + `fact` for
 *      date-shaped queries, `emotion` for emotion-word queries.
 *
 * Soft-deleted memories (`deletedAt !== undefined`) are filtered
 * out **before** ranking — they should never surface in a Memoir's
 * recall context.
 *
 * Why no vector embedding: see `services/memoryDedup.ts` for the
 * full rationale. Tl;dr — bundling an embed model kills bundle
 * size, and sending memories to an embed API kills 铁律 1.
 */
export const selectMemoriesForRecall = (
  memories: Memory[],
  options: SelectRecallOptions,
): Memory[] => {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const now = options.now ?? Date.now();
  const query = options.query ?? '';
  const queryTokens = tokenise(query);
  const scoped = memories.filter(
    (m) => m.memoirId === options.memoirId && m.deletedAt === undefined,
  );
  const ranked = scoped
    .map((memory) => {
      const salience = memorySalience(memory, now);
      const bm25 = bm25Score(memory, queryTokens, scoped);
      const prior = categoryPrior(memory, query);
      const score = salience + 0.4 * bm25 + prior;
      return { memory, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.memory);
  return ranked;
};

/* ------------------------------------------------------------------ */
/*  Public field caps (re-exported for the UI character counters).    */
/* ------------------------------------------------------------------ */

export const MEMORY_LIMITS = {
  body: MEMORY_BODY_MAX,
  sourceRef: MEMORY_SOURCE_REF_MAX,
} as const;
