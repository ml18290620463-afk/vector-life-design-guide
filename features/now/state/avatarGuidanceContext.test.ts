import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectAvatarGuidanceContext } from './avatarGuidanceContext';
import type { ChatMessage } from '../types/now';
import type { GuidanceSource } from '../../../services/avatarGuidance';

const messages = (...content: string[]): ChatMessage[] =>
  content.map((text, i) => ({
    id: String(i),
    role: 'user',
    type: 'text',
    content: text,
    created_at: '',
  }));
const context = { mode: 'review' as const, source: 'action-review' as const, actionId: 'a' };
const sources: GuidanceSource[] = [
  {
    id: 'a',
    kind: '背景',
    sourceKey: '行动:a',
    text: '整理旅行证件',
    module: 'future',
    relatedKeys: ['目标:g'],
  },
  { id: 'g', kind: '目标', text: '完成旅行准备', module: 'future' },
  { id: 'b', kind: '原则', text: '预算控制每月支出', module: 'past' },
];
describe('avatar launch object context', () => {
  it('retains the current completed action and linked goal through a short follow-up', () => {
    expect(
      selectAvatarGuidanceContext(messages('怎么做', '继续'), sources, context).map((s) => s.id),
    ).toEqual(['a', 'g']);
  });
  it('allows a new subject to take over', () => {
    const result = selectAvatarGuidanceContext(
      messages('怎么做', '预算控制每月支出'),
      sources,
      context,
    );
    expect(result.map((s) => s.id)).toContain('b');
    expect(result.map((s) => s.id)).not.toContain('a');
  });
  it('does not restore a removed or expired launch object', () => {
    expect(selectAvatarGuidanceContext(messages('怎么做'), sources.slice(1), context)).toEqual([]);
    expect(
      selectAvatarGuidanceContext(messages('怎么做'), [{ ...sources[0], validTo: 1 }], context),
    ).toEqual([]);
  });
});

describe('hybrid avatar recall', () => {
  it('keeps lexical evidence alongside a semantically recalled record', () => {
    const recallSources: GuidanceSource[] = [
      {
        id: 'entry:semantic',
        kind: '背景',
        text: '连续会议后睡眠变浅，第二天很难集中。',
        module: 'past',
        evidence: [{ text: '连续会议后睡眠变浅', occurredAt: Date.now() }],
      },
      {
        id: 'entry:keyword',
        kind: '背景',
        text: '疲惫时先停下十分钟，再决定是否继续。',
        module: 'past',
        evidence: [{ text: '疲惫时先停下十分钟', occurredAt: Date.now() }],
      },
    ];

    expect(
      selectAvatarGuidanceContext(messages('我最近总是疲惫，为什么'), recallSources, undefined, [
        'semantic',
      ]).map((source) => source.id),
    ).toEqual(['entry:semantic', 'entry:keyword']);
  });

  it('continues with lexical recall when semantic retrieval has no result', () => {
    const lexical: GuidanceSource[] = [
      {
        id: 'entry:keyword',
        kind: '背景',
        text: '疲惫时先停下十分钟，再决定是否继续。',
        module: 'past',
        evidence: [{ text: '疲惫时先停下十分钟', occurredAt: Date.now() }],
      },
    ];

    expect(
      selectAvatarGuidanceContext(messages('我最近总是疲惫，为什么'), lexical).map(
        (source) => source.id,
      ),
    ).toEqual(['entry:keyword']);
  });
});

describe('time scope across conversation turns', () => {
  afterEach(() => vi.useRealTimers());
  const evidence: GuidanceSource[] = [2025, 2026].map((year) => ({
    id: `entry:${year}`,
    kind: '背景',
    module: 'past',
    text: '工作压力导致疲惫',
    evidence: [{ text: '工作压力导致疲惫', occurredAt: new Date(year, 5, 1).getTime() }],
  }));
  const ids = (...questions: string[]) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9));
    return selectAvatarGuidanceContext(messages(...questions), evidence).map((s) => s.id);
  };
  it('keeps last year through multiple short continuations', () => {
    expect(ids('去年工作压力', '继续', '那为什么')).toEqual(['entry:2025']);
  });
  it('applies explicit years and replaces the scope when a new period is requested', () => {
    expect(ids('2025年工作压力')).toEqual(['entry:2025']);
    expect(ids('去年工作压力', '今年工作压力', '继续')).toEqual(['entry:2026']);
  });
  it('does not carry the old period into a new substantive question', () => {
    expect(ids('去年工作压力', '工作压力导致疲惫', '继续')).toEqual(['entry:2025', 'entry:2026']);
  });
  it('allows explicit cross-year comparison and retains it in follow-ups', () => {
    expect(ids('比较去年和今年工作压力', '继续')).toEqual(['entry:2025', 'entry:2026']);
  });
});


describe('intent-scoped retrieval', () => {
  const mixed: GuidanceSource[] = [
    { id: 'past', kind: '背景', module: 'past', text: '去年换工作时压力很大', evidence: [{ text: '去年换工作时压力很大', occurredAt: Date.now() }] },
    { id: 'goal', kind: '目标', module: 'future', text: '完成职业转型' },
    { id: 'action', kind: '行动', module: 'future', text: '更新简历' },
    { id: 'candidate', kind: '偏好', module: 'past', status: 'candidate', text: '可能喜欢独处' },
    { id: 'confirmed', kind: '偏好', module: 'past', status: 'confirmed', text: '更喜欢独处恢复精力' },
  ];
  it('does not inject future plans into an ordinary past question', () => {
    expect(selectAvatarGuidanceContext(messages('换工作时我为什么压力大'), mixed).map((item) => item.id)).toEqual(['past']);
  });
  it('uses future context only when the user asks about direction', () => {
    const ids = selectAvatarGuidanceContext(messages('我的目标和行动该怎么规划'), mixed).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['goal', 'action']));
  });
  it('keeps only confirmed knowledge for a self-understanding question', () => {
    const ids = selectAvatarGuidanceContext(messages('我有什么偏好'), mixed).map((item) => item.id);
    expect(ids).toContain('confirmed');
    expect(ids).not.toContain('candidate');
  });
});
