import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNowDraft } from './useNowDraft';
import { loadNowDraft, saveNowDraft } from '../../../services/nowDraftRepository';
vi.mock('../../../services/nowDraftRepository', () => ({
  loadNowDraft: vi.fn(),
  saveNowDraft: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadNowDraft).mockResolvedValue({ revision: 4, draft: null });
  vi.mocked(saveNowDraft).mockImplementation(async (draft, revision) => ({
    revision: revision + 1,
    draft,
  }));
});
afterEach(cleanup);
describe('draft recovery lifecycle', () => {
  it('gates editing after load failure and allows a new load attempt', async () => {
    vi.mocked(loadNowDraft).mockRejectedValueOnce(new Error('读取失败'));
    const { result } = renderHook(useNowDraft);
    await waitFor(() => expect(result.current.error).toBe('读取失败'));
    expect(result.current.ready).toBe(false);
    expect(await result.current.saveDraft()).toBe(false);
    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
  it('retains unsaved text after failure and reports only a successful retry as saved', async () => {
    const { result } = renderHook(useNowDraft);
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setDraft((draft) => ({ ...draft, text: '保留原文' })));
    vi.mocked(saveNowDraft).mockRejectedValueOnce(new Error('空间不足'));
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(false);
    });
    expect(result.current.draft.text).toBe('保留原文');
    expect(result.current.error).toBe('空间不足');
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true);
    });
    expect(result.current.error).toBe('');
    expect(result.current.status).toBe('草稿已保存在本机');
  });
  it('serializes reset after an in-flight save and never resurrects a queued old draft', async () => {
    const { result } = renderHook(useNowDraft);
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.setDraft((draft) => ({ ...draft, text: '旧草稿' })));
    let resolve!: (value: Awaited<ReturnType<typeof saveNowDraft>>) => void;
    vi.mocked(saveNowDraft).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.saveDraft();
    });
    await waitFor(() => expect(saveNowDraft).toHaveBeenCalledOnce());
    const snapshot = result.current.draft;
    await act(async () => {
      const queued = result.current.saveDraft();
      const reset = result.current.resetAfterSend();
      resolve({ revision: 5, draft: snapshot });
      await Promise.all([first, queued, reset]);
    });
    expect(saveNowDraft).toHaveBeenCalledTimes(2);
    expect(saveNowDraft).toHaveBeenLastCalledWith(null, 5);
    expect(result.current.draft.text).toBe('');
  });
});
