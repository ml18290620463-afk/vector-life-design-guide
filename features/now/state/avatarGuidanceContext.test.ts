import { describe, expect, it } from 'vitest';
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
