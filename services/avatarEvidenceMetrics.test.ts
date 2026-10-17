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
  it('counts only explicit occurrences in the requested time range', () => {
    const metric = findAvatarEvidenceMetric('今年我痛苦了多少次', [
      entry('pain', '这件事让我很痛苦'),
      entry('anxious', '我很焦虑'),
      entry('tagged', '没有细说', { tags: ['心情:痛苦'] }),
      entry('old', '过去很痛苦', { createdAt: new Date(2025, 3, 2).getTime() }),
    ], now);
    expect(metric?.matches.map((match) => match.entryId)).toEqual(['pain', 'tagged']);
    expect(buildAvatarEvidenceMetricReply(metric!)).toContain('2 条');
  });

  it('does not read inaccessible entries or negated wording as evidence', () => {
    const metric = findAvatarEvidenceMetric('今年痛苦多少次', [
      entry('locked', '很痛苦', { isLocked: true }),
      entry('encrypted', '很痛苦', { isEncrypted: true }),
      entry('sample', '很痛苦', { isSample: true }),
      entry('negated', '这次并不痛苦'),
      entry('actual', '我感到痛苦'),
    ], now);
    expect(metric?.matches.map((match) => match.entryId)).toEqual(['actual']);
  });

  it('does not turn open-ended questions into a count', () => {
    expect(findAvatarEvidenceMetric('为什么我今年这么痛苦', [entry('one', '痛苦')], now)).toBeNull();
  });
});
