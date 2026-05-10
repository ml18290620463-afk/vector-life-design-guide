/**
 * Phase 4.5 follow-ups (F2) — Memoir cascade delete.
 *
 * When a user deletes a Memoir from `MemoryManagementPanel`, the
 * accompanying long-term memories AND any pending letters addressed
 * to it should disappear too. Otherwise:
 *
 *   - Memories become orphans (the memoir-id they reference no
 *     longer exists), which leaks storage and bloats backups.
 *   - Pending letters stay queued and the delivery sweep will skip
 *     them forever (the receiving memoir is gone), but they still
 *     show up in any future "letter history" view as "pending"
 *     even though they can never be delivered.
 *
 * The cascade is orchestrated at the App level (where all three
 * stores are mounted) by chaining the three `clear / delete`
 * primitives. This module is the pure orchestrator: it accepts
 * the three callbacks as args so it stays unit-testable without
 * mounting any hook.
 *
 * The cascade is **best-effort and partial-failure tolerant** —
 * each step has its own try/catch so a failure in one bucket
 * (e.g. letter clear fails because IDB is busy) doesn't poison
 * the others. The persona delete is the LAST step so if every
 * upstream cleanup fails, the user can re-trigger the cascade
 * by re-deleting the still-present persona.
 */

export interface CascadeDeleteMemoirArgs {
  memoirId: string;
  /** Wipe every Memoir memory belonging to this id. Wraps
   *  `useMemoryStore.clearForMemoir`. */
  clearMemories: (memoirId: string) => Promise<void> | void;
  /** Wipe every pending / delivered letter for this id. Wraps
   *  `useLetterStore.clearForMemoir`. */
  clearLetters: (memoirId: string) => Promise<void> | void;
  /** Finally, remove the persona record itself. Wraps
   *  `useCustomPersonas.deletePersona`. */
  deletePersona: (memoirId: string) => Promise<void> | void;
}

export interface CascadeDeleteMemoirOutcome {
  memoriesCleared: boolean;
  lettersCleared: boolean;
  personaDeleted: boolean;
  /** Tagged failure list (`memories` / `letters` / `persona`). Empty
   *  on a fully clean cascade. The wizard / panel surfaces these so
   *  the user knows whether to retry. */
  errors: Array<{ step: 'memories' | 'letters' | 'persona'; message: string }>;
}

const safelyMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Run the cascade. Returns an outcome describing which buckets
 * succeeded; never throws to the caller.
 *
 * Order is **memories → letters → persona** so that:
 *   - The persona is the LAST thing to disappear; if any earlier
 *     step fails, the user can retry by re-clicking "delete this
 *     memoir" because the persona is still there to anchor the UI.
 *   - Conversely, if the persona-delete itself fails (rare), the
 *     memory + letter buckets are already empty, so the next time
 *     the user retries it's a single-step operation.
 */
export const cascadeDeleteMemoir = async (
  args: CascadeDeleteMemoirArgs,
): Promise<CascadeDeleteMemoirOutcome> => {
  const outcome: CascadeDeleteMemoirOutcome = {
    memoriesCleared: false,
    lettersCleared: false,
    personaDeleted: false,
    errors: [],
  };

  try {
    await args.clearMemories(args.memoirId);
    outcome.memoriesCleared = true;
  } catch (err) {
    outcome.errors.push({ step: 'memories', message: safelyMessage(err) });
  }

  try {
    await args.clearLetters(args.memoirId);
    outcome.lettersCleared = true;
  } catch (err) {
    outcome.errors.push({ step: 'letters', message: safelyMessage(err) });
  }

  try {
    await args.deletePersona(args.memoirId);
    outcome.personaDeleted = true;
  } catch (err) {
    outcome.errors.push({ step: 'persona', message: safelyMessage(err) });
  }

  return outcome;
};
