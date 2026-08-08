import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../types';
import { getActiveDashboardEntries } from './dashboardFilters';

const entry = (overrides: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'entry',
  title: 'Entry',
  content: '',
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

describe('dashboardFilters', () => {
  it('returns all records, including entries with the legacy archived flag', () => {
    const entries = [entry({ id: 'active' }), entry({ id: 'archived', isArchived: true })];

    expect(getActiveDashboardEntries(entries).map((item) => item.id)).toEqual(['active', 'archived']);
  });
});
