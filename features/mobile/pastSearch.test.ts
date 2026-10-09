import { describe, expect, it } from 'vitest';
import type { ActionItem, DiaryEntry, Principle } from '../../types';
import { availablePastTags, buildDeterministicReview, filterPastEntries } from './pastSearch';

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
    const result = filterPastEntries(entries, { tags: ['work'], from: 200, to: 210 });
    expect(result.map((item) => item.id)).toEqual([
      'entry-201',
      'entry-203',
      'entry-205',
      'entry-207',
      'entry-209',
    ]);
    expect(entries).toEqual(original);
    expect(availablePastTags(entries)).toEqual(['life', 'work']);
  });

  it('finds records linked through persisted actions and principles', () => {
    const entries = [entry('e1', 1), entry('e2', 2)];
    const actions: ActionItem[] = [
      { id: 'a1', title: 'action', status: 'active', createdAt: 1, evidenceEntryIds: ['e1'] },
    ];
    const principles: Principle[] = [
      {
        id: 'p1',
        text: 'principle',
        year: 2026,
        createdAt: 1,
        showOnHome: true,
        derivedFromEntryIds: ['e2'],
      },
    ];
    expect(
      filterPastEntries(entries, { linkedTo: 'action' }, actions, principles).map(
        (item) => item.id,
      ),
    ).toEqual(['e1']);
    expect(
      filterPastEntries(entries, { linkedTo: 'principle' }, actions, principles).map(
        (item) => item.id,
      ),
    ).toEqual(['e2']);
  });

  it('builds an evidence-only review and an explicit action context', () => {
    const result = buildDeterministicReview(
      [entry('old', 1), entry('latest', 2)],
      [
        {
          id: 'p',
          text: '先确认事实',
          year: 2026,
          createdAt: 1,
          showOnHome: true,
          derivedFromEntryIds: ['latest'],
        },
      ],
      [
        {
          id: 'a',
          title: '复盘项目',
          status: 'completed',
          createdAt: 1,
          evidenceEntryIds: ['latest'],
        },
      ],
    );
    expect(result.entries.map((item) => item.id)).toEqual(['latest', 'old']);
    expect(result.principles.map((item) => item.text)).toEqual(['先确认事实']);
    expect(result.actions.map((item) => item.title)).toEqual(['复盘项目']);
    expect(result.actionContext).toEqual({
      sourceEntryId: 'latest',
      evidenceEntryIds: ['latest'],
      rationale: 'latest',
    });
  });
});
