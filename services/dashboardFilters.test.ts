import { describe, expect, it } from 'vitest';
import { DiaryEntry } from '../types';
import { getActiveDashboardEntries, getBaseDashboardEntries } from './dashboardFilters';

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
  it('returns non-archived entries for active dashboard surfaces', () => {
    const entries = [entry({ id: 'active' }), entry({ id: 'archived', isArchived: true })];

    expect(getActiveDashboardEntries(entries).map((item) => item.id)).toEqual(['active']);
  });

  it('excludes memory boat and archived entries from the main vault', () => {
    const entries = [
      entry({ id: 'main' }),
      entry({ id: 'boat', archivedToShip: true }),
      entry({ id: 'archived', isArchived: true }),
    ];

    expect(
      getBaseDashboardEntries({ entries, selectedTag: null, selectedCategory: 'all' }).map(
        (item) => item.id,
      ),
    ).toEqual(['main']);
  });

  it('applies tag and container filters together', () => {
    const entries = [
      entry({ id: 'match', tags: ['focus'], containerId: 'container-a' }),
      entry({ id: 'wrong-tag', tags: ['other'], containerId: 'container-a' }),
      entry({ id: 'wrong-container', tags: ['focus'], containerId: 'container-b' }),
    ];

    expect(
      getBaseDashboardEntries({
        entries,
        selectedTag: 'focus',
        selectedCategory: 'container-a',
      }).map((item) => item.id),
    ).toEqual(['match']);
  });

  it('can isolate uncategorized entries', () => {
    const entries = [entry({ id: 'loose' }), entry({ id: 'packed', containerId: 'container-a' })];

    expect(
      getBaseDashboardEntries({
        entries,
        selectedTag: null,
        selectedCategory: 'uncategorized',
      }).map((item) => item.id),
    ).toEqual(['loose']);
  });
});
