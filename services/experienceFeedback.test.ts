import { describe, expect, it } from 'vitest';
import type { DiaryEntry, Principle } from '../types';
import {
  applyPrincipleFeedback,
  findRelatedPrinciples,
  getPrincipleConfidence,
} from './experienceFeedback';
import { sanitizePrinciple } from './diaryDataRead';

const buildEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry-1',
  title: '一次重要沟通',
  content: '今天和客户沟通方案，先明确目标后推进得很顺利。',
  createdAt: 1,
  tags: ['心情:平静', '事件:职业发展'],
  isLocked: false,
  ...overrides,
});

const buildPrinciple = (overrides: Partial<Principle> = {}): Principle => ({
  id: 'principle-1',
  text: '重要沟通前先定义目标',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
  ...overrides,
});

describe('experienceFeedback', () => {
  it('sanitizes complete trigger-action structures and drops partial ones', () => {
    expect(
      sanitizePrinciple(
        buildPrinciple({ application: { trigger: '  会议开始前  ', action: '  写下目标  ' } }),
      ).application,
    ).toEqual({ trigger: '会议开始前', action: '写下目标' });
    expect(
      sanitizePrinciple(
        buildPrinciple({ application: { trigger: '会议开始前', action: '   ' } }),
      ).application,
    ).toBeUndefined();
  });
  it('uses a neutral confidence for legacy principles', () => {
    expect(getPrincipleConfidence(buildPrinciple())).toBe(0.5);
  });

  it('updates confidence and counters from confirmed outcomes', () => {
    const updated = applyPrincipleFeedback(buildPrinciple(), 'helpful', 100);

    expect(updated.confidence).toBe(0.62);
    expect(updated.recallCount).toBe(1);
    expect(updated.helpfulCount).toBe(1);
    expect(updated.lastFeedbackAt).toBe(100);
  });

  it('does not mutate a principle when the association is unrelated', () => {
    const principle = buildPrinciple();
    expect(applyPrincipleFeedback(principle, 'unrelated')).toBe(principle);
  });

  it('prioritizes principles supported by evidence with matching tags', () => {
    const evidence = buildEntry({ id: 'evidence-1' });
    const related = buildPrinciple({ derivedFromEntryIds: [evidence.id] });
    const unrelated = buildPrinciple({
      id: 'principle-2',
      text: '睡前减少屏幕时间',
      derivedFromEntryIds: ['health-entry'],
    });
    const healthEntry = buildEntry({
      id: 'health-entry',
      title: '睡眠',
      content: '昨晚睡得很晚。',
      tags: ['心情:疲惫', '事件:身体健康'],
    });

    expect(
      findRelatedPrinciples(buildEntry(), [unrelated, related], [evidence, healthEntry]),
    ).toEqual([related]);
  });

  it('returns no candidate for a weak unrelated match', () => {
    const principle = buildPrinciple({ text: '每周整理一次财务预算' });
    expect(findRelatedPrinciples(buildEntry(), [principle], [])).toEqual([]);
  });
});
