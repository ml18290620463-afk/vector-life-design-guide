import { describe, expect, it } from 'vitest';
import type { ActionItem } from '../../types';
import type { Goal } from '../../types/future';
import { prioritizeActions } from './futureTextRules';

const action = (id: string, title: string, overrides: Partial<ActionItem> = {}): ActionItem => ({
  id,
  title,
  status: 'pending',
  createdAt: 10,
  ...overrides,
});
const goal = (id: string, dueDate?: string): Goal => ({
  id,
  title: id,
  status: 'active',
  tags: [],
  measurement: { kind: 'narrative' },
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  dueDate,
});

describe('prioritizeActions', () => {
  it('uses a stable, explainable next-action order', () => {
    const result = prioritizeActions(
      [
        { action: action('recent', '最近编辑', { updatedAt: 100 }) },
        { action: action('deadline', '临近目标期限'), goal: goal('目标', '2026-10-15') },
        {
          action: action('continue', '等我继续'),
          latestPractice: {
            id: 'practice',
            actionId: 'continue',
            status: 'partial',
            note: '',
            nextStep: 'continue',
            occurredOn: '2026-10-08',
            createdAt: 50,
          },
        },
        { action: action('due', '今天应做', { scheduledOn: '2026-10-09' }) },
      ],
      '2026-10-09',
    );

    expect(result.map(({ action: value }) => value.id)).toEqual([
      'due',
      'continue',
      'deadline',
      'recent',
    ]);
  });
});
