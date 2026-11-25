import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { preparedVaultTransaction } from './vaultTransaction';
import { DiaryStorageKeys as K } from './diaryStorage';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});

describe('asynchronous read transaction revalidation', () => {
  it('rejects a snapshot whose source changed during asynchronous validation', async () => {
    await set(K.entries, [{ id: 'original' }]);
    await expect(
      preparedVaultTransaction(
        [K.entries],
        async (values) => {
          await set(K.entries, [{ id: 'replacement' }]);
          return values[K.entries];
        },
        true,
      ),
    ).rejects.toThrow('同时发生了更新');
    expect(await get(K.entries)).toEqual([{ id: 'replacement' }]);
  });

  it('rejects newly enabled protection before returning an unprotected snapshot', async () => {
    await set(K.entries, [{ id: 'original' }]);
    await expect(
      preparedVaultTransaction(
        [K.entries],
        async (values) => {
          await set(K.passwordHash, 'new-password-hash');
          return values[K.entries];
        },
        true,
      ),
    ).rejects.toThrow('同时发生了更新');
  });

  it('rejects lock-unlock transitions during read validation', async () => {
    await expect(
      preparedVaultTransaction(
        [K.entries],
        async () => {
          useAppStore.setState({ isUnlocked: false });
          useAppStore.setState({ isUnlocked: true });
          return 'stale';
        },
        true,
      ),
    ).rejects.toThrow('解锁');
  });

  it('checks the caller permission guard before returning and does not persist callback edits', async () => {
    await set(K.entries, [{ id: 'original' }]);
    const guard = vi.fn();
    const result = await preparedVaultTransaction(
      [K.entries],
      async (values) => {
        values[K.entries] = [];
        return 'verified';
      },
      true,
      undefined,
      guard,
    );
    expect(result).toBe('verified');
    expect(guard).toHaveBeenCalledTimes(1);
    expect(await get(K.entries)).toEqual([{ id: 'original' }]);
    await expect(
      preparedVaultTransaction(
        [K.entries],
        () => 'stale',
        true,
        undefined,
        () => {
          throw new Error('permission revoked');
        },
      ),
    ).rejects.toThrow('permission revoked');
  });
});
