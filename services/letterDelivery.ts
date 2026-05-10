import type { CustomPersona, DiaryEntry, PendingLetter } from '../types';
import { getMorningStarAnalysis } from './geminiService';

/**
 * Phase 4.5 §A (Letter Mode) — `services/letterDelivery.ts`
 *
 * Delivery pipeline for **写信模式** — turns one due `PendingLetter`
 * into a Memoir Morning Star reply, persists the result as a new
 * `DiaryEntry` (`isLetterReply: true`), and returns the verdict so
 * the caller can transition the letter's status.
 *
 * Why this lives in a service (not in the harvest hook):
 *   - The Dashboard mount sweep + a future Settings "deliver now"
 *     button both consume the same flow.
 *   - The function is mostly orchestration: it doesn't own the IDB
 *     stores; the consumer wires them in.
 *   - Keeping it pure-ish (one Morning Star call + one entry mint
 *     callback) makes it trivially testable with vi.fn() stubs.
 *
 * Privacy posture: the letter body flows through the same AI proxy
 * as a regular Morning Star round. The reply is stored locally as
 * a DiaryEntry — never on a server.
 */

export interface DeliverLetterArgs {
  letter: PendingLetter;
  /** The Memoir persona being addressed. Resolved by the caller
   *  from `customPersonas.find(p => p.id === letter.memoirId)`. */
  memoir: CustomPersona;
  /**
   * Persistence callback — given a `DiaryEntry` payload (without
   * id / createdAt — the entry mint will add them), persists and
   * returns the minted entry's id.
   *
   * The Dashboard wires this to a thin shim around
   * `useDiaryData.addEntry` that mints an id ahead of time so the
   * letter store can record a back-reference. See
   * `hooks/useDiaryData.addEntryWithId` (Phase 4.5 add).
   */
  mintReplyEntry: (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => Promise<string>;
  /** Optional `name → systemPrompt` map for the Memoir's persona
   *  prompt injection. Same shape as the rest of the Morning Star
   *  pipeline expects. */
  customPersonaPrompts?: Record<string, string>;
  /** Optional Memoir long-term recall override. The caller should
   *  pre-compute this with the letter body as the recall query. */
  memoirRecallByPersona?: Record<string, ReadonlyArray<{ body: string }>>;
  /** Provided for tests — defaults to the real Morning Star
   *  buffered fetcher. */
  fetcher?: typeof getMorningStarAnalysis;
}

export type DeliveryOutcome = { ok: true; replyEntryId: string } | { ok: false; reason: string };

/**
 * The "envelope" copy attached to the Morning Star prompt's
 * `entryContent` slot. We keep the user's actual letter in the
 * `reflection` slot (that is the field the Morning Star template
 * weights most heavily for the reply tone) and use a brief framing
 * sentence here so the model knows the context.
 */
const buildEnvelopeFraming = (memoirName: string, composedAtMs: number): string => {
  const date = new Date(composedAtMs).toISOString().slice(0, 10);
  return `用户写给「${memoirName}」的一封信(信件成稿日期 ${date})。请以 ${memoirName} 的口吻回信,称呼用户为「你」,语气尽量贴近你的记忆。`;
};

/**
 * Build the title for the reply DiaryEntry. Format:
 *   「来自 X 的信」 / "Letter from X"
 * The locale-specific phrasing should ideally come from i18n, but
 * the entries title is plain text used everywhere (export,
 * search, share-card) — keeping it Chinese-default + an English
 * suffix the consumer can swap is the cheapest first cut. The
 * Dashboard caller can override `titleOverride` if it wants
 * full locale-driven copy.
 */
const buildReplyTitle = (memoirName: string, composedAtMs: number): string => {
  const date = new Date(composedAtMs).toISOString().slice(0, 10);
  return `来自「${memoirName}」的回信 · ${date}`;
};

/**
 * Deliver one letter. Returns `{ ok: true, replyEntryId }` on
 * success, `{ ok: false, reason }` on the various failure modes.
 *
 * Failure reasons (callers should `markFailed` on `'ok: false'`,
 * NOT mutate the letter on `'ok: true'`):
 *   - `'persona-not-memoir'`  — the resolved persona isn't a
 *                                Memoir (defensive — should not
 *                                happen in production)
 *   - `'ai-unavailable'`      — Morning Star fetcher rejected
 *   - `'ai-empty-response'`   — Morning Star returned the
 *                                fallback / empty payload
 *   - `'persist-failed'`      — the entry-mint callback rejected
 */
export const deliverLetter = async (args: DeliverLetterArgs): Promise<DeliveryOutcome> => {
  const {
    letter,
    memoir,
    mintReplyEntry,
    customPersonaPrompts,
    memoirRecallByPersona,
    fetcher = getMorningStarAnalysis,
  } = args;

  if (memoir.kind !== 'memoir') {
    return { ok: false, reason: 'persona-not-memoir' };
  }

  const envelope = buildEnvelopeFraming(memoir.name, letter.composedAt);
  let aiResult: string;
  try {
    aiResult = await fetcher(
      envelope,
      letter.body,
      [memoir.name],
      customPersonaPrompts,
      memoirRecallByPersona,
    );
  } catch (err) {
    console.warn('letterDelivery: AI fetch threw', err);
    return { ok: false, reason: 'ai-unavailable' };
  }

  // Empty / fallback signature: `geminiService.MORNING_STAR_FALLBACK_PAYLOAD`
  // resolves to a JSON string that contains "星光指引中断". We only
  // need a soft heuristic — the parser downstream will still
  // accept it, but for letter mode we'd rather treat fallback as
  // a failure (so the user gets a retry on the next sweep, not a
  // depressing "the connection was unstable" reply pretending to
  // be from the Memoir).
  if (!aiResult || aiResult.includes('星光指引中断') || aiResult.includes('Morning Star')) {
    return { ok: false, reason: 'ai-empty-response' };
  }

  const title = buildReplyTitle(memoir.name, letter.composedAt);

  // The reply DiaryEntry is structured exactly like a regular
  // Morning Star analysis result so the existing Viewer renders
  // it without special-casing. The `isLetterReply` flag drives
  // the EntryGrid envelope badge + lets a future "show only
  // letter replies" filter work cheaply.
  const payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> = {
    title,
    content: letter.body,
    tags: ['letter-reply'],
    morningStarAnalysis: aiResult,
    morningStarPersonas: [memoir.name],
    reflection: letter.body,
    isLetterReply: true,
    letterId: letter.id,
  };

  let replyEntryId: string;
  try {
    replyEntryId = await mintReplyEntry(payload);
  } catch (err) {
    console.warn('letterDelivery: mintReplyEntry threw', err);
    return { ok: false, reason: 'persist-failed' };
  }
  if (!replyEntryId) return { ok: false, reason: 'persist-failed' };

  return { ok: true, replyEntryId };
};
