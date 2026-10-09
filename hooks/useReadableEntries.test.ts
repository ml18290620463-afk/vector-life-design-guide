import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiaryEntry } from '../types';
import { SecurityService } from '../services/securityService';
import { useReadableEntries } from './useReadableEntries';

const entry: DiaryEntry = {
  id: 'restored',
  title: '记录',
  content: 'ciphertext',
  tags: [],
  createdAt: 1,
  isLocked: false,
  isEncrypted: true,
};
afterEach(() => vi.restoreAllMocks());

it('decrypts a session read model without mutating the stored entry', async () => {
  const decrypt = vi.spyOn(SecurityService, 'decrypt').mockResolvedValue('恢复的正文');
  const stored = [Object.freeze({ ...entry })];
  const { result } = renderHook(() => useReadableEntries(stored, true, 'destination-key'));
  await waitFor(() => expect(result.current.entries[0]?.content).toBe('恢复的正文'));
  expect(decrypt).toHaveBeenCalledWith('ciphertext', 'destination-key');
  expect(result.current.entries[0].isEncrypted).toBe(false);
  expect(stored[0]).toEqual(entry);
});

it('hides plaintext immediately on lock and discards a late decryption', async () => {
  let finish!: (value: string) => void;
  vi.spyOn(SecurityService, 'decrypt').mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const stored = [entry];
  const { result, rerender } = renderHook(
    ({ unlocked }) => useReadableEntries(stored, unlocked, unlocked ? 'key' : null),
    { initialProps: { unlocked: true } },
  );
  rerender({ unlocked: false });
  await act(async () => finish('late plaintext'));
  expect(result.current).toEqual({ entries: [], error: null });
});

it('does not expose stale data when the source or session key changes', async () => {
  vi.spyOn(SecurityService, 'decrypt')
    .mockResolvedValueOnce('old plaintext')
    .mockRejectedValueOnce(new Error('wrong key'));
  const stored = [entry];
  const { result, rerender } = renderHook(
    ({ password }) => useReadableEntries(stored, true, password),
    { initialProps: { password: 'old' } },
  );
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  rerender({ password: 'wrong' });
  expect(result.current.entries).toEqual([]);
  await waitFor(() => expect(result.current.error).toContain('无法解密'));
  expect(stored[0].content).toBe('ciphertext');
});

it('keeps sealed or future records out of readable previews and model context', async () => {
  const decrypt = vi.spyOn(SecurityService, 'decrypt');
  const stored = [
    {
      ...entry,
      isLocked: true,
      reflection: 'secret',
      attachment: {
        type: 'image' as const,
        name: 'secret',
        data: 'private',
        mimeType: 'image/png',
      },
    },
    { ...entry, id: 'future', unlockAt: Date.now() + 60_000 },
  ];
  const { result } = renderHook(() => useReadableEntries(stored, true, 'key'));
  await waitFor(() => expect(result.current.entries).toHaveLength(2));
  expect(
    result.current.entries.every((e) => e.content === '' && !e.attachment && !e.reflection),
  ).toBe(true);
  expect(decrypt).not.toHaveBeenCalled();
});
