import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardGroupedEntries } from './useDashboardGroupedEntries';
import type { DiaryEntry } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

const t = {
  ungrouped: 'All Records',
  yearLabel: '{year}',
  monthLabel: '{month}',
  dayLabel: '{day}',
} as unknown as TranslationDictionary;

const makeEntry = (id: string, createdAt: number): DiaryEntry => ({
  id,
  title: id,
  content: id,
  createdAt,
  tags: [],
  isLocked: false,
});

const fixedEntries = Array.from({ length: 25 }, (_, i) =>
  makeEntry(`e${i}`, Date.UTC(2024, 0, i + 1)),
);

describe('useDashboardGroupedEntries', () => {
  it('starts with grouping=none and the first PAGE_SIZE slice', () => {
    const { result } = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries,
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
      }),
    );
    expect(result.current.groupingMode).toBe('none');
    expect(result.current.paginatedEntries).toHaveLength(10);
    expect(result.current.hasMore).toBe(true);
  });

  it('loadMore advances the page by one PAGE_SIZE', () => {
    const { result } = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries,
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
      }),
    );
    act(() => result.current.loadMore());
    expect(result.current.paginatedEntries).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    expect(result.current.paginatedEntries).toHaveLength(25);
    expect(result.current.hasMore).toBe(false);
  });

  it('setGroupingMode resets pagination AND scrolls to top', () => {
    const scroll = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scroll, configurable: true });

    const { result } = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries,
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
      }),
    );
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    expect(result.current.paginatedEntries).toHaveLength(25);

    act(() => result.current.setGroupingMode('year'));
    expect(result.current.groupingMode).toBe('year');
    expect(result.current.paginatedEntries).toHaveLength(10);
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('resets pagination when selectedTag changes', () => {
    const { result, rerender } = renderHook(
      ({ tag }: { tag: string | null }) =>
        useDashboardGroupedEntries({
          filteredEntries: fixedEntries,
          pageSize: 10,
          language: 'en',
          t,
          selectedTag: tag,
          selectedCategory: 'all',
        }),
      { initialProps: { tag: null as string | null } },
    );
    act(() => result.current.loadMore());
    expect(result.current.paginatedEntries).toHaveLength(20);

    rerender({ tag: 'work' });
    expect(result.current.paginatedEntries).toHaveLength(10);
  });

  it('switches to list view above the threshold (default 10)', () => {
    const small = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries.slice(0, 5),
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
      }),
    );
    expect(small.result.current.isListView).toBe(false);

    const big = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries,
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
      }),
    );
    expect(big.result.current.isListView).toBe(true);
  });

  it('honours an explicit listViewThreshold', () => {
    const { result } = renderHook(() =>
      useDashboardGroupedEntries({
        filteredEntries: fixedEntries,
        pageSize: 10,
        language: 'en',
        t,
        selectedTag: null,
        selectedCategory: 'all',
        listViewThreshold: 100,
      }),
    );
    expect(result.current.isListView).toBe(false);
  });
});
