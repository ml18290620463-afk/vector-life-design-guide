import { DiaryEntry } from '../types';

export const getActiveDashboardEntries = (entries: DiaryEntry[]) =>
  entries.filter((entry) => !entry.isArchived);
