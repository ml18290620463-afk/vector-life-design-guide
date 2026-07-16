import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import {
  buildLocalSemanticIndex,
  buildLocalSemanticVector,
  cosineSimilarity,
  LOCAL_SEMANTIC_DIMENSIONS,
  searchLocalSemanticIndex,
} from './localSemanticIndex';

const buildEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry-1',
  title: '项目沟通',
  content: '上次和客户讨论方案时，提前确认目标让会议推进得很顺利。',
  createdAt: 1,
  tags: ['心情:平静', '事件:职业发展'],
  isLocked: false,
  ...overrides,
});

describe('localSemanticIndex', () => {
  it('builds deterministic normalized vectors locally', () => {
    const source = { text: '重要沟通前先确认目标', tags: ['职业发展'] };
    const first = buildLocalSemanticVector(source);
    const second = buildLocalSemanticVector(source);

    expect(first).toHaveLength(LOCAL_SEMANTIC_DIMENSIONS);
    expect(second).toEqual(first);
    expect(cosineSimilarity(first, second)).toBeCloseTo(1);
  });

  it('recalls differently worded experiences in the same semantic context', () => {
    const workEntry = buildEntry();
    const healthEntry = buildEntry({
      id: 'entry-health',
      title: '睡眠记录',
      content: '昨晚很疲惫，决定早点休息并减少睡前使用手机。',
      tags: ['心情:疲惫', '事件:身体健康'],
    });
    const index = buildLocalSemanticIndex([healthEntry, workEntry]);
    const matches = searchLocalSemanticIndex(
      {
        title: '明天的会面',
        content: '准备和合作方开会，我想先写清楚这次唯一要达成的结果。',
        tags: ['心情:平静', '事件:职业发展'],
      },
      index,
    );

    expect(matches[0]?.entry.id).toBe(workEntry.id);
    expect(matches.some(({ entry }) => entry.id === healthEntry.id)).toBe(false);
  });

  it('keeps samples, archived entries and future-locked entries out of the index', () => {
    const index = buildLocalSemanticIndex([
      buildEntry({ id: 'sample', isSample: true }),
      buildEntry({ id: 'archived', isArchived: true }),
      buildEntry({ id: 'locked', unlockAt: Date.now() + 10_000 }),
      buildEntry({ id: 'available' }),
    ]);

    expect(index.map(({ entry }) => entry.id)).toEqual(['available']);
  });
});
