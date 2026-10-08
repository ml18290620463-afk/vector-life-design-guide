import { useCallback, useState } from 'react';
import { set } from 'idb-keyval';
import { AppError, reportError } from '../lib/error';
import { getDiaryStorageKeys, removeDiaryMirror } from '../services/diaryStorage';
import { vaultTransaction } from '../services/vaultTransaction';

type SyncStatus = 'synced' | 'local-only' | 'error' | 'merging' | 'mirror-skipped';

/** Keeps vault credential persistence isolated from the diary content store. */
export const useDiaryProtection = (userId: string | undefined) => {
  const [passwordHash, setPasswordHash] = useState<string | null>(null);
  const [passwordSalt, setPasswordSalt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');

  const savePasswordHash = useCallback(
    async (hash: string) => {
      const keys = getDiaryStorageKeys(userId);
      try {
        await vaultTransaction([keys.passwordHash], (values) => {
          values[keys.passwordHash] = hash;
        });
        setPasswordHash(hash);
      } catch (error) {
        reportError(AppError.fromError(error), 'savePasswordHash');
        setSyncStatus('error');
        throw error;
      }
      removeDiaryMirror(keys.passwordHash);
    },
    [userId],
  );

  const savePasswordSalt = useCallback(
    async (salt: string) => {
      const keys = getDiaryStorageKeys(userId);
      try {
        await set(keys.passwordSalt, salt);
        setPasswordSalt(salt);
      } catch (error) {
        reportError(AppError.fromError(error), 'savePasswordSalt');
        setSyncStatus('error');
        throw error;
      }
      removeDiaryMirror(keys.passwordSalt);
    },
    [userId],
  );

  const clearPasswordHash = useCallback(async () => {
    const keys = getDiaryStorageKeys(userId);
    const { changeFutureProtection } = await import('../services/vaultTransaction');
    await changeFutureProtection(null);
    await vaultTransaction([keys.passwordHash, keys.passwordSalt], (values) => {
      values[keys.passwordHash] = undefined;
      values[keys.passwordSalt] = undefined;
    });
    setPasswordHash(null);
    setPasswordSalt(null);
    removeDiaryMirror(keys.passwordHash);
    removeDiaryMirror(keys.passwordSalt);
  }, [userId]);

  return {
    passwordHash,
    setPasswordHash,
    passwordSalt,
    setPasswordSalt,
    syncStatus,
    setSyncStatus,
    savePasswordHash,
    savePasswordSalt,
    clearPasswordHash,
  };
};
