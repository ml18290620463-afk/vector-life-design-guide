import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NowPage } from './NowPage';
import type { NowDraft, NowRoute } from '../types/now';
// jsdom does not implement the native dialog lifecycle.
beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () {
    this.removeAttribute('open');
  });
});

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

  it('keeps recording in Now without a duplicate avatar entry', () => {
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

    expect(screen.queryByLabelText('分身记录')).toBeNull();
    fireEvent.click(screen.getByLabelText('心情与事件'));

    expect(onRouteChange).toHaveBeenCalledWith('tags');
  });

  it('saves content without requiring optional tags', () => {
    const showToast = vi.fn();
    const onSend = vi.fn();

    render(
      <NowPage
        draft={makeDraft({ text: '今天完成一次复盘' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={onSend}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onExit={vi.fn()}
        onRouteChange={vi.fn()}
        showToast={showToast}
      />,
    );

    fireEvent.click(screen.getByLabelText('保存到过去'));

    expect(showToast).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('心情与事件')).toBeDefined();
    expect(screen.getByText('标签（选填）')).toBeDefined();
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

    fireEvent.click(screen.getByLabelText('保存到过去'));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('2/2')).toBeNull();
    expect(screen.getByText('个人成长 · 平静')).toBeDefined();
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

  it('explains that materials are evidence rather than automatic avatar conclusions', () => {
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

    const hint = screen.getByText(
      '素材是这次经历的证据；分身会结合这条记录理解，不会自动把素材当成结论。',
    );
    expect(screen.getByLabelText('添加素材').getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('saves a non-empty draft before leaving without a confirmation', async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(true);
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
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
  });
  it('keeps the editor and draft when saving fails', async () => {
    const onExit = vi.fn();
    const showToast = vi.fn();
    render(
      <NowPage
        draft={makeDraft({ text: '保留这段内容' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn().mockResolvedValue(false)}
        onDiscardDraft={vi.fn()}
        onExit={onExit}
        onRouteChange={vi.fn()}
        showToast={showToast}
      />,
    );
    fireEvent.click(screen.getByLabelText('返回'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('草稿保存失败，请继续编辑并重试'));
    expect(onExit).not.toHaveBeenCalled();
    expect((screen.getByLabelText('此刻发生了什么？') as HTMLTextAreaElement).value).toBe(
      '保留这段内容',
    );
  });

  it('requires explicit confirmation to clear and stays in the editor', async () => {
    const discard = vi.fn().mockResolvedValue(true);
    const onExit = vi.fn();
    render(
      <NowPage
        draft={makeDraft({ text: '草稿' })}
        setDraft={vi.fn()}
        sending={false}
        onSend={vi.fn()}
        onSaveDraft={vi.fn()}
        onDiscardDraft={discard}
        onExit={onExit}
        onRouteChange={vi.fn()}
        showToast={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('清空草稿'));
    expect(discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('确认清空'));
    await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
    expect(onExit).not.toHaveBeenCalled();
  });
});
