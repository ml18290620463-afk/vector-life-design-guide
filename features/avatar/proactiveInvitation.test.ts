import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../../types';
import { buildAvatarProactiveInvitation } from './proactiveInvitation';

const entry = (id: string, createdAt: number, tags: string[]): DiaryEntry => ({
  id,
  title: `记录 ${id}`,
  content: '内容',
  createdAt,
  tags,
  isLocked: false,
});

describe('buildAvatarProactiveInvitation', () => {
  it('offers a low-pressure opening when there is no usable history', () => {
    const invitation = buildAvatarProactiveInvitation([]);
    expect(invitation.title).toContain('分身');
    expect(invitation.prompts).toEqual(['认识我', '我在意什么', '如何开始']);
  });

  it('uses a repeated signal as a compact entry point', () => {
    const invitation = buildAvatarProactiveInvitation([
      entry('1', 2, ['事件:职业发展']),
      entry('2', 1, ['事件:职业发展']),
    ]);
    expect(invitation.title).toContain('职业发展');
    expect(invitation.prompts).toEqual(['为什么反复出现', '和过去相比', '形成一条理解']);
  });

  it('ignores locked and sample entries', () => {
    const invitation = buildAvatarProactiveInvitation([
      { ...entry('locked', 2, ['事件:工作']), isLocked: true },
      { ...entry('sample', 1, ['事件:工作']), isSample: true },
    ]);
    expect(invitation.sourceEntryId).toBeUndefined();
  });
});
