import type { DiaryEntry } from '../types';

/** Pure access predicate shared by server rules and browser privacy snapshots. */
export const canAIReadEntry = (entry: DiaryEntry, now = Date.now()) =>
  entry.aiVisibility === 'allowed' &&
  !entry.isSample &&
  !entry.isLocked &&
  !entry.isEncrypted &&
  (!entry.unlockAt || entry.unlockAt <= now);
