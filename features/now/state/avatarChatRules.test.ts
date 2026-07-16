import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants/config';
import {
  buildAssistantTextMessage,
  buildRecordPreviewMessage,
  buildUserTextMessage,
  getAvatarIntroMessages,
  readAndMarkAvatarIntroFirstVisit,
} from './avatarChatRules';

describe('avatarChatRules', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('builds richer intro messages for first avatar visit', () => {
    let index = 0;
    const messages = getAvatarIntroMessages({
      isFirstVisit: true,
      createdAt: '2026-07-09T10:30:00.000Z',
      createId: () => `msg-${(index += 1)}`,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(
      expect.objectContaining({ id: 'msg-1', role: 'assistant', type: 'text' }),
    );
    expect(messages[0].content).toContain('我是你的分身');
    expect(messages[1].content).toContain('边听边提炼');
  });

  it('builds compact intro after the first avatar visit', () => {
    const messages = getAvatarIntroMessages({
      isFirstVisit: false,
      createdAt: '2026-07-09T10:30:00.000Z',
      createId: () => 'msg-1',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('你自然说');
  });

  it('introduces the standalone avatar as a second perspective instead of a recorder', () => {
    const messages = getAvatarIntroMessages({
      isFirstVisit: true,
      createdAt: '2026-07-09T10:30:00.000Z',
      createId: () => 'msg-general',
      mode: 'general',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('另一个角度');
    expect(messages[0].content).not.toContain('帮你记录');
  });

  it('frames action review around actual outcomes', () => {
    const messages = getAvatarIntroMessages({
      isFirstVisit: false,
      createdAt: '2026-07-09T10:30:00.000Z',
      createId: () => 'msg-review',
      mode: 'review',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('真实发生的结果');
    expect(messages[0].content).toContain('需要调整');
  });

  it('reads and marks avatar intro state in storage', () => {
    expect(readAndMarkAvatarIntroFirstVisit()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.avatarIntroShown)).toBe('true');
    expect(readAndMarkAvatarIntroFirstVisit()).toBe(false);
  });

  it('builds user, assistant and preview messages consistently', () => {
    const createdAt = '2026-07-09T10:30:00.000Z';
    expect(buildUserTextMessage('我不开心', { id: 'user-1', createdAt })).toEqual({
      id: 'user-1',
      role: 'user',
      type: 'text',
      content: '我不开心',
      created_at: createdAt,
    });
    expect(buildAssistantTextMessage('我听到了', { id: 'assistant-1', createdAt })).toEqual({
      id: 'assistant-1',
      role: 'assistant',
      type: 'text',
      content: '我听到了',
      created_at: createdAt,
    });
    expect(
      buildRecordPreviewMessage(
        {
          text: '今天不开心',
          mood_tags: ['难过'],
          event_tags: ['个人成长'],
          record_time: createdAt,
          display_time: '2026年7月9日10点30分',
          is_sparse: false,
        },
        { id: 'preview-1', createdAt },
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'preview-1',
        role: 'assistant',
        type: 'record_preview',
        content: 'record_preview',
        created_at: createdAt,
      }),
    );
  });
});
