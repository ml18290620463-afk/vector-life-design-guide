import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NowPage } from './NowPage';
import type { NowDraft, NowRoute } from '../types/now';

const makeDraft = (overrides: Partial<NowDraft> = {}): NowDraft => ({
  text: '',
  materials: [],
  mood_tags: [],
  event_tags: [],
  record_time: '2026-07-09T10:30:00.000Z',
  display_time: '2026年7月9日10点30分',
  updated_at: '2026-07-09T10:30:00.000Z',
  ...overrides,
});

describe('NowPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('routes to avatar chat from the top-right entry', () => {
    const onRouteChange = vi.fn();

    render(
      <NowPage
        draft={makeDraft()}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={onRouteChange}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('分身记录'));

    expect(onRouteChange).toHaveBeenCalledWith('avatar-chat');
  });

  it('shows disabled send reason before the draft is complete', () => {
    const showToast = vi.fn();

    render(
      <NowPage
        draft={makeDraft({ text: '今天完成一次复盘' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={vi.fn()}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByLabelText('发送过去'));

    expect(showToast).toHaveBeenCalledWith('请选择心情标签');
    expect(screen.getByLabelText('心情与事件')).toBeDefined();
    expect(screen.getByText('0/2')).toBeDefined();
  });

  it('sends when content and tags are complete', () => {
    const onSend = vi.fn();

    render(
      <NowPage
        draft={makeDraft({
          text: '今天完成一次复盘',
          mood_tags: ['平静'],
          event_tags: ['个人成长'],
        })}
        setDraft={vi.fn()}
        sending={false}
        onSend={onSend}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={vi.fn<(route: NowRoute) => void>()}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('发送过去'));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2/2')).toBeDefined();
    expect(screen.getByText('平静 · 个人成长')).toBeDefined();
  });

  it('routes to tags from the anchor point', () => {
    const onRouteChange = vi.fn();

    render(
      <NowPage
        draft={makeDraft()}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={onRouteChange}
        showToast={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('心情与事件'));

    expect(onRouteChange).toHaveBeenCalledWith('tags');
  });

  it('exposes the editor label accessibly and keeps the character count visible', () => {
    render(
      <NowPage
        draft={makeDraft({ text: '刚刚散步回来' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('此刻发生了什么？')).toBeDefined();
    expect(screen.getByText(`6/${5000}`)).toBeDefined();
  });

  it('collects upload actions behind the add button', () => {
    render(
      <NowPage
        draft={makeDraft()}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={vi.fn()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('图片')).toBeNull();
    expect(screen.queryByLabelText('视频')).toBeNull();
    expect(screen.queryByLabelText('链接')).toBeNull();

    fireEvent.click(screen.getByLabelText('添加素材'));

    expect(screen.getByLabelText('收起素材')).toBeDefined();
    expect(screen.getByLabelText('图片')).toBeDefined();
    expect(screen.getByLabelText('视频')).toBeDefined();
    expect(screen.getByLabelText('链接')).toBeDefined();
    expect(screen.queryByLabelText('导入音频文件')).toBeNull();
  });

  it('prompts to save or discard when leaving a non-empty draft', () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => '1'),
    );
    const onSaveDraft = vi.fn();
    const onExit = vi.fn();

    render(
      <NowPage
        draft={makeDraft({ text: '未完成内容' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={onSaveDraft}
        onDiscardDraft={vi.fn()}
        onExit={onExit}
        onRouteChange={vi.fn()}
        showToast={vi.fn()}
        mobileShell
      />,
    );

    fireEvent.click(screen.getByLabelText('返回过去'));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
