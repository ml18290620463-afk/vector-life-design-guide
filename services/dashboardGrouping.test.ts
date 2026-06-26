import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../types';
import { TRANSLATIONS } from '../constants';
import { groupDashboardEntries, sortDashboardGroupKeys } from './dashboardGrouping';

const entry = (id: string, createdAt: number): DiaryEntry => ({
  id,
  title: id,
  content: '',
  createdAt,
  tags: [],
  isLocked: false,
});

describe('dashboardGrouping', () => {
  it('uses paginated entries when grouping is disabled', () => {
    const visible = [entry('visible', 1)];
    const hiddenByPage = [entry('hidden-by-page', 2)];

    const groups = groupDashboardEntries({
      filteredEntries: [visible[0], hiddenByPage[0]],
      paginatedEntries: visible,
      groupingMode: 'none',
      language: 'zh',
      labels: TRANSLATIONS.zh,
    });

    expect(groups.ALL).toEqual(visible);
  });

  it('groups by month and keeps newest entries first inside each group', () => {
    const older = entry('older', new Date(2025, 5, 10, 8).getTime());
    const newer = entry('newer', new Date(2025, 5, 20, 8).getTime());

    const groups = groupDashboardEntries({
      filteredEntries: [older, newer],
      paginatedEntries: [],
      groupingMode: 'month',
      language: 'zh',
      labels: TRANSLATIONS.zh,
    });

    expect(groups['2025年06月'].map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('sorts dated groups before unknown groups in descending chronological order', () => {
    const groups = {
      '🕒 未分类时间': [entry('unknown', 0)],
      '2024年': [entry('2024', new Date(2024, 0, 2).getTime())],
      '2025年': [entry('2025', new Date(2025, 0, 2).getTime())],
    };

    expect(sortDashboardGroupKeys(groups)).toEqual(['2025年', '2024年', '🕒 未分类时间']);
  });
});
