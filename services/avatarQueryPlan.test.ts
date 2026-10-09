import { describe, expect, it } from 'vitest';
import {
  buildDeterministicEntryCountReply,
  parseAvatarQueryPlan,
  parseAvatarTimeRange,
} from './avatarQueryPlan';

const now = new Date(2026, 4, 15, 12).getTime();
const entries = [
  {
    id: 'may',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 4, 2).getTime(),
    isLocked: false,
  },
  {
    id: 'march',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 2, 2).getTime(),
    isLocked: false,
  },
  {
    id: 'locked',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 4, 3).getTime(),
    isLocked: true,
  },
  {
    id: 'sample',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 4, 4).getTime(),
    isLocked: false,
    isSample: true,
  },
  {
    id: 'encrypted',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 4, 5).getTime(),
    isLocked: false,
    isEncrypted: true,
  },
  {
    id: 'future-unlock',
    title: '',
    content: '',
    tags: [],
    createdAt: new Date(2026, 4, 6).getTime(),
    isLocked: false,
    unlockAt: now + 1,
  },
];

describe('avatar query plan', () => {
  it('parses explicit Chinese periods using local calendar boundaries', () => {
    expect(parseAvatarTimeRange('2026年2月至4月', now)).toMatchObject({
      label: '2026 年 2 月至4 月',
      start: new Date(2026, 1, 1).getTime(),
      end: new Date(2026, 4, 1).getTime(),
    });
    expect(parseAvatarTimeRange('今年写了多少篇日记', now)).toMatchObject({ label: '2026 年' });
    expect(parseAvatarQueryPlan('本月发生了什么', now).kind).toBe('period_recall');
  });
  it('uses Monday calendar boundaries for current and previous weeks, including a year boundary', () => {
    expect(parseAvatarTimeRange('上周我为什么累', now)).toMatchObject({
      start: new Date(2026, 4, 4).getTime(),
      end: new Date(2026, 4, 11).getTime(),
      label: '上周（2026 年 5 月 4 日至2026 年 5 月 10 日）',
    });
    const monday = new Date(2027, 0, 4, 12).getTime();
    expect(parseAvatarTimeRange('上周发生了什么', monday)).toMatchObject({
      start: new Date(2026, 11, 28).getTime(),
      end: new Date(2027, 0, 4).getTime(),
    });
  });
  it('parses a concrete day without silently expanding it to the whole month', () => {
    expect(parseAvatarTimeRange('2026年5月2日我做了什么', now)).toMatchObject({
      start: new Date(2026, 4, 2).getTime(),
      end: new Date(2026, 4, 3).getTime(),
      label: '2026 年 5 月 2 日',
    });
  });
  it('recognizes a whole explicit year and cross-year comparisons', () => {
    expect(parseAvatarTimeRange('2025年工作压力', now)).toMatchObject({
      start: new Date(2025, 0, 1).getTime(),
      end: new Date(2026, 0, 1).getTime(),
    });
    for (const question of ['比较去年和今年工作压力', '比较2025年与2026年工作压力']) {
      expect(parseAvatarTimeRange(question, now)).toMatchObject({
        start: new Date(2025, 0, 1).getTime(),
        end: new Date(2027, 0, 1).getTime(),
      });
    }
    expect(parseAvatarTimeRange('2026年13月', now)).toBeUndefined();
  });
  it('answers standalone entry counts locally and excludes inaccessible data', () => {
    expect(buildDeterministicEntryCountReply('本月写了多少篇日记', entries, now)).toContain(
      '1 条可访问记录',
    );
    expect(buildDeterministicEntryCountReply('今年写了多少篇日记', entries, now)).toContain(
      '2 条可访问记录',
    );
    expect(
      buildDeterministicEntryCountReply('今年写了多少篇日记，为什么', entries, now),
    ).toBeNull();
  });
});
