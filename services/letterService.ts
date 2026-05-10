import type { LetterStatus, PendingLetter } from '../types';
import { generateSecureId } from './idGenerator';

/**
 * Phase 4.5 §A (Letter Mode) — `services/letterService.ts`
 *
 * Pure (side-effect-free) data layer for **写信模式 — Memoir
 * delayed letters**. Same architectural posture as
 * [`services/memoryService.ts`](./memoryService.ts):
 *
 *   - All schema validation, id minting, and lifecycle helpers
 *     live here.
 *   - Persistence (IDB / localStorage mirror) lives in
 *     `hooks/useLetterStore`, which calls into this module for
 *     shape enforcement on every read and write.
 *   - The delivery pipeline (`services/letterDelivery.ts`) reads
 *     `dueLetters` to find what to dispatch.
 *
 * Privacy posture: letter bodies are stored locally only. They
 * pass through the AI proxy ONCE at delivery time (same posture
 * as the Memoir conversation harvest). The user can preview /
 * cancel pending letters from Settings → 心象管理 → "信件".
 */

const LETTER_BODY_MAX = 4000;
const MAX_DELIVERY_ATTEMPTS = 3;
/** Hard floor on `deliverAt` relative to `composedAt`. The UI
 *  exposes 1h / 24h / 3d presets; we still defend against a
 *  hostile / corrupted call passing a value lower than this. */
const MIN_DELAY_MS = 1000 * 60 * 5; // 5 minutes
const MAX_DELAY_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ------------------------------------------------------------------ */
/*  Type guards + sanitisation                                         */
/* ------------------------------------------------------------------ */

const isLetterStatus = (v: unknown): v is LetterStatus =>
  v === 'pending' || v === 'delivered' || v === 'cancelled' || v === 'failed';

export const looksLikeLetter = (value: unknown): value is PendingLetter => {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string' || c.id.length === 0) return false;
  if (typeof c.memoirId !== 'string' || c.memoirId.length === 0) return false;
  if (typeof c.body !== 'string' || c.body.trim().length === 0) return false;
  if (typeof c.composedAt !== 'number' || !Number.isFinite(c.composedAt)) return false;
  if (typeof c.deliverAt !== 'number' || !Number.isFinite(c.deliverAt)) return false;
  if (!isLetterStatus(c.status)) return false;
  if (
    c.lastAttemptAt !== undefined &&
    (typeof c.lastAttemptAt !== 'number' || !Number.isFinite(c.lastAttemptAt))
  ) {
    return false;
  }
  if (
    c.attempts !== undefined &&
    (typeof c.attempts !== 'number' || !Number.isFinite(c.attempts))
  ) {
    return false;
  }
  if (c.replyEntryId !== undefined && typeof c.replyEntryId !== 'string') return false;
  return true;
};

export const sanitizeLetter = (input: unknown): PendingLetter | null => {
  if (!looksLikeLetter(input)) return null;
  const trimmedBody = input.body.trim().slice(0, LETTER_BODY_MAX);
  if (trimmedBody.length === 0) return null;
  return {
    id: input.id,
    memoirId: input.memoirId,
    body: trimmedBody,
    composedAt: input.composedAt,
    deliverAt: input.deliverAt,
    status: input.status,
    lastAttemptAt: input.lastAttemptAt,
    attempts: input.attempts,
    replyEntryId: input.replyEntryId,
  };
};

export const hydrateLetters = (raw: unknown): PendingLetter[] => {
  if (!Array.isArray(raw)) return [];
  const out: PendingLetter[] = [];
  for (const item of raw) {
    const sane = sanitizeLetter(item);
    if (sane) out.push(sane);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  Mint                                                               */
/* ------------------------------------------------------------------ */

export interface MintLetterInput {
  memoirId: string;
  body: string;
  /** Delay between `now` and the planned delivery. Clamped to the
   *  `[MIN_DELAY_MS, MAX_DELAY_MS]` band before being applied. */
  delayMs: number;
  /** Provided for tests — defaults to `Date.now()`. */
  now?: number;
}

export type MintLetterResult = { ok: true; letter: PendingLetter } | { ok: false; reason: string };

export const mintLetter = (input: MintLetterInput): MintLetterResult => {
  if (!input.memoirId) return { ok: false, reason: 'missing-memoirId' };
  const body = (input.body ?? '').trim().slice(0, LETTER_BODY_MAX);
  if (body.length === 0) return { ok: false, reason: 'empty-body' };
  const now = input.now ?? Date.now();
  const delay = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, Math.floor(input.delayMs ?? 0)));
  const candidate: PendingLetter = {
    id: generateSecureId('letter'),
    memoirId: input.memoirId,
    body,
    composedAt: now,
    deliverAt: now + delay,
    status: 'pending',
  };
  const sane = sanitizeLetter(candidate);
  if (!sane) return { ok: false, reason: 'sanitisation-failed' };
  return { ok: true, letter: sane };
};

/* ------------------------------------------------------------------ */
/*  Lifecycle transitions (immutable updates)                          */
/* ------------------------------------------------------------------ */

const updateLetter = (
  letters: readonly PendingLetter[],
  id: string,
  patch: Partial<PendingLetter>,
): PendingLetter[] => {
  let found = false;
  const next = letters.map((l) => {
    if (l.id !== id) return l;
    found = true;
    return { ...l, ...patch };
  });
  return found ? Array.from(next) : Array.from(letters);
};

/** User cancels a pending letter. No-op if status is not `'pending'`
 *  (delivered / failed / already-cancelled letters can't be undone
 *  to pending — the user would need to compose a new letter). */
export const cancelLetter = (letters: readonly PendingLetter[], id: string): PendingLetter[] => {
  const target = letters.find((l) => l.id === id);
  if (!target || target.status !== 'pending') return Array.from(letters);
  return updateLetter(letters, id, { status: 'cancelled' });
};

/** Sweep transitions: mark a successful delivery → links the reply
 *  entry id back. */
export const markDelivered = (
  letters: readonly PendingLetter[],
  id: string,
  replyEntryId: string,
  now: number = Date.now(),
): PendingLetter[] =>
  updateLetter(letters, id, {
    status: 'delivered',
    replyEntryId,
    lastAttemptAt: now,
  });

/** Sweep transitions: record a failed attempt. Increments `attempts`;
 *  flips status to `'failed'` after `MAX_DELIVERY_ATTEMPTS`. */
export const markAttemptFailed = (
  letters: readonly PendingLetter[],
  id: string,
  now: number = Date.now(),
): PendingLetter[] => {
  const target = letters.find((l) => l.id === id);
  if (!target) return Array.from(letters);
  const attempts = (target.attempts ?? 0) + 1;
  return updateLetter(letters, id, {
    attempts,
    lastAttemptAt: now,
    status: attempts >= MAX_DELIVERY_ATTEMPTS ? 'failed' : 'pending',
  });
};

/* ------------------------------------------------------------------ */
/*  Selectors                                                          */
/* ------------------------------------------------------------------ */

/** Letters scoped to one Memoir, newest-composed-first. Used by the
 *  Settings letters view. */
export const listLettersForMemoir = (
  letters: readonly PendingLetter[],
  memoirId: string,
): PendingLetter[] =>
  letters.filter((l) => l.memoirId === memoirId).sort((a, b) => b.composedAt - a.composedAt);

/**
 * Letters that the Dashboard sweep should attempt to deliver right
 * now. Filters:
 *   - status === 'pending'
 *   - deliverAt <= now
 *   - belongs to a known Memoir (parameter `knownMemoirIds`); a
 *     letter whose Memoir was deleted by the user is silently
 *     skipped (the Memoir cascade hasn't run yet — a future GC
 *     sweep can hard-remove them).
 *   - back-off enforced when `lastAttemptAt` is set: subsequent
 *     attempts wait `2^attempts × 5min` before retry.
 */
const ATTEMPT_BACKOFF_BASE_MS = 1000 * 60 * 5;

export const dueLetters = (
  letters: readonly PendingLetter[],
  knownMemoirIds: ReadonlySet<string>,
  now: number = Date.now(),
): PendingLetter[] =>
  letters.filter((l) => {
    if (l.status !== 'pending') return false;
    if (l.deliverAt > now) return false;
    if (!knownMemoirIds.has(l.memoirId)) return false;
    if (l.lastAttemptAt !== undefined) {
      const attempts = l.attempts ?? 0;
      const backoff = ATTEMPT_BACKOFF_BASE_MS * Math.pow(2, attempts);
      if (now - l.lastAttemptAt < backoff) return false;
    }
    return true;
  });

/** Letters delivered within the last 24h that the user hasn't yet
 *  opened (proxied by: their reply entry exists). Used by the
 *  Dashboard `LetterArrivedCard` surface. */
export const recentlyDeliveredLetters = (
  letters: readonly PendingLetter[],
  now: number = Date.now(),
): PendingLetter[] =>
  letters
    .filter(
      (l) =>
        l.status === 'delivered' &&
        l.replyEntryId !== undefined &&
        l.lastAttemptAt !== undefined &&
        now - l.lastAttemptAt < 1000 * 60 * 60 * 24,
    )
    .sort((a, b) => (b.lastAttemptAt ?? 0) - (a.lastAttemptAt ?? 0));

/** Cascade: drop every letter belonging to a deleted Memoir. Same
 *  posture as `clearMemoirMemories` — bypasses the cancel
 *  lifecycle because the Memoir itself is gone. */
export const clearLettersForMemoir = (
  letters: readonly PendingLetter[],
  memoirId: string,
): PendingLetter[] => letters.filter((l) => l.memoirId !== memoirId);

/* ------------------------------------------------------------------ */
/*  Public field caps (re-exported for the UI character counters)      */
/* ------------------------------------------------------------------ */

export const LETTER_LIMITS = {
  body: LETTER_BODY_MAX,
  minDelayMs: MIN_DELAY_MS,
  maxDelayMs: MAX_DELAY_MS,
  maxAttempts: MAX_DELIVERY_ATTEMPTS,
} as const;
