import { describe, expect, it } from 'vitest';
import { buildAvatarDecisionSupport } from './avatarDecisionSupport';
import type { DiaryEntry } from '../types';
import type { AvatarUnderstandingVersion } from '../features/avatar/types';

const entry = (id: string, content: string): DiaryEntry => ({
  id,
  title: '工作选择',
  content,
  tags: [],
  createdAt: new Date(2026, 2, Number(id) || 1).getTime(),
  isLocked: false,
});
const confirmed: AvatarUnderstandingVersion = {
  id: 'confirmed', statement: '做工作选择前会先比较精力成本', status: 'confirmed',
  sourceEntryIds: ['1'], createdAt: 1,
};

describe('avatar decision support', () => {
  it('uses readable related experiences and keeps the choice with the user', () => {
    const result = buildAvatarDecisionSupport(
      '我该不该接受这个工作机会，怎么选？',
      [entry('1', '上次工作机会薪资更高，但通勤让我长期疲惫。'), entry('2', '旅行安排与工作无关。')],
      [confirmed, { ...confirmed, id: 'candidate', statement: '未确认推断', status: 'pending' }],
    );
    expect(result?.entryIds).toEqual(['1']);
    expect(result?.text).toContain('相似经历');
    expect(result?.text).toContain('过去结果');
    expect(result?.text).toContain('当前差异');
    expect(result?.text).toContain('待验证条件');
    expect(result?.text).toContain(confirmed.statement);
    expect(result?.text).not.toContain('未确认推断');
    expect(result?.text).not.toMatch(/你应该|直接选/);
  });

  it('does not invent history when no related evidence exists', () => {
    const result = buildAvatarDecisionSupport('我该不该搬家，怎么选？', [entry('1', '上次工作机会薪资更高。')], []);
    expect(result?.entryIds).toEqual([]);
    expect(result?.text).toContain('没有找到');
    expect(result?.text).not.toContain('薪资');
  });

  it('excludes inaccessible source entries', () => {
    const result = buildAvatarDecisionSupport('我该不该接受工作机会？', [
      { ...entry('1', '工作机会让我疲惫'), isLocked: true },
      { ...entry('2', '工作机会需要比较通勤成本'), isSample: true },
    ], []);
    expect(result?.entryIds).toEqual([]);
  });
});
