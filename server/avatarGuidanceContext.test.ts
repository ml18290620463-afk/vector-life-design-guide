import { describe, expect, it } from 'vitest';
import { guidanceLogicHints, isGuidanceContext, serializeGuidanceContext } from './avatarGuidanceContext';

describe('guidance logic context', () => {
  it('keeps enabled guardrails and cross-tag understanding as bounded reference data', () => {
    const source = {
      text: '我在两种场合都需要留出休息时间', domain: 'my_understanding',
      tags: ['工作', '家庭'], searchText: 'private local text',
      guardrail: { enabled: true, triggerTags: ['工作'], conditionSummary: '时间紧张', reminderDirective: '核对自己的界限' },
    };
    expect(isGuidanceContext(source)).toBe(true);
    expect(serializeGuidanceContext([source])[0]).not.toHaveProperty('searchText');
    expect(guidanceLogicHints([source])).toContain('跨两个或更多记录标签');
    expect(guidanceLogicHints([source])).toContain('个人护栏');
  });

  it('rejects oversized injected metadata and does not include disabled guardrails', () => {
    expect(isGuidanceContext({ text: 'x', tags: Array(13).fill('tag') })).toBe(false);
    expect(isGuidanceContext({ text: 'x', guardrail: { enabled: true, triggerTags: [], conditionSummary: 'x', reminderDirective: 'x'.repeat(301) } })).toBe(false);
    expect(serializeGuidanceContext([{ text: 'x', guardrail: { enabled: false } }])[0].guardrail).toBeUndefined();
  });
});
