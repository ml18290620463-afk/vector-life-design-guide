import { useCallback, useEffect, useMemo, useState } from 'react';
import { DiaryEntry, GroupingMode, Language } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { groupDashboardEntries, sortDashboardGroupKeys } from '../services/dashboardGrouping';

interface UseDashboardGroupedEntriesOptions {
  /** Entries already passed through filter + search; the hook just
   *  paginates and groups them. */
  filteredEntries: DiaryEntry[];
  /** Page size used by the "load more records" pagination. */
  pageSize: number;
  /** Inputs to the date-bucket grouping helpers. */
  language: Language;
  t: TranslationDictionary;
  /** External filter signals — when any of these change we reset
   *  pagination so the user lands on the freshly-filtered first page. */
  selectedTag: string | null;
  selectedCategory: 'all' | 'uncategorized' | string;
  /**
   * Threshold above which the dashboard switches from the visual
   * EntryGrid to the dense VaultListView. 10 was the inline magic
   * number in the original Dashboard; surfaced as a parameter so
   * tests can drive it deterministically.
   */
  listViewThreshold?: number;
}

export interface DashboardGroupedEntriesState {
  /** Current grouping bucket. */
  groupingMode: GroupingMode;
  /** Wraps setGroupingMode + page reset + smooth scroll-to-top so
   *  consumers don't have to remember all three. */
  setGroupingMode: (mode: GroupingMode) => void;
  /** Visible slice (filteredEntries[0..currentPage*pageSize]). */
  paginatedEntries: DiaryEntry[];
  /** True while there are more entries beyond the current page. */
  hasMore: boolean;
  /** Advance to the next page. */
  loadMore: () => void;
  /** filteredEntries grouped by year/month/day per `groupingMode`. */
  groupedEntries: Record<string, DiaryEntry[]>;
  /** Stable, sort-aware list of keys for the iterator. */
  groupKeys: string[];
  /** True when the dataset is large enough that EntryGrid should
   *  switch to the more-information-dense VaultListView. */
  isListView: boolean;
}

/**
 * Owns the dashboard's pagination + grouping state machine. Lifted out
 * of Dashboard.tsx as part of Phase 2 §2.h tail to push the surface
 * past the 350-LOC ROADMAP target.
 *
 * Pagination is reset to page 1 whenever the language, tag, category
 * or grouping mode changes; this keeps the user from landing on an
 * "empty page 4" after they switch filters.
 */
export const useDashboardGroupedEntries = ({
  filteredEntries,
  pageSize,
  language,
  t,
  selectedTag,
  selectedCategory,
  listViewThreshold = 10,
}: UseDashboardGroupedEntriesOptions): DashboardGroupedEntriesState => {
  const [currentPage, setCurrentPage] = useState(1);
  const [groupingMode, setGroupingModeRaw] = useState<GroupingMode>('none');

  useEffect(() => {
    setCurrentPage(1);
  }, [language, selectedTag, selectedCategory, groupingMode]);

  const setGroupingMode = useCallback((mode: GroupingMode) => {
    setGroupingModeRaw(mode);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const paginatedEntries = useMemo(
    () => filteredEntries.slice(0, currentPage * pageSize),
    [filteredEntries, currentPage, pageSize],
  );

  const hasMore = paginatedEntries.length < filteredEntries.length;

  const loadMore = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  const groupedEntries = useMemo(
    () =>
      groupDashboardEntries({
        filteredEntries,
        paginatedEntries,
        groupingMode,
        language,
        labels: t,
      }),
    [filteredEntries, paginatedEntries, groupingMode, language, t],
  );

  const groupKeys = useMemo(() => sortDashboardGroupKeys(groupedEntries), [groupedEntries]);

  const isListView = filteredEntries.length > listViewThreshold;

  return {
    groupingMode,
    setGroupingMode,
    paginatedEntries,
    hasMore,
    loadMore,
    groupedEntries,
    groupKeys,
    isListView,
  };
};
