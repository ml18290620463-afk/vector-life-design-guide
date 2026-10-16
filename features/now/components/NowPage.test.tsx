import { useState } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        mobileShell
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

    expect(screen.queryByRole('dialog', { name: '选择标签' })).toBeNull();
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
    expect(screen.getByText('标签')).toBeDefined();
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
        mobileShell
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

  it('exposes the editor label accessibly and hides the character count until near the limit', () => {
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
    expect(screen.queryByText(`6/${5000}`)).toBeNull();
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

  it('keeps the editor free of persistent feature annotations', () => {
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

    expect(screen.getByLabelText('添加素材').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByLabelText('此刻发生了什么？').getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText(/素材是这次经历的证据/)).toBeNull();
    expect(screen.queryByText(/保存后可在/)).toBeNull();
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
    fireEvent.click(screen.getByLabelText('清空草稿'));
    expect(discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('确认清空'));
    await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
    expect(onExit).not.toHaveBeenCalled();
  });
});

it('protects pending files and saves mixed pasted, dropped and linked materials', async () => {
  const readers: FileReader[] = [];
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
    readers.push(this);
  });
  const onSend = vi.fn();
  const onExit = vi.fn();
  function Editor() {
    const [draft, setDraft] = useState(
      makeDraft({
        text: '原始文字',
        materials: [
          { id: 'link1', type: 'link', url: 'https://example.com', sort_order: 0 },
          { id: 'link2', type: 'link', url: 'https://example.org', sort_order: 1 },
        ],
      }),
    );
    return (
      <NowPage
        draft={draft}
        setDraft={setDraft}
        sending={false}
        onSend={() => onSend(draft)}
        onExit={onExit}
        onSaveDraft={vi.fn()}
        onDiscardDraft={vi.fn()}
        onRouteChange={vi.fn()}
        showToast={vi.fn()}
      />
    );
  }
  render(<Editor />);
  fireEvent.paste(screen.getByLabelText('此刻发生了什么？'), {
    clipboardData: { files: [new File(['a'], 'a.png', { type: 'image/png' })], getData: () => '' },
  });
  expect((screen.getByLabelText('保存到过去') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('保存到过去'));
  fireEvent.click(screen.getByLabelText('返回'));
  expect(onSend).not.toHaveBeenCalled();
  expect(onExit).not.toHaveBeenCalled();
  expect((screen.getByLabelText('此刻发生了什么？') as HTMLTextAreaElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('此刻发生了什么？'), {
    target: { value: '读取中继续写' },
  });
  await act(async () => {
    Object.defineProperty(readers[0], 'result', { value: 'data:image/png;base64,YQ==' });
    readers[0].onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
  });
  fireEvent.drop(screen.getByTestId('now-page'), {
    dataTransfer: { files: [new File(['b'], 'b.png', { type: 'image/png' })] },
  });
  await act(async () => {
    Object.defineProperty(readers[1], 'result', { value: 'data:image/png;base64,Yg==' });
    readers[1].onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
  });
  fireEvent.click(screen.getByLabelText('保存到过去'));
  expect(onSend.mock.calls[0][0].text).toBe('读取中继续写');
  expect(onSend.mock.calls[0][0].materials.map((m: { type: string }) => m.type)).toEqual([
    'link',
    'link',
    'image',
    'image',
  ]);
  vi.restoreAllMocks();
});

it('blocks incomplete saving until a failed material is explicitly removed', async () => {
  const readers: FileReader[] = [];
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
    readers.push(this);
  });
  const onSend = vi.fn();
  render(
    <NowPage
      draft={makeDraft({ text: '保留文字' })}
      setDraft={vi.fn()}
      sending={false}
      onSend={onSend}
      onSaveDraft={vi.fn()}
      onDiscardDraft={vi.fn()}
      onExit={vi.fn()}
      onRouteChange={vi.fn()}
      showToast={vi.fn()}
    />,
  );
  fireEvent.paste(screen.getByLabelText('此刻发生了什么？'), {
    clipboardData: {
      files: [new File(['a'], 'failure.png', { type: 'image/png' })],
      getData: () => '',
    },
  });
  await act(async () => {
    readers[0].onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
  });
  expect(screen.getByRole('alert').textContent).toContain('failure.png');
  expect((screen.getByLabelText('保存到过去') as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('此刻发生了什么？') as HTMLTextAreaElement).value).toBe('保留文字');
  fireEvent.click(screen.getByText('移除'));
  expect((screen.getByLabelText('保存到过去') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByLabelText('保存到过去'));
  expect(onSend).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
