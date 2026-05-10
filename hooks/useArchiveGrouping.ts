import { useMemo, useState } from 'react';
import type { DiaryEntry, GroupingMode } from '../types';
import { useSearch } from './useSearch';
import { asLegacyEntry, getEntryTimestamp, isMemoryBoatEntry } from '../services/entryCompat';

export type ArchiveGroupingMode = Exclude<GroupingMode, 'none'>;

export type CategoryFilter = 'all' | 'uncategorized' | string;

export interface UseArchiveGroupingArgs {
  entries: DiaryEntry[];
  /** Optional initial grouping. Defaults to `'year'`. */
  initialGroupingMode?: ArchiveGroupingMode;
}

export interface ArchiveGrouping {
  /** All entries that count as "memory boat" (archived OR in memory boat
   *  OR `location === "memoryBoat"`), sorted newest-first by entry timestamp. */
  archivedEntriesBase: DiaryEntry[];
  /** `archivedEntriesBase` after `selectedCategory` + `selectedTag` filters
   *  but BEFORE the search-text filter. */
  baseFilteredEntries: DiaryEntry[];
  /** `baseFilteredEntries` after the search-text filter. */
  archivedEntries: DiaryEntry[];
  /** Year / month / day buckets keyed off `entry.createdAt`. */
  groupedEntries: Record<string, DiaryEntry[]>;
  /** Bucket keys, sorted descending so the newest year/month/day appears first. */
  groupKeys: string[];
  /** Current grouping mode. */
  groupingMode: ArchiveGroupingMode;
  setGroupingMode: (mode: ArchiveGroupingMode) => void;
  /** Search text + tag + category controls. */
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedCategory: CategoryFilter;
  setSelectedCategory: (category: CategoryFilter) => void;
}

const buildBucketKey = (entry: DiaryEntry, mode: ArchiveGroupingMode): string => {
  const date = new Date(entry.createdAt);
  if (mode === 'year') return date.getFullYear().toString();
  if (mode === 'month') {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

/**
 * Owns the ArchiveVault's "filter the memory boat → group by year/month
 * /day → expose stable keys" pipeline.
 *
 *  - `archivedEntriesBase`: stable-sorted superset (input for FilterHub).
 *  - `baseFilteredEntries`: tag + category filters applied, search NOT yet.
 *  - `archivedEntries`: search applied on top.
 *  - `groupedEntries` / `groupKeys`: bucketed output for the renderer.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const useArchiveGrouping = ({
  entries,
  initialGroupingMode = 'year',
}: UseArchiveGroupingArgs): ArchiveGrouping => {
  const [groupingMode, setGroupingMode] = useState<ArchiveGroupingMode>(initialGroupingMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  const archivedEntriesBase = useMemo(() => {
    return entries
      .filter((entry) => isMemoryBoatEntry(asLegacyEntry(entry)))
      .sort((a, b) => {
        const timeA = getEntryTimestamp(asLegacyEntry(a));
        const timeB = getEntryTimestamp(asLegacyEntry(b));
        return timeB - timeA;
      });
  }, [entries]);

  const baseFilteredEntries = useMemo(() => {
    let result = archivedEntriesBase;
    if (selectedCategory === 'uncategorized') {
      result = result.filter((e) => !e.containerId);
    } else if (selectedCategory !== 'all') {
      result = result.filter((e) => e.containerId === selectedCategory);
    }
    if (selectedTag) {
      result = result.filter((e) => e.tags.includes(selectedTag));
    }
    return result;
  }, [archivedEntriesBase, selectedCategory, selectedTag]);

  const archivedEntries = useSearch(baseFilteredEntries, searchQuery);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    archivedEntries.forEach((entry) => {
      const key = buildBucketKey(entry, groupingMode);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return groups;
  }, [archivedEntries, groupingMode]);

  const groupKeys = useMemo(
    () => Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a)),
    [groupedEntries],
  );

  return {
    archivedEntriesBase,
    baseFilteredEntries,
    archivedEntries,
    groupedEntries,
    groupKeys,
    groupingMode,
    setGroupingMode,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    selectedCategory,
    setSelectedCategory,
  };
};
