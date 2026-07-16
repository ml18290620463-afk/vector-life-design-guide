import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarChatPage } from './AvatarChatPage';
import type { DiaryEntry } from '../../../types';
import type { NowDraft, RecordPreviewPayload } from '../types/now';

const draft = (): NowDraft => ({
  text: '',
  materials: [],
  mood_tags: [],
  event_tags: [],
  record_time: '2026-07-09T10:30:00.000Z',
  display_time: '2026年7月9日10点30分',
  updated_at: '2026-07-09T10:30:00.000Z',
});

const entry = (): DiaryEntry => ({
  id: 'entry-1',
  title: '2026年7月6日13点45分',
  content: '今天客户方案被否定，我不开心。',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:难过', '事件:职业发展'],
  isLocked: false,
});

describe('AvatarChatPage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders avatar assistant intro and accepts user input', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.getByText(/我是你的分身/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('输入想记录的内容'), {
      target: { value: '今天客户方案被否定，我不开心' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(screen.getAllByText('今天客户方案被否定，我不开心').length).toBeGreaterThan(0);
    expect(screen.getByText(/感受偏向「难过」/)).toBeTruthy();
    expect(screen.getByText(/我联想到一条过去记录/)).toBeTruthy();
  });

  it('uses compact mobile header label', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        mobileShell
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.getByText('记录协助')).toBeTruthy();
    expect(screen.getByText('协助')).toBeTruthy();
  });
});
