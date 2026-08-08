import { DiaryEntry } from '../types';

// Legacy archived records now belong to the same unified record timeline.
export const getActiveDashboardEntries = (entries: DiaryEntry[]) => entries;
