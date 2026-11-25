import { describe, expect, it } from 'vitest';
import {
  AVATAR_GUIDANCE_POLICIES,
  fillGuidanceSlots,
  resolveGuidanceBudget,
} from './avatarGuidancePolicy';
import { focusedExcerpt, type GuidanceSource } from './avatarGuidance';

const raw = (id: string): GuidanceSource => ({
  id,
  kind: '背景',
  module: 'past',
  text: '工作选择',
});
const pool = Array.from({ length: 30 }, (_, i) => ({ source: raw(String(i)), score: 0.9 }));
describe('scene quotas and cold-start overflow', () => {
  it.each(Object.values(AVATAR_GUIDANCE_POLICIES))(
    '$mode fills empty cognition slots with relevant raw records within both limits',
    (policy) => {
      const normal = fillGuidanceSlots(pool, '工作选择', { mode: policy.mode });
      const expanded = fillGuidanceSlots(pool, '工作选择', { mode: policy.mode, expanded: true });
      expect(normal.sources).toHaveLength(policy.defaultLimit);
      expect(expanded.sources).toHaveLength(policy.expandedLimit);
      expect(normal.manifest.breakdown.rawRecordCount).toBe(policy.defaultLimit);
      expect(fillGuidanceSlots([], '', { mode: policy.mode }).manifest.matchedCount).toBe(0);
    },
  );
  it('enforces separate slots rather than letting highest-scored raw records starve cognition', () => {
    const about = { ...raw('about'), domain: 'about_me' as const };
    const understanding = { ...raw('understanding'), domain: 'my_understanding' as const };
    const result = fillGuidanceSlots(
      [...pool, { source: about, score: 0.5 }, { source: understanding, score: 0.5 }],
      '',
      { mode: 'general' },
    );
    expect(result.sources).toHaveLength(6);
    expect(result.sources).toContain(about);
    expect(result.sources).toContain(understanding);
  });
  it('rejects noise, removes excluded sources and never duplicates an identity', () => {
    const result = fillGuidanceSlots(
      [pool[0], pool[0], pool[1], { source: raw('noise'), score: 0.1 }],
      '',
      { excludedIds: ['1'] },
    );
    expect(result.sources.map((s) => s.id)).toEqual(['0']);
    expect(result.manifest.excludedByUserCount).toBe(1);
  });
  it('contracts long lightweight followups and small windows even when expanded', () => {
    expect(
      resolveGuidanceBudget('', {
        mode: 'review',
        expanded: true,
        messageCount: 20,
        lightweightFollowup: true,
      }).limit,
    ).toBe(2);
    expect(resolveGuidanceBudget('', { smallWindow: true }).limit).toBe(2);
    expect(resolveGuidanceBudget('跨月回顾', { mode: 'review' }).limit).toBe(20);
    expect(resolveGuidanceBudget('', { mode: 'recall', longGoal: true }).limit).toBe(16);
  });
  it('only reports selected and enabled tag guardrails in decision/review modes', () => {
    const source = {
      ...raw('boundary'),
      domain: 'about_me' as const,
      guardrail: {
        enabled: true,
        triggerTags: ['工作'],
        conditionSummary: '工作选择',
        reminderDirective: '检查边界',
      },
    };
    expect(
      fillGuidanceSlots([{ source, score: 1 }], '', { mode: 'decide', tags: ['工作'] }).manifest
        .triggeredGuardrailIds,
    ).toEqual(['boundary']);
    expect(
      fillGuidanceSlots([{ source, score: 1 }], '', { mode: 'general', tags: ['工作'] }).manifest
        .triggeredGuardrailIds,
    ).toEqual([]);
  });
  it('preserves a distant question match inside the 700 character hard limit', () => {
    const result = focusedExcerpt('甲'.repeat(1500) + '工作选择' + '乙'.repeat(1500), '工作选择');
    expect(result.length).toBeLessThanOrEqual(700);
    expect(result).toContain('工作选择');
  });
});
