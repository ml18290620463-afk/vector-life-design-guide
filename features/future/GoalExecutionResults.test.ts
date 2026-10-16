import { describe, expect, it } from 'vitest';
import type { ActionItem } from '../../types';
import type { ActionPracticeRecord } from '../../types/future';
import { goalExecutionRecords, executionTitle } from './GoalExecutionResults';

describe('goal execution history', () => {
  it('keeps original goal and title snapshots while allowing legacy records to be read', () => {
    const actions: ActionItem[] = [
      { id: 'a', title: '新的行动文字', goalId: 'new', status: 'active', createdAt: 1 },
    ];
    const base = {
      actionId: 'a',
      actionTitle: '原始行动文字',
      status: 'partial' as const,
      note: '',
      nextStep: 'continue' as const,
      occurredOn: '2026-10-14',
      createdAt: 1,
    };
    const records: ActionPracticeRecord[] = [
      { ...base, id: 'original', goalId: 'old' },
      { ...base, id: 'unassigned', goalId: null },
      { ...base, id: 'legacy', actionTitle: undefined },
    ];
    expect(goalExecutionRecords('old', records, actions).map((r) => r.id)).toEqual(['original']);
    expect(goalExecutionRecords('new', records, actions).map((r) => r.id)).toEqual(['legacy']);
    expect(executionTitle(records[0], actions)).toBe('原始行动文字');
    expect(executionTitle(records[2], actions)).toBe('新的行动文字');
  });
});
