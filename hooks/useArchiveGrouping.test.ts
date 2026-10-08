import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useArchiveGrouping } from './useArchiveGrouping';
import type { DiaryEntry } from '../types';

// `isMemoryBoatEntry` (the gate inside the hook) checks the legacy
// `archived` flag, not `DiaryEntry.isArchived` — see
// `services/entryCompat.ts`. Test fixtures therefore set both via a
// loose cast so the hook's filter actually fires.
type ArchivableEntry = DiaryEntry & { archived?: boolean };

const baseEntry = (overrides: Partial<ArchivableEntry> = {}): DiaryEntry => {
  const entry: ArchivableEntry = {
    id: 'e',
    title: 'T',
    content: 'B',
    createdAt: Date.UTC(2025, 0, 1),
    tags: [],
    isLocked: false,
    ...overrides,
  };
  // Mirror `isArchived` to the legacy `archived` field so the
  // memory-boat filter inside `useArchiveGrouping` recognises it.
  if (entry.isArchived) entry.archived = true;
  return entry as DiaryEntry;
};

describe('useArchiveGrouping', () => {
  it('keeps only memory-boat entries (archived OR inMemoryBoat) in the base list', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'a', isArchived: true }),
      baseEntry({ id: 'b', isArchived: false }),
      baseEntry({ id: 'c', isArchived: true }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    expect(result.current.archivedEntriesBase.map((e) => e.id).sort()).toEqual(['a', 'c']);
  });

  it('sorts the base list newest-first by entry timestamp', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'old', isArchived: true, createdAt: Date.UTC(2023, 0, 1) }),
      baseEntry({ id: 'new', isArchived: true, createdAt: Date.UTC(2026, 0, 1) }),
      baseEntry({ id: 'mid', isArchived: true, createdAt: Date.UTC(2024, 0, 1) }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    expect(result.current.archivedEntriesBase.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('selectedCategory="uncategorized" filters out entries with a containerId', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'a', isArchived: true, containerId: 'box-1' }),
      baseEntry({ id: 'b', isArchived: true }),
      baseEntry({ id: 'c', isArchived: true, containerId: 'box-2' }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    act(() => result.current.setSelectedCategory('uncategorized'));
    expect(result.current.baseFilteredEntries.map((e) => e.id)).toEqual(['b']);
  });

  it('selectedTag filter returns only entries that include the tag', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'a', isArchived: true, tags: ['alpha', 'beta'] }),
      baseEntry({ id: 'b', isArchived: true, tags: ['beta'] }),
      baseEntry({ id: 'c', isArchived: true, tags: ['gamma'] }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    act(() => result.current.setSelectedTag('beta'));
    expect(result.current.baseFilteredEntries.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('groups by year and exposes descending-sorted groupKeys', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'a', isArchived: true, createdAt: Date.UTC(2023, 5, 1) }),
      baseEntry({ id: 'b', isArchived: true, createdAt: Date.UTC(2024, 5, 1) }),
      baseEntry({ id: 'c', isArchived: true, createdAt: Date.UTC(2024, 1, 1) }),
      baseEntry({ id: 'd', isArchived: true, createdAt: Date.UTC(2025, 8, 1) }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    expect(result.current.groupKeys).toEqual(['2025', '2024', '2023']);
    expect(result.current.groupedEntries['2024'].map((e) => e.id).sort()).toEqual(['b', 'c']);
  });

  it('switching grouping to "month" rebuckets without losing entries', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'jan', isArchived: true, createdAt: Date.UTC(2025, 0, 15) }),
      baseEntry({ id: 'feb', isArchived: true, createdAt: Date.UTC(2025, 1, 5) }),
      baseEntry({ id: 'feb2', isArchived: true, createdAt: Date.UTC(2025, 1, 28) }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    act(() => result.current.setGroupingMode('month'));
    expect(result.current.groupKeys.sort().reverse()).toEqual(['2025-02', '2025-01']);
    expect(result.current.groupedEntries['2025-02']).toHaveLength(2);
  });

  it('search filter narrows on top of category + tag', () => {
    const entries: DiaryEntry[] = [
      baseEntry({ id: 'a', isArchived: true, title: 'Alpha story', tags: ['t1'] }),
      baseEntry({ id: 'b', isArchived: true, title: 'Beta story', tags: ['t1'] }),
      baseEntry({ id: 'c', isArchived: true, title: 'Beta narrative', tags: ['t1'] }),
    ];
    const { result } = renderHook(() => useArchiveGrouping({ entries }));
    act(() => result.current.setSelectedTag('t1'));
    act(() => result.current.setSearchQuery('beta'));
    expect(result.current.archivedEntries.map((e) => e.id).sort()).toEqual(['b', 'c']);
  });
});
