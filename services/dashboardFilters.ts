import { DiaryEntry } from '../types';
import { asLegacyEntry, isMainVaultEntry } from './entryCompat';

export type DashboardCategoryFilter = 'all' | 'uncategorized' | string;

interface GetBaseFilteredEntriesArgs {
  entries: DiaryEntry[];
  selectedTag: string | null;
  selectedCategory: DashboardCategoryFilter;
}

export const getActiveDashboardEntries = (entries: DiaryEntry[]) =>
  entries.filter((entry) => !entry.isArchived);

export const getBaseDashboardEntries = ({
  entries,
  selectedTag,
  selectedCategory,
}: GetBaseFilteredEntriesArgs) => {
  let result = entries.filter(
    (entry) => !entry.isArchived && isMainVaultEntry(asLegacyEntry(entry)),
  );

  if (selectedTag) {
    result = result.filter((entry) => entry.tags?.includes(selectedTag));
  }

  if (selectedCategory === 'uncategorized') {
    result = result.filter((entry) => !entry.containerId);
  } else if (selectedCategory !== 'all') {
    result = result.filter((entry) => entry.containerId === selectedCategory);
  }

  return result;
};
