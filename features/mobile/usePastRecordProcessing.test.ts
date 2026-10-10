import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../../types';
import { usePastRecordProcessing } from './usePastRecordProcessing';
const mocks = vi.hoisted(() => ({ preview: vi.fn(), write: vi.fn(), read: vi.fn() }));
vi.mock('../../services/avatarIntelligence', () => ({ buildAvatarGrowthPreview: mocks.preview }));
vi.mock('../../services/avatarMemory', () => ({
  readAvatarUnderstandings: () => [],
  readAvatarAtomicMemories: mocks.read,
  upsertAvatarAtomicMemories: mocks.write,
}));
const entry: DiaryEntry = {
  id: 'saved',
  title: '会议',
  content: '会议先确认目标',
  createdAt: 1,
  isLocked: false,
  tags: [],
};
beforeEach(() => {
  mocks.preview
    .mockReset()
    .mockResolvedValue({ atomicMemoryCandidates: [{ id: 'candidate', status: 'candidate' }] });
  mocks.read.mockReset().mockReturnValue([]);
  mocks.write.mockReset().mockReturnValue(true);
});
it('processes saved records in Past with source references, excluding locked and sample records', async () => {
  const entries = [
    entry,
    { ...entry, id: 'locked', isLocked: true },
    { ...entry, id: 'sample', isSample: true },
  ];
  renderHook(() => usePastRecordProcessing(entries));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
  expect(mocks.preview).toHaveBeenCalledOnce();
  expect(mocks.preview.mock.calls[0][0]).toMatchObject({ source: 'past', sourceEntryId: 'saved' });
  expect(mocks.write).toHaveBeenCalledWith([{ id: 'candidate', status: 'candidate' }]);
});
it('does not replace existing confirmed or rejected candidates on re-entry', async () => {
  mocks.read.mockReturnValue([{ id: 'candidate', status: 'rejected' }]);
  renderHook(() => usePastRecordProcessing([entry]));
  await waitFor(() => expect(mocks.write).toHaveBeenCalledWith([]));
});
it('cancels writes if the page closes while extraction is pending', async () => {
  let complete: (value: object) => void = () => {};
  mocks.preview.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { unmount } = renderHook(() => usePastRecordProcessing([entry]));
  unmount();
  complete({ atomicMemoryCandidates: [{ id: 'candidate' }] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.write).not.toHaveBeenCalled();
});
it('supports retry after failed candidate storage', async () => {
  mocks.write.mockReturnValueOnce(false).mockReturnValue(true);
  const entries = [entry];
  const { result } = renderHook(() => usePastRecordProcessing(entries));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  result.current.retry();
  await waitFor(() => expect(result.current.error).toBe(''));
  expect(mocks.write).toHaveBeenCalledTimes(2);
});
it('does not extract again when saving relations only changes updatedAt', async () => {
  const { rerender } = renderHook(({ entries }) => usePastRecordProcessing(entries), {
    initialProps: { entries: [entry] },
  });
  await waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
  rerender({ entries: [{ ...entry, updatedAt: 10, relatedEntryIds: ['other'] }] });
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(mocks.preview).toHaveBeenCalledOnce();
});
