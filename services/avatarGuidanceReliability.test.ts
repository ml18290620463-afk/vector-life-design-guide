import { describe, expect, it } from 'vitest';
import {
  buildGuidanceSources,
  buildGroundedGuidance,
  isAvatarContextContinuation,
} from './avatarGuidance';
import { emptyFutureState } from './futureRepository';
import type { DiaryEntry, ActionItem, Principle } from '../types';
import type { AvatarAtomicMemory, AvatarUnderstandingVersion } from '../features/avatar/types';

const entry: DiaryEntry = {
  id: 'e',
  title: '会议',
  content: '任务范围不清楚，先沟通再安排',
  createdAt: 1,
  tags: [],
  isLocked: false,
};
const pattern: AvatarUnderstandingVersion = {
  id: 'p',
  statement: '范围不清时先沟通',
  status: 'confirmed',
  sourceEntryIds: ['e'],
  createdAt: 1,
  trigger: '任务范围不清',
  response: '先沟通',
};
const principle: Principle = {
  id: 'r',
  text: '先确认范围',
  year: 2026,
  createdAt: 1,
  showOnHome: false,
  sourcePatternIds: ['p'],
  application: { trigger: '任务范围不清', action: '向负责人确认' },
};
const action: ActionItem = {
  id: 'a',
  title: '沟通范围',
  status: 'completed',
  createdAt: 1,
  principleId: 'r',
  sourceEntryId: 'e',
};
const input = () => ({
  entries: [entry],
  patterns: [pattern],
  principles: [principle],
  actions: [action],
  future: emptyFutureState(),
  now: 100,
});

describe('guidance evidence and outcome boundaries', () => {
  it.each([{ isLocked: true }, { isEncrypted: true }, { isSample: true }, { unlockAt: 101 }])(
    'excludes inaccessible originals and their derived interpretations: %j',
    (protection) => {
      const data = input();
      data.entries = [entry, { ...entry, id: 'hidden', content: 'secret', ...protection }];
      data.patterns = [{ ...pattern, sourceEntryIds: ['e', 'hidden'] }];
      data.actions = [{ ...action, evidenceEntryIds: ['hidden'] }];
      const sources = buildGuidanceSources(data);
      expect(sources.map((s) => s.id)).toEqual(['entry:e']);
      expect(JSON.stringify(sources)).not.toContain('secret');
    },
  );
  it('sends current excerpts, occurrence time and application conditions, bounded and without modifying the originals', () => {
    const data = input();
    data.entries = [{ ...entry, content: `<p>${'任务范围'.repeat(300)}</p>` }];
    const before = JSON.stringify(data);
    const sources = buildGuidanceSources(data);
    expect(sources.find((s) => s.id === 'p')).toMatchObject({
      nature: 'inferred',
      detail: expect.stringContaining('情境：任务范围不清'),
      evidence: [{ text: expect.any(String), occurredAt: 1 }],
    });
    expect(sources.find((s) => s.id === 'r')?.evidence?.[0].text).toHaveLength(700);
    expect(sources.find((s) => s.id === 'r')?.detail).toContain('向负责人确认');
    expect(JSON.stringify(sources)).not.toContain('<p>');
    expect(JSON.stringify(data)).toBe(before);
  });
  it('does not invent evidence for an explicitly retained memory after source deletion', () => {
    const memory: AvatarAtomicMemory = {
      id: 'm',
      statement: '我需要独处',
      nature: 'explicit',
      category: 'recent_state',
      facets: ['preference'],
      contexts: [],
      tags: [],
      confidence: 0.5,
      status: 'retained',
      sensitivity: 'normal',
      createdAt: 1,
      retainedAfterSourceDeletion: true,
      sourceRefs: [{ source: 'entry', id: 'gone', excerpt: 'deleted secret' }],
    };
    const data = { ...input(), entries: [], avatarMemories: [memory] };
    const saved = buildGuidanceSources(data).find((s) => s.id === 'm');
    expect(saved?.evidence).toEqual([]);
    expect(JSON.stringify(saved)).not.toContain('deleted secret');
  });
  it('keeps negative, partial and cancelled feedback available to the linked principle without changing confidence', () => {
    const data = input();
    data.future.practiceRecords = ['not_completed', 'partial', 'cancelled'].map((status, i) => ({
      id: String(i),
      actionId: 'a',
      status: status as 'not_completed' | 'partial' | 'cancelled',
      note: `预算限制${i}`,
      nextStep: 'adjust',
      occurredOn: `2026-09-0${i + 1}`,
      createdAt: i + 1,
    }));
    const before = JSON.stringify(data);
    const sources = buildGuidanceSources(data);
    const learned = sources.find((s) => s.id === 'r');
    expect(learned?.results?.map((r) => r.status)).toEqual([
      'cancelled',
      'partial',
      'not_completed',
    ]);
    expect(sources.find((s) => s.id === 'a')?.kind).toBe('背景');
    expect(buildGroundedGuidance('预算限制', sources).sources).toContain(learned);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('excludes revoked and inaccessible event results', () => {
    const data = input();
    data.future.goals = [
      {
        id: 'g',
        title: '沟通',
        status: 'paused',
        measurement: { kind: 'narrative' },
        tags: [],
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const event = {
      id: 'ev',
      goalId: 'g',
      operationId: 'op',
      semanticKey: 'key',
      value: { kind: 'narrative' as const, note: '应该消失' },
      occurredOn: '2026-09-01',
      sourceState: 'standalone' as const,
      confirmedBy: 'user' as const,
      status: 'valid' as const,
      goalRevision: 1,
      createdAt: 1,
    };
    data.entries.push({ ...entry, id: 'hidden', isLocked: true });
    data.future.events = [
      { ...event, status: 'revoked' },
      { ...event, id: 'hidden-result', sourceEntryId: 'hidden' },
    ];
    const goal = buildGuidanceSources(data).find((s) => s.id === 'g');
    expect(goal).toMatchObject({ kind: '背景', status: 'paused', results: [] });
    expect(JSON.stringify(goal)).not.toContain('应该消失');
  });
  it('keeps the prior subject for short follow-ups but never swallows a new topic beginning with 这 or 那', () => {
    const sources = buildGuidanceSources(input());
    expect(
      buildGroundedGuidance('那怎么办', sources, '任务范围不清').sources.length,
    ).toBeGreaterThan(0);
    expect(buildGroundedGuidance('今天吃什么', sources, '任务范围不清').sources).toEqual([]);
    expect(isAvatarContextContinuation('这次我想讨论租房')).toBe(false);
    expect(isAvatarContextContinuation('那天出差的航班取消了')).toBe(false);
    expect(isAvatarContextContinuation('好的')).toBe(true);
    expect(isAvatarContextContinuation('然后呢？')).toBe(true);
    expect(isAvatarContextContinuation('还有呢')).toBe(true);
    expect(isAvatarContextContinuation('这次呢')).toBe(true);
  });
  it('uses the original subject even if a short follow-up matches another record', () => {
    const sources = buildGuidanceSources(input());
    sources.push({ id: 'unrelated', kind: '背景', module: 'past', text: '为什么睡不好' });
    const prior = buildGroundedGuidance('任务范围不清', sources).sources;
    expect(buildGroundedGuidance('为什么', sources, '任务范围不清').sources).toEqual(prior);
  });
  it('bounds long user-authored interpretations to the model transport limits', () => {
    const data = input();
    data.patterns = [
      {
        ...pattern,
        statement: '长'.repeat(5000),
        trigger: '情境'.repeat(2000),
        response: '反应'.repeat(2000),
      },
    ];
    const source = buildGuidanceSources(data).find((s) => s.id === 'p');
    expect(source?.text).toHaveLength(4000);
    expect(source?.detail).toHaveLength(2400);
  });
});
