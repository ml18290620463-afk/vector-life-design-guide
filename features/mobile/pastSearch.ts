import type { DiaryEntry } from '../../types';

const safeText = (value: unknown) => (typeof value === 'string' ? value : '');

/** Searches record content and labels through the same query. */
export const searchPastEntries = (entries: DiaryEntry[], query: string): DiaryEntry[] => {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return entries;
  const matches = (value: unknown) => safeText(value).toLocaleLowerCase().includes(normalized);
  return entries.filter(
    (entry) =>
      matches(entry.title) ||
      matches(entry.content) ||
      (Array.isArray(entry.tags) && entry.tags.some(matches)) ||
      (entry.nowMaterials ?? []).some((material) => matches(material.description)),
  );
};
