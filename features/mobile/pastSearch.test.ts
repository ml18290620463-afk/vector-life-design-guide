import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import { availablePastTags, filterPastEntries } from './pastSearch';

const entry = (id: string, createdAt: number, tags: string[] = []): DiaryEntry => ({
  id,
  title: id,
  content: `content ${id}`,
  createdAt,
  tags,
  isLocked: false,
});

describe('pastSearch', () => {
  it('filters a large set deterministically without changing its source array', () => {
    const entries = Array.from({ length: 10_000 }, (_, index) =>
      entry(`entry-${index}`, index, index % 2 ? ['work'] : ['life']),
    );
    const original = [...entries];
    const result = filterPastEntries(entries, { tags: ['work'] });
    expect(result).toHaveLength(5_000);
    expect(result.every((item) => item.tags?.includes('work'))).toBe(true);
    expect(entries).toEqual(original);
    expect(availablePastTags(entries)).toEqual(['life', 'work']);
  });

  it('keeps all records when no tag is selected', () => {
    const entries = [entry('e1', 1), entry('e2', 2, ['work'])];
    expect(filterPastEntries(entries, {})).toEqual(entries);
    expect(filterPastEntries(entries, { tags: ['missing'] })).toEqual([]);
  });
});
