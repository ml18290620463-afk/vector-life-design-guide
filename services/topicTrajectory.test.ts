import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import { buildTopicTrajectory } from './topicTrajectory';

const entry = (id: string, createdAt: number, tags: string[]): DiaryEntry => ({
  id,
  title: id,
  content: id,
  createdAt,
  tags,
  isLocked: false,
});

describe('buildTopicTrajectory', () => {
  it('builds a chronological local slice and preserves edge meaning', () => {
    const first = entry('first', 1, ['事件:沟通']);
    const second = entry('second', 2, ['事件:沟通']);
    const current = {
      ...entry('current', 3, ['事件:沟通']),
      relatedEntryIds: [second.id, first.id],
      experienceEdges: [
        { targetEntryId: first.id, kind: 'supports' as const, confidence: 1, createdAt: 3, source: 'user-confirmed' as const },
        { targetEntryId: second.id, kind: 'contradicts' as const, confidence: 1, createdAt: 3, source: 'user-confirmed' as const },
      ],
    };
    const trajectory = buildTopicTrajectory(current, [current, second, first]);
    expect(trajectory?.label).toBe('沟通');
    expect(trajectory?.nodes.map(({ entry: node, relation }) => [node.id, relation])).toEqual([
      ['first', 'supports'],
      ['second', 'contradicts'],
      ['current', 'current'],
    ]);
    expect(trajectory).toMatchObject({ startedAt: 1, updatedAt: 3 });
  });

  it('returns null when no existing related record can be resolved', () => {
    expect(buildTopicTrajectory(entry('current', 3, ['沟通']), [])).toBeNull();
  });
});
