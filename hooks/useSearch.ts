import { useMemo } from 'react';
import { DiaryEntry } from '../types';

/**
 * Hook for memoized search functionality of diary entries
 * @param entries - The list of entries to filter
 * @param query - The search query string
 * @returns Filtered entries based on title, content, or tags
 */
export const useSearch = (entries: DiaryEntry[], query: string) => {
  return useMemo(() => {
    if (!query) return entries;
    const lowerQuery = query.toLowerCase();

    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(lowerQuery) ||
        e.content.toLowerCase().includes(lowerQuery) ||
        e.tags.some((t) => t.toLowerCase().includes(lowerQuery)),
    );
  }, [entries, query]);
};
