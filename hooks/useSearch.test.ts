import { renderHook } from '@testing-library/react';
import { useSearch } from './useSearch';
import { DiaryEntry } from '../types';
import { describe, it, expect } from 'vitest';

const mockEntries: DiaryEntry[] = [
  {
    id: '1',
    title: 'Hello World',
    content: 'This is a test content',
    tags: ['tag1', 'tag2'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: '2',
    title: 'React is Great',
    content: 'Learning React testing',
    tags: ['react', 'testing'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLocked: false,
  },
];

describe('useSearch', () => {
  it('returns all entries when query is empty', () => {
    const { result } = renderHook(() => useSearch(mockEntries, ''));
    expect(result.current).toHaveLength(2);
  });

  it('filters by title', () => {
    const { result } = renderHook(() => useSearch(mockEntries, 'hello'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('filters by content', () => {
    const { result } = renderHook(() => useSearch(mockEntries, 'testing'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('2');
  });

  it('filters by tags', () => {
    const { result } = renderHook(() => useSearch(mockEntries, 'tag1'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('is case insensitive', () => {
    const { result } = renderHook(() => useSearch(mockEntries, 'WORLD'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('returns empty array if no matches', () => {
    const { result } = renderHook(() => useSearch(mockEntries, 'nonexistent'));
    expect(result.current).toHaveLength(0);
  });
});
