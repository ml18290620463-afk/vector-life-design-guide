import { describe, expect, it } from 'vitest';
import type { DiaryEntry, Principle } from '../types';
import { buildFutureDecision } from './futureDecision';

const entry = (id: string, content: string, tags: string[]): DiaryEntry => ({
  id,
  title: id,
  content,
  tags,
  createdAt: 1,
  isLocked: false,
});

const principle = (overrides: Partial<Principle> = {}): Principle => ({
  id: 'principle-work',
  text: '重要沟通前先确认唯一目标',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
  confidence: 0.84,
  derivedFromEntryIds: ['work'],
  ...overrides,
});

describe('buildFutureDecision', () => {
  it('combines relevant evidence with a confidence-ranked principle', () => {
    const work = entry('work', '客户会议讨论失焦，下次要提前确认目标。', ['事件:工作']);
    const health = entry('health', '昨晚睡眠不足，今天需要早点休息。', ['事件:健康']);
    const decision = buildFutureDecision(
      '怎样让下次客户沟通不再失焦？',
      [health, work],
      [principle()],
    );

    expect(decision?.principle?.id).toBe('principle-work');
    expect(decision?.evidenceEntries[0]?.id).toBe('work');
    expect(decision?.actionTitle).toContain('小范围验证');
  });

  it('does not invent a principle when none is relevant', () => {
    const decision = buildFutureDecision(
      '我要如何改善睡眠？',
      [entry('health', '昨晚睡眠不足。', ['事件:健康'])],
      [principle()],
    );

    expect(decision?.principle).toBeNull();
    expect(decision?.actionTitle).toContain('最小可逆验证');
  });

  it('uses a confirmed structured action and exposes its trigger in the rationale', () => {
    const decision = buildFutureDecision(
      '怎样让下次客户沟通不再失焦？',
      [entry('work', '客户会议讨论失焦。', ['事件:工作'])],
      [principle({ application: { trigger: '重要沟通开始前', action: '写下这次唯一目标' } })],
    );
    expect(decision?.actionTitle).toBe('写下这次唯一目标');
    expect(decision?.rationale).toContain('触发场景：重要沟通开始前');
  });
});
