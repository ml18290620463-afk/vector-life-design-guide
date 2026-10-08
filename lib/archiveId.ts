import type { DiaryEntry } from '../types';

export const buildArchiveId = (entry: Pick<DiaryEntry, 'id' | 'createdAt'>): string => {
  const yearSuffix = new Date(entry.createdAt).getFullYear().toString().slice(2);
  return `AR-${yearSuffix}-${entry.id.slice(0, 4).toUpperCase()}`;
};
