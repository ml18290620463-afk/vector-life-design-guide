import type { AvatarUnderstandingStatus, AvatarUnderstandingVersion, PastPatternDomain } from '../features/avatar/types';
import { getStoredJson, setStoredJson, hasMeaningfulStatementChange, isRecord, stableAvatarId } from './avatarMemoryShared';

const UNDERSTANDING_KEY = 'vector:avatar:understandings:v1';
const UNDERSTANDING_STATUSES = new Set<AvatarUnderstandingStatus>(['pending', 'confirmed', 'rejected', 'superseded']);
const PAST_PATTERN_DOMAINS = new Set<PastPatternDomain>(['cognitive', 'behavioral', 'emotional', 'relational', 'coping', 'motivational']);

export const sanitizeAvatarUnderstandings = (value: unknown): AvatarUnderstandingVersion[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.id !== 'string' ||
      typeof item.statement !== 'string' ||
      !UNDERSTANDING_STATUSES.has(item.status as AvatarUnderstandingStatus) ||
      typeof item.createdAt !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        statement: item.statement,
        status: item.status as AvatarUnderstandingStatus,
        sourceEntryIds: Array.isArray(item.sourceEntryIds)
          ? item.sourceEntryIds.filter((id): id is string => typeof id === 'string')
          : [],
        createdAt: item.createdAt,
        ...(typeof item.updatedAt === 'number' ? { updatedAt: item.updatedAt } : {}),
        ...(typeof item.confirmedAt === 'number' ? { confirmedAt: item.confirmedAt } : {}),
        ...(item.confirmedBy === 'user' ? { confirmedBy: item.confirmedBy } : {}),
        ...(item.summaryKind === 'past-pattern' ? { summaryKind: item.summaryKind } : {}),
        ...(typeof item.previousVersionId === 'string'
          ? { previousVersionId: item.previousVersionId }
          : {}),
        ...(PAST_PATTERN_DOMAINS.has(item.patternDomain as PastPatternDomain)
          ? { patternDomain: item.patternDomain as PastPatternDomain }
          : {}),
        ...(typeof item.patternLabel === 'string' ? { patternLabel: item.patternLabel } : {}),
        ...(typeof item.trigger === 'string' ? { trigger: item.trigger } : {}),
        ...(typeof item.response === 'string' ? { response: item.response } : {}),
        ...(typeof item.outcome === 'string' ? { outcome: item.outcome } : {}),
        ...(item.retainedAfterSourceDeletion === true ? { retainedAfterSourceDeletion: true } : {}),
      },
    ];
  });
};

export const readAvatarUnderstandings = (): AvatarUnderstandingVersion[] =>
  sanitizeAvatarUnderstandings(getStoredJson<unknown>(UNDERSTANDING_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

export interface PruneAvatarUnderstandingsResult {
  removedPatternIds: string[];
  understandings: AvatarUnderstandingVersion[];
}

/**
 * Removes deleted diary records from pattern evidence. Patterns whose complete
 * evidence set was deleted are removed; patterns with remaining evidence are
 * retained with their source list repaired.
 */
export const pruneAvatarUnderstandingsByEntryIds = (
  entryIds: Iterable<string>,
  retainOrphans = false,
  persist = true,
): PruneAvatarUnderstandingsResult => {
  const idsToDelete = new Set(entryIds);
  const current = readAvatarUnderstandings();
  if (idsToDelete.size === 0) return { removedPatternIds: [], understandings: current };

  const removedPatternIds: string[] = [];
  const understandings = current.flatMap((understanding) => {
    if (understanding.sourceEntryIds.length === 0) return [understanding];
    const remainingSourceIds = understanding.sourceEntryIds.filter(
      (entryId) => !idsToDelete.has(entryId),
    );
    if (remainingSourceIds.length === understanding.sourceEntryIds.length) return [understanding];
    if (remainingSourceIds.length === 0) {
      if (retainOrphans) {
        return [
          {
            ...understanding,
            sourceEntryIds: [],
            retainedAfterSourceDeletion: true,
            updatedAt: Date.now(),
          },
        ];
      }
      removedPatternIds.push(understanding.id);
      return [];
    }
    return [{ ...understanding, sourceEntryIds: remainingSourceIds, updatedAt: Date.now() }];
  });

  if (persist && !setStoredJson(UNDERSTANDING_KEY, understandings))
    throw new Error('模式关联保存失败，请重试');
  return { removedPatternIds, understandings };
};

/** Repairs legacy/orphaned pattern evidence against the records that still exist. */
export const reconcileAvatarUnderstandingsWithEntries = (
  validEntryIds: Iterable<string>,
): PruneAvatarUnderstandingsResult => {
  const validIds = new Set(validEntryIds);
  const missingIds = new Set<string>();
  readAvatarUnderstandings().forEach((understanding) => {
    understanding.sourceEntryIds.forEach((entryId) => {
      if (!validIds.has(entryId)) missingIds.add(entryId);
    });
  });
  return pruneAvatarUnderstandingsByEntryIds(missingIds);
};

export const writeAvatarUnderstanding = (version: AvatarUnderstandingVersion): boolean => {
  const current = readAvatarUnderstandings();
  const now = Date.now();
  const next = current
    .filter((item) => item.id !== version.id)
    .map((item) =>
      // A newly confirmed observation is another pattern, not a replacement
      // for every prior pattern.  Only an explicit version link is allowed to
      // retire the exact wording it replaces.
      version.status === 'confirmed' &&
      item.status === 'confirmed' &&
      version.previousVersionId === item.id
        ? { ...item, status: 'superseded' as const, updatedAt: now }
        : item,
    );
  const saved = setStoredJson(UNDERSTANDING_KEY, [version, ...next].slice(0, 100));
  return saved;
};

export const updateAvatarUnderstandingStatus = (
  id: string,
  status: AvatarUnderstandingStatus,
  statement?: string,
): AvatarUnderstandingVersion | null => {
  const current = readAvatarUnderstandings();
  const existing = current.find((item) => item.id === id);
  const target = existing && {
    ...existing,
    ...(statement?.trim() ? { statement: statement.trim() } : {}),
  };
  if (!target) return null;
  // A confirmed pattern must never be edited in place.  Route legacy callers
  // through the same successor flow used by the archive UI, so every wording
  // change has one clear version relationship and can appear in “我的变化”.
  if (
    existing.status === 'confirmed' &&
    status === 'confirmed' &&
    existing.statement !== target.statement
  ) {
    return supersedeAvatarUnderstanding(id, target.statement);
  }

  const now = Date.now();
  const updated =
    status === 'confirmed'
      ? {
          ...target,
          status,
          updatedAt: now,
          confirmedAt: target.confirmedAt ?? now,
          confirmedBy: target.confirmedBy ?? ('user' as const),
          summaryKind: target.summaryKind ?? ('past-pattern' as const),
        }
      : { ...target, status, updatedAt: now };
  const saved = setStoredJson(
    UNDERSTANDING_KEY,
    current.map((item) => (item.id === id ? updated : item)),
  );
  return saved ? updated : null;
};

/**
 * A confirmed pattern is a long-term, user-reviewed understanding.  Revising
 * its wording creates an explicit successor instead of overwriting the
 * previous observation, so the change can remain visible in "我的变化".
 */
export const supersedeAvatarUnderstanding = (
  id: string,
  statement: string,
): AvatarUnderstandingVersion | null => {
  const text = statement.trim();
  if (!text) return null;

  const current = readAvatarUnderstandings();
  const existing = current.find((item) => item.id === id);
  if (!existing || existing.status !== 'confirmed') return null;
  if (!hasMeaningfulStatementChange(existing.statement, text)) return existing;

  const now = Date.now();
  const replacement: AvatarUnderstandingVersion = {
    ...existing,
    id: stableAvatarId('pattern_version', [existing.id, text, now]),
    statement: text,
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    confirmedBy: 'user',
    summaryKind: 'past-pattern',
    previousVersionId: existing.id,
  };
  const previous: AvatarUnderstandingVersion = {
    ...existing,
    status: 'superseded',
    updatedAt: now,
  };
  const saved = setStoredJson(
    UNDERSTANDING_KEY,
    [replacement, previous, ...current.filter((item) => item.id !== existing.id)].slice(0, 100),
  );
  return saved ? replacement : null;
};
