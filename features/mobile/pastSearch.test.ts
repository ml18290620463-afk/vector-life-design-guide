import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import { getPastSearchMatch, searchPastEntries, searchPastEntriesWithMatchKind } from './pastSearch';

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

  it('appends a small same-theme recall after literal matches without changing multi-word search', () => {
    const exact = { ...entry('exact', 30), content: '今天感到焦虑' };
    const related = { ...entry('related', 20), content: '项目压力很大' };
    const unrelated = { ...entry('unrelated', 10), content: '今天散步了' };
    const entries = [exact, related, unrelated];

    expect(searchPastEntries(entries, '焦虑')).toEqual([exact, related]);
    expect(searchPastEntries(entries, '焦虑 项目')).toEqual([]);
    expect(entries).toEqual([exact, related, unrelated]);
  });
});

it('matches combined tags, supplements and link titles without changing chronology', () => {
  const original: DiaryEntry = {
    ...entry('e1', 10, ['工作']),
    supplements: [{ id: 's1', content: '补充的会议结论', createdAt: 200 }],
    nowMaterials: [
      {
        id: 'l',
        type: 'link',
        url: 'https://example.com/report',
        meta: { title: '项目报告' },
        sort_order: 0,
      },
    ],
  };
  expect(searchPastEntries([original], '工作 会议 报告')).toEqual([original]);
  expect(searchPastEntries([original], 'example.com')).toEqual([original]);
  expect(original.createdAt).toBe(10);
  expect(getPastSearchMatch(original, '会议')).toMatchObject({ target: 'supplement', id: 's1' });
  expect(getPastSearchMatch(original, '项目报告')).toMatchObject({ target: 'material', id: 'l' });
});

it('prioritizes exact tags and titles while preserving equal-rank chronology', () => {
  const body = { ...entry('recent', 40), content: '旅行' };
  const title = entry('旅行', 30);
  const tagged = entry('older', 20, ['事件:旅行']);
  const tied = entry('oldest', 10, ['旅行']);
  const source = [body, title, tagged, tied];
  expect(searchPastEntries(source, '旅行')).toEqual([tagged, tied, title, body]);
  expect(source).toEqual([body, title, tagged, tied]);
});
it('shows the supplement matching most query words', () => {
  const record = {
    ...entry('会议', 1),
    supplements: [{ id: 's', content: '会议 项目 结论', createdAt: 2 }],
  };
  expect(getPastSearchMatch(record, '会议 项目')).toMatchObject({
    target: 'supplement',
    id: 's',
    excerpt: '会议 项目 结论',
  });
});


it('marks literal and thematic results separately without changing the old search API', () => {
  const exact = { ...entry('exact', 30), content: '今天感到焦虑' };
  const related = { ...entry('related', 20), content: '项目压力很大' };
  const results = searchPastEntriesWithMatchKind([exact, related], '焦虑');
  expect(results).toEqual([
    { entry: exact, match: 'exact' },
    { entry: related, match: 'related' },
  ]);
  expect(searchPastEntries([exact, related], '焦虑')).toEqual([exact, related]);
  expect(searchPastEntriesWithMatchKind([exact, related], '焦虑 项目')).toEqual([]);
});
