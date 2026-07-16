import type { DiaryEntry } from '../types';

export const updateRelatedEntryIds = (
  entries: DiaryEntry[],
  entryId: string,
  relatedEntryIds: string[],
  now = Date.now(),
): DiaryEntry[] => {
  const normalizedIds = [...new Set(relatedEntryIds.filter((id) => id && id !== entryId))];
  return entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          relatedEntryIds: normalizedIds.length > 0 ? normalizedIds : undefined,
          updatedAt: now,
        }
      : entry,
  );
};
