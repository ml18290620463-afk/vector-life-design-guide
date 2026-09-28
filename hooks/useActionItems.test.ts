import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { readStoredArray } from '../services/diaryDataRead';
import { publishVaultChange, VaultLockedError } from '../services/vaultTransaction';
import { useActionItems } from './useActionItems';

vi.mock('../services/diaryDataRead', async (original) => ({
  ...(await original<typeof import('../services/diaryDataRead')>()),
  readStoredArray: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

it('allows unified login while locked, blocks writes, and reloads after login', async () => {
  vi.mocked(readStoredArray).mockRejectedValue(new VaultLockedError());
  const { result } = renderHook(() => useActionItems(undefined));
  await waitFor(() => expect(readStoredArray).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  expect(result.current.actionsLoadError).toBeNull();
  await expect(result.current.addAction({ title: 'blocked', status: 'pending' })).rejects.toThrow('解锁');
  vi.mocked(readStoredArray).mockResolvedValue([]);
  act(() => publishVaultChange());
  await waitFor(() => expect(readStoredArray).toHaveBeenCalledTimes(2));
  expect(result.current.actionsLoadError).toBeNull();
});

it('still reports real storage failures', async () => {
  vi.mocked(readStoredArray).mockRejectedValue(new Error('存储损坏'));
  const { result } = renderHook(() => useActionItems(undefined));
  await waitFor(() => expect(result.current.actionsLoadError).toBe('存储损坏'));
});
