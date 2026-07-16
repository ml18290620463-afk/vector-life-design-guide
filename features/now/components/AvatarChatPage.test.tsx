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

  it('offers evidence-based conversation starters without sending automatically', () => {
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
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    expect(screen.getByText(/我有个问题/)).toBeTruthy();
    fireEvent.click(screen.getByText('这件事后来有变化吗？'));
    expect(screen.getByPlaceholderText('你想讨论什么？')).toHaveProperty(
      'value',
      '这件事后来有变化吗？',
    );
    expect(screen.queryAllByText('这件事后来有变化吗？')).toHaveLength(1);
  });

  it('persists a customized standalone avatar only after explicit save', () => {
    const showToast = vi.fn();
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={showToast}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '定制分身形象' }));
    fireEvent.change(screen.getByLabelText('怎么称呼它'), { target: { value: '星弦' } });
    fireEvent.click(screen.getByLabelText(/棱镜/));
    expect(localStorage.getItem('vector:avatar:appearance:v1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '保存为我的分身' }));
    expect(JSON.parse(localStorage.getItem('vector:avatar:appearance:v1')!)).toEqual(
      expect.objectContaining({ name: '星弦', shape: 'prism' }),
    );
    expect(showToast).toHaveBeenCalledWith('专属分身形象已保存到本机');
    expect(screen.getByText(/星弦 · GENERAL/)).toBeTruthy();
  });

  it('discards an appearance draft when cancelled', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '定制分身形象' }));
    fireEvent.change(screen.getByLabelText('怎么称呼它'), { target: { value: '未保存' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(localStorage.getItem('vector:avatar:appearance:v1')).toBeNull();
    expect(screen.queryByText('未保存')).toBeNull();
  });
});
