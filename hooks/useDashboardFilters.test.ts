import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardFilters } from './useDashboardFilters';
import type { DiaryEntry } from '../types';

const make = (id: string, overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id,
  title: id.toUpperCase(),
  content: `body of ${id}`,
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

const fixtures: DiaryEntry[] = [
  make('a', { tags: ['work'] }),
  make('b', { tags: ['life'], containerId: 'box1' }),
  make('c', { tags: ['life', 'work'] }),
  make('d', { isArchived: true, tags: ['work'] }),
];

describe('useDashboardFilters', () => {
  it('starts with default filters and exposes all derivations', () => {
    const { result } = renderHook(() => useDashboardFilters({ entries: fixtures }));
    expect(result.current.selectedTag).toBeNull();
    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.searchQuery).toBe('');
    // activeEntries excludes archived items
    expect(result.current.activeEntries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('setSelectedTag narrows baseFilteredEntries', () => {
    const { result } = renderHook(() => useDashboardFilters({ entries: fixtures }));
    act(() => result.current.setSelectedTag('life'));
    expect(result.current.baseFilteredEntries.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('setSelectedCategory excludes mismatching containerIds', () => {
    const { result } = renderHook(() => useDashboardFilters({ entries: fixtures }));
    act(() => result.current.setSelectedCategory('box1'));
    expect(result.current.baseFilteredEntries.map((e) => e.id)).toEqual(['b']);
  });

  it('searchQuery further narrows filteredEntries by content match', () => {
    const { result } = renderHook(() => useDashboardFilters({ entries: fixtures }));
    act(() => result.current.setSearchQuery('body of c'));
    expect(result.current.filteredEntries.map((e) => e.id)).toEqual(['c']);
  });

  it('combines tag + search predicates', () => {
    const { result } = renderHook(() => useDashboardFilters({ entries: fixtures }));
    act(() => result.current.setSelectedTag('work'));
    act(() => result.current.setSearchQuery('body of c'));
    expect(result.current.filteredEntries.map((e) => e.id)).toEqual(['c']);
  });
});
