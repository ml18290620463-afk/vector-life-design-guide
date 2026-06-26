import { useMemo, useState } from 'react';
import { DiaryEntry } from '../types';
import { getActiveDashboardEntries, getBaseDashboardEntries } from '../services/dashboardFilters';
import { useSearch } from './useSearch';

interface UseDashboardFiltersOptions {
  entries: DiaryEntry[];
}

export interface DashboardFiltersState {
  /** Currently selected tag pill, or null for "all". */
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  /** Selected category bucket; 'all', 'uncategorized', or a container id. */
  selectedCategory: 'all' | 'uncategorized' | string;
  setSelectedCategory: (category: 'all' | 'uncategorized' | string) => void;
  /** Search query string. */
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Entries that should be considered "active" for filter UI (e.g.
   *  excludes archived). Memoised on `entries`. */
  activeEntries: DiaryEntry[];
  /** Entries narrowed by tag + category, before search. Memoised. */
  baseFilteredEntries: DiaryEntry[];
  /** Final visible list — base entries narrowed by `searchQuery`. */
  filteredEntries: DiaryEntry[];
}

/**
 * Owns the dashboard's tag + category + search filter state and the
 * three derived collections (active / base-filtered / search-filtered).
 *
 * Lifted out of Dashboard.tsx as part of Phase 2 §2.h micro-step so
 * the Dashboard surface keeps approaching the 350-LOC ROADMAP target.
 * Pure projection — no side effects; the dashboard chrome still owns
 * `showFilterHub` because it interacts with overlay z-index that the
 * filter inputs themselves don't care about.
 */
export const useDashboardFilters = ({
  entries,
}: UseDashboardFiltersOptions): DashboardFiltersState => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'uncategorized' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeEntries = useMemo(() => getActiveDashboardEntries(entries), [entries]);

  const baseFilteredEntries = useMemo(
    () => getBaseDashboardEntries({ entries, selectedTag, selectedCategory }),
    [entries, selectedCategory, selectedTag],
  );

  const filteredEntries = useSearch(baseFilteredEntries, searchQuery);

  return {
    selectedTag,
    setSelectedTag,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    activeEntries,
    baseFilteredEntries,
    filteredEntries,
  };
};
