import type { DiaryEntry } from '../../types';

export interface PastSearchFilters {
  tags?: string[];
}

/** Returns existing user labels only. */
export const availablePastTags = (entries: DiaryEntry[]) =>
  [...new Set(entries.flatMap((entry) => (Array.isArray(entry.tags) ? entry.tags : [])))].sort(
    (left, right) => left.localeCompare(right),
  );

/** Narrows text search results by user-selected tags. */
export const filterPastEntries = (
  entries: DiaryEntry[],
  filters: PastSearchFilters,
): DiaryEntry[] => {
  const tags = new Set(filters.tags?.filter(Boolean) ?? []);
  return entries.filter((entry) => !tags.size || (entry.tags ?? []).some((tag) => tags.has(tag)));
};
