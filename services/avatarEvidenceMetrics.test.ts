import { describe, expect, it } from 'vitest';
import { buildAvatarEvidenceMetricReply, findAvatarEvidenceMetric } from './avatarEvidenceMetrics';

const now = new Date(2026, 4, 15, 12).getTime();
const entry = (id: string, content: string, overrides = {}) => ({
  id,
  title: '',
  content,
  tags: [],
  createdAt: new Date(2026, 3, 2).getTime(),
  isLocked: false,
  ...overrides,
});

describe('avatar evidence metrics', () => {
  it('keeps deterministic counts when advice is requested alongside statistics', () => {
    expect(
      findAvatarEvidenceMetric('今年痛苦多少次，请分析并给我建议', [entry('one', '我很痛苦')], now)
        ?.matches,
    ).toHaveLength(1);
  });

  it('counts only explicit occurrences in the requested time range', () => {
    const metric = findAvatarEvidenceMetric(
      '今年我痛苦了多少次',
      [
        entry('pain', '这件事让我很痛苦'),
        entry('anxious', '我很焦虑'),
        entry('tagged', '没有细说', { tags: ['心情:痛苦'] }),
        entry('old', '过去很痛苦', { createdAt: new Date(2025, 3, 2).getTime() }),
      ],
      now,
    );
    expect(metric?.matches.map((match) => match.entryId)).toEqual(['pain', 'tagged']);
    expect(buildAvatarEvidenceMetricReply(metric!)).toContain('2 条');
  });

  it('does not read inaccessible entries or negated wording as evidence', () => {
    const metric = findAvatarEvidenceMetric(
      '今年痛苦多少次',
      [
        entry('locked', '很痛苦', { isLocked: true }),
        entry('encrypted', '很痛苦', { isEncrypted: true }),
        entry('sample', '很痛苦', { isSample: true }),
        entry('negated', '这次并不痛苦'),
        entry('actual', '我感到痛苦'),
      ],
      now,
    );
    expect(metric?.matches.map((match) => match.entryId)).toEqual(['actual']);
  });

  it('excludes hypothetical, quoted, other-person and negated claims and counts each record once', () => {
    const actual = entry('actual', '我感到痛苦。晚上仍然痛苦');
    const metric = findAvatarEvidenceMetric(
      '今年痛苦多少次',
      [
        entry('other', '朋友很痛苦'),
        entry('quote', '书里写着“我很痛苦”'),
        entry('hypothetical', '如果失败了我会痛苦'),
        entry('negative', '我没有感到痛苦', { tags: ['不痛苦'] }),
        entry('resolved', '我不再觉得痛苦'),
        actual,
        actual,
      ],
      now,
    )!;
    expect(metric.matches.map((match) => match.entryId)).toEqual(['actual']);
    expect(buildAvatarEvidenceMetricReply(metric)).toContain('不代表实际发生次数');
  });

  it('does not turn open-ended questions into a count', () => {
    expect(
      findAvatarEvidenceMetric('为什么我今年这么痛苦', [entry('one', '痛苦')], now),
    ).toBeNull();
  });
  it('does not move later supplements into an earlier reporting period', () => {
    const metric = findAvatarEvidenceMetric(
      '2025年痛苦多少次',
      [
        entry('later-supplement', '平静的一天', {
          createdAt: new Date(2025, 3, 2).getTime(),
          supplements: [
            { id: 's1', content: '今天很痛苦', createdAt: new Date(2026, 3, 2).getTime() },
          ],
        }),
        entry('same-period', '平静的一天', {
          createdAt: new Date(2025, 3, 2).getTime(),
          supplements: [
            { id: 's2', content: '我很痛苦', createdAt: new Date(2025, 3, 3).getTime() },
          ],
        }),
      ],
      now,
    );
    expect(metric?.matches.map((match) => match.entryId)).toEqual(['same-period']);
  });
});
