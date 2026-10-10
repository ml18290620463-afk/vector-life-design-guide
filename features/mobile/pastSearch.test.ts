import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import { searchPastEntries } from './pastSearch';

const entry = (id: string, createdAt: number, tags: string[] = []): DiaryEntry => ({
  id,
  title: id,
  content: `content ${id}`,
  createdAt,
  tags,
  isLocked: false,
});

describe('pastSearch', () => {
  it('matches labels and content case-insensitively with one query', () => {
    const entries = [entry('meeting', 1, ['工作事业']), entry('rest', 2, ['生活'])];
    expect(searchPastEntries(entries, ' 工作 ')).toEqual([entries[0]]);
    expect(searchPastEntries(entries, 'MEETING')).toEqual([entries[0]]);
    expect(searchPastEntries(entries, 'content rest')).toEqual([entries[1]]);
  });
  it('filters a large set deterministically without changing its source array', () => {
    const entries = Array.from({ length: 10_000 }, (_, index) =>
      entry(`entry-${index}`, index, index % 2 ? ['work'] : ['life']),
    );
    const original = [...entries];
    const result = searchPastEntries(entries, 'work');
    expect(result).toHaveLength(5_000);
    expect(result.every((item) => item.tags?.includes('work'))).toBe(true);
    expect(entries).toEqual(original);
  });

  it('keeps all records when the query is empty', () => {
    const entries = [entry('e1', 1), entry('e2', 2, ['work'])];
    expect(searchPastEntries(entries, '  ')).toEqual(entries);
    expect(searchPastEntries(entries, 'missing')).toEqual([]);
  });
});
