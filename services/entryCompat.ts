import { DiaryEntry } from '../types';

export type LegacyDiaryEntry = Partial<DiaryEntry> & {
  name?: string;
  subject?: string;
  text?: string;
  body?: string;
  details?: string;
  date?: number;
  timestamp?: number;
  inMemoryBoat?: boolean;
  archived?: boolean;
  location?: string;
  // `isSample` already lives on `DiaryEntry` (Phase 4 §4.a-1), so the
  // `Partial<DiaryEntry>` intersection above already exposes it. No extra
  // declaration needed here.
};

export const asLegacyEntry = (entry: unknown): LegacyDiaryEntry =>
  entry && typeof entry === 'object' ? (entry as LegacyDiaryEntry) : {};

export const getEntryTimestamp = (entry: LegacyDiaryEntry) =>
  entry.createdAt || entry.timestamp || entry.date || 0;

export const getEntryTitle = (entry: LegacyDiaryEntry, fallback = 'Trace') =>
  entry.title || entry.subject || entry.name || fallback;

export const isMemoryBoatEntry = (entry: LegacyDiaryEntry) =>
  Boolean(
    entry.migrated ||
    entry.archivedToShip ||
    entry.inMemoryBoat ||
    entry.archived ||
    entry.location === 'memoryBoat',
  );

export const isMainVaultEntry = (entry: LegacyDiaryEntry) =>
  !entry.migrated &&
  !entry.archivedToShip &&
  !entry.inMemoryBoat &&
  !entry.archived &&
  entry.location !== 'memoryBoat';

/**
 * Phase 4 §4.a-1 — sample reflections seeded after onboarding all carry
 * `isSample: true`. We surface the predicate here (rather than checking
 * `entry.isSample` directly) so future heuristics (e.g. "id begins with
 * `sample-`") can be added in one place without touching every consumer.
 */
export const isSampleEntry = (entry: LegacyDiaryEntry) =>
  Boolean(entry.isSample) || (typeof entry.id === 'string' && entry.id.startsWith('sample-'));
