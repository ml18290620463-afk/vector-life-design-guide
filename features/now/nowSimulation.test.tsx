import '@testing-library/jest-dom/vitest';
import React, { useState } from 'react';
import { clear } from 'idb-keyval';
import { loadNowDraft } from '../../services/nowDraftRepository';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useNowDraft } from './hooks/useNowDraft';
import { useMaterialPicker } from './hooks/useMaterialPicker';
import { NowFlow } from './NowFlow';
import { TagSelectPage } from './components/TagSelectPage';
import { createEmptyDraft } from './state/nowRules';
import { postRecord } from './api/records';
import { STORAGE_KEYS } from './constants/config';
import type { Material, NowRoute } from './types/now';

// jsdom does not implement the native dialog lifecycle.
beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () {
    this.removeAttribute('open');
  });
});

vi.mock('./api/records', () => ({ postRecord: vi.fn().mockResolvedValue({}) }));
vi.mock('../../services/neuralSemanticRecall', () => ({
  findNeuralRelatedEntryIds: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/avatarIntelligence', () => ({
  buildAvatarGrowthPreview: vi.fn().mockResolvedValue({ atomicMemoryCandidates: [] }),
}));

beforeEach(async () => {
  await clear();
  vi.stubGlobal('prompt', vi.fn());
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(postRecord).mockResolvedValue({ id: 'remote', sync_status: 'synced' });
});

type Persist = React.ComponentProps<typeof NowFlow>['onPersistRecord'];
function Flow({ persist, exit = vi.fn() }: { persist: Persist; exit?: () => void }) {
  const [route, setRoute] = useState<NowRoute>('now');
  return (
    <NowFlow
      route={route}
      theme="dark"
      language="zh"
      onRouteChange={setRoute}
      onExit={exit}
      onPersistRecord={persist}
    />
  );
}
const input = () => screen.getByLabelText('此刻发生了什么？');
function fillRecord() {
  fireEvent.change(input(), { target: { value: '今天主动澄清会议目标，讨论更聚焦。' } });
  fireEvent.click(screen.getByLabelText('心情与事件'));
  fireEvent.click(screen.getByRole('button', { name: '工作事业' }));
  fireEvent.click(screen.getByRole('button', { name: '确定' }));
}
const saved: Persist = async (payload) => ({
  ...payload,
  id: payload.id ?? 'test-record',
  createdAt: Date.now(),
  isLocked: false,
});

describe('Now simulated input integration', () => {
  it('saves entered text and event without mood, preserves timestamp, clears editor', async () => {
    const persist = vi.fn(saved);
    render(<Flow persist={persist} />);
    await screen.findByLabelText('此刻发生了什么？');
    const timestamp = document.querySelector('time')!.textContent;
    fillRecord();
    fireEvent.click(screen.getByLabelText('保存到过去'));
    await screen.findByRole('heading', { name: '经历已保存' });
    fireEvent.click(screen.getByRole('button', { name: '继续记录' }));
    await waitFor(() => expect(input()).toHaveValue(''));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toMatchObject({
      content: '今天主动澄清会议目标，讨论更聚焦。',
      tags: ['事件:工作事业'],
      title: timestamp,
    });
  });
  it('retains failed draft and reuses id on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('模拟存储失败'))
      .mockImplementation(saved);
    render(<Flow persist={persist} />);
    await screen.findByLabelText('此刻发生了什么？');
    fillRecord();
    fireEvent.click(screen.getByLabelText('保存到过去'));
    await screen.findByText('模拟存储失败');
    expect(input()).toHaveValue('今天主动澄清会议目标，讨论更聚焦。');
    fireEvent.click(screen.getByLabelText('保存到过去'));
    await screen.findByRole('heading', { name: '经历已保存' });
    fireEvent.click(screen.getByRole('button', { name: '继续记录' }));
    await waitFor(() => expect(input()).toHaveValue(''));
    expect(persist.mock.calls[0][0].id).toBe(persist.mock.calls[1][0].id);
  });
  it('blocks repeated save while persistence is pending', async () => {
    let resolve!: (v: Awaited<ReturnType<Persist>>) => void;
    const persist = vi.fn<Persist>(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<Flow persist={persist} />);
    await screen.findByLabelText('此刻发生了什么？');
    fillRecord();
    const send = screen.getByLabelText('保存到过去');
    fireEvent.click(send);
    fireEvent.click(send);
    expect(send).toBeDisabled();
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await act(async () => resolve(await saved(persist.mock.calls[0][0])));
  });
  it('commits locally without creating a plaintext remote queue', async () => {
    const persist = vi.fn(saved);
    render(<Flow persist={persist} />);
    await screen.findByLabelText('此刻发生了什么？');
    fillRecord();
    fireEvent.click(screen.getByLabelText('保存到过去'));
    await screen.findByRole('heading', { name: '经历已保存' });
    fireEvent.click(screen.getByRole('button', { name: '继续记录' }));
    await waitFor(() => expect(input()).toHaveValue(''));
    expect(persist).toHaveBeenCalledOnce();
    expect(postRecord).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.pendingRecords)).toBeNull();
  });
  it('saves the draft before returning and restores it on re-entry', async () => {
    const exit = vi.fn();
    const view = render(<Flow persist={vi.fn(saved)} exit={exit} />);
    await screen.findByLabelText('此刻发生了什么？');
    fillRecord();
    fireEvent.click(screen.getByLabelText('返回'));
    await waitFor(() => expect(exit).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
    const hook = renderHook(() => useNowDraft());
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.draft.text).toBe('今天主动澄清会议目标，讨论更聚焦。');
  });
  it.each(['继续编辑', '确认清空'])(
    'explicit clear choice %s preserves or clears the draft',
    async (choice) => {
      const exit = vi.fn();
      const view = render(<Flow persist={vi.fn(saved)} exit={exit} />);
      await screen.findByLabelText('此刻发生了什么？');
      fillRecord();
      fireEvent.click(screen.getByRole('button', { name: '清空草稿' }));
      fireEvent.click(screen.getByRole('button', { name: choice }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const expected = choice === '继续编辑' ? '今天主动澄清会议目标，讨论更聚焦。' : '';
      expect(input()).toHaveValue(expected);
      expect(exit).not.toHaveBeenCalled();
      view.unmount();
      await waitFor(async () => expect((await loadNowDraft()).draft?.text ?? '').toBe(expected));
      const hook = renderHook(() => useNowDraft());
      await waitFor(() => expect(hook.result.current.ready).toBe(true));
      expect(hook.result.current.draft.text).toBe(expected);
    },
  );
  it('cancels unconfirmed tag changes', async () => {
    render(<Flow persist={vi.fn(saved)} />);
    await screen.findByLabelText('此刻发生了什么？');
    fireEvent.click(screen.getByLabelText('心情与事件'));
    fireEvent.click(screen.getByText('平静'));
    fireEvent.click(screen.getByLabelText('返回'));
    expect(screen.getByText('标签')).toBeDefined();
  });
  it.each([' ', '短', '这是超过十二个字符的自定义标签内容'])(
    'rejects invalid custom tag %s',
    (value) => {
      vi.spyOn(window, 'prompt').mockReturnValue(value);
      render(
        <TagSelectPage
          draft={createEmptyDraft()}
          setDraft={vi.fn()}
          onBack={vi.fn()}
          showToast={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('为事件添加自定义锚点'));
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customAnchors) || '[]')).toEqual([]);
    },
  );
  it('trims and deduplicates custom tags', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  深度学习  ');
    render(
      <TagSelectPage
        draft={createEmptyDraft()}
        setDraft={vi.fn()}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('为事件添加自定义锚点'));
    fireEvent.click(screen.getByLabelText('为事件添加自定义锚点'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customAnchors) || '[]')).toEqual([
      '深度学习',
    ]);
  });
  it('rejects whitespace content and exits an empty editor without a prompt', async () => {
    const persist = vi.fn(saved),
      exit = vi.fn();
    render(<Flow persist={persist} exit={exit} />);
    await screen.findByLabelText('此刻发生了什么？');
    fireEvent.click(screen.getByLabelText('返回'));
    expect(exit).toHaveBeenCalledOnce();
    expect(window.prompt).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('保存到过去'));
    expect(persist).not.toHaveBeenCalled();
    expect(input()).toHaveAttribute('maxlength', '5000');
  });
  it('enforces max three tags and supports deselection', () => {
    const toast = vi.fn();
    const setDraft = vi.fn();
    render(
      <TagSelectPage
        draft={createEmptyDraft()}
        setDraft={setDraft}
        onBack={vi.fn()}
        showToast={toast}
      />,
    );
    for (const label of ['工作事业', '财务收支', '身心健康', '人际交往'])
      fireEvent.click(screen.getByText(label));
    expect(toast).toHaveBeenCalledWith('最多选择 3 个');
    fireEvent.click(screen.getByText('工作事业'));
    fireEvent.click(screen.getByText('确定'));
    expect(setDraft.mock.calls[0][0](createEmptyDraft()).event_tags).toEqual([
      '财务收支',
      '身心健康',
    ]);
  });
  it('warns before leaving unsaved input and stops warning after saving', async () => {
    const h = renderHook(() => useNowDraft());
    await waitFor(() => expect(h.result.current.ready).toBe(true));
    const empty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(empty);
    expect(empty.defaultPrevented).toBe(false);
    act(() => h.result.current.setDraft((d) => ({ ...d, text: '尚未保存的经历' })));
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    await act(async () => {
      await h.result.current.saveDraft();
    });
    const saved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });
  it('flushes typing on unmount and restores it on remount', async () => {
    const h = renderHook(() => useNowDraft());
    await waitFor(() => expect(h.result.current.ready).toBe(true));
    act(() => h.result.current.setDraft((d) => ({ ...d, text: '尚未保存的经历' })));
    h.unmount();
    await waitFor(async () => expect((await loadNowDraft()).draft?.text).toBe('尚未保存的经历'));
    const fresh = renderHook(() => useNowDraft());
    await waitFor(() => expect(fresh.result.current.ready).toBe(true));
    expect(fresh.result.current.draft.text).toBe('尚未保存的经历');
  });
});

describe('Now material input', () => {
  const setup = (materials: Material[] = []) => {
    const onAdd = vi.fn(),
      onError = vi.fn();
    const hook = renderHook(() => useMaterialPicker({ materials, onAdd, onError }));
    return { ...hook, onAdd, onError };
  };
  it('adds a valid link and cancels an empty prompt', () => {
    const h = setup();
    vi.spyOn(window, 'prompt').mockReturnValueOnce('https://example.com').mockReturnValueOnce(null);
    act(() => h.result.current.addLink());
    act(() => h.result.current.addLink());
    expect(h.onAdd).toHaveBeenCalledTimes(1);
    expect(h.onAdd.mock.calls[0][0][0].url).toBe('https://example.com/');
  });
  it('accepts a pasted domain without requiring a protocol', () => {
    const h = setup();
    vi.spyOn(window, 'prompt').mockReturnValue('  example.com/article  ');
    act(() => h.result.current.addLink());
    expect(h.onAdd.mock.calls[0][0][0].url).toBe('https://example.com/article');
  });
  it.each(['   ', 'not a url', 'javascript:alert(1)'])('reject invalid link %s', (value) => {
    const h = setup();
    vi.spyOn(window, 'prompt').mockReturnValue(value);
    act(() => h.result.current.addLink());
    expect(h.onAdd).not.toHaveBeenCalled();
  });
  it.each(['image', 'video'] as const)(
    'reads %s file and rejects oversized input',
    async (type) => {
      const h = setup();
      const file = new File(['test'], `sample.${type}`, {
        type: `${type}/${type === 'image' ? 'png' : 'mp4'}`,
      });
      await act(async () => h.result.current.addFiles([file] as unknown as FileList, type));
      expect(h.onAdd.mock.calls[0][0][0]).toMatchObject({ type, local_path: file.name });
      expect(h.onAdd.mock.calls[0][0][0].url).toMatch(/^data:/);
      Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 });
      await act(async () => h.result.current.addFiles([file] as unknown as FileList, type));
      expect(h.onError).toHaveBeenCalled();
      expect(h.onAdd).toHaveBeenCalledTimes(1);
    },
  );
  it('caps a nine-image selection at eight', async () => {
    const h = setup();
    const files = Array.from(
      { length: 9 },
      (_, i) => new File(['x'], `${i}.png`, { type: 'image/png' }),
    );
    await act(async () => h.result.current.addFiles(files as unknown as FileList, 'image'));
    expect(h.onAdd.mock.calls[0][0]).toHaveLength(8);
  });
  it('rejects link when an image exists', () => {
    const h = setup([{ id: 'i', type: 'image', url: '', sort_order: 0 }]);
    act(() => h.result.current.addLink());
    expect(h.onError).toHaveBeenCalled();
    expect(h.onAdd).not.toHaveBeenCalled();
  });
  it('rejects non-image contents selected for image import', async () => {
    const h = setup();
    await act(async () =>
      h.result.current.addFiles(
        [new File(['text'], 'bad.txt', { type: 'text/plain' })] as unknown as FileList,
        'image',
      ),
    );
    expect(h.onAdd).not.toHaveBeenCalled();
  });
});
