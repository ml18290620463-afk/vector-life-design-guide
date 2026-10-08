import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
import { getDiaryStorageKeys } from './diaryStorage';
import { getLegacyStorageKeys, migrationEpochKey } from './diaryMigration';
import { emptyFutureState } from './futureRepository';
import { rawVaultTransaction as vaultTransaction } from './vaultTransaction';

export const WIPE_JOB = 'vector_vault_wipe_job_v1';
let recovery: Promise<void> | undefined;

/** A committed wipe remains recoverable until every legacy mirror is removed. */
export function recoverVaultWipe(): Promise<void> {
  if (recovery) return recovery;
  recovery = (async () => {
    const job = await vaultTransaction(
      [WIPE_JOB],
      (v) => v[WIPE_JOB] as string[] | undefined,
      true,
    );
    if (!job) return;
    for (const key of job) localStorage.removeItem(key);
    await vaultTransaction([WIPE_JOB], (v) => {
      v[WIPE_JOB] = undefined;
    });
  })().finally(() => {
    recovery = undefined;
  });
  return recovery;
}

export async function wipeVault(userId?: string) {
  await recoverVaultWipe();
  const keys = getDiaryStorageKeys(userId);
  const legacyKeys = getLegacyStorageKeys(userId);
  const epochKey = migrationEpochKey(userId);
  const mirrors = [
    ...Object.values(keys),
    ...legacyKeys,
    'vector:avatar:understandings:v1',
    'vector:avatar:sessions:v1',
    'now_draft',
    'pending_records',
    'user_custom_anchors',
  ];
  await vaultTransaction(
    [
      PRIVATE_DRAFT_KEY,
      epochKey,
      ...Object.values(keys),
      ...legacyKeys,
      WIPE_JOB,
      'vector_backup_restore_job_v1',
      'vector_source_deletion_journal_v1',
    ],
    (v) => {
      v[epochKey] = ((v[epochKey] as number | undefined) ?? 0) + 1;
      for (const key of Object.values(keys)) v[key] = [];
      for (const key of legacyKeys) v[key] = undefined;
      v[keys.future] = emptyFutureState();
      for (const key of [
        PRIVATE_DRAFT_KEY,
        keys.passwordHash,
        keys.passwordSalt,
        keys.deviceKeypair,
        keys.license,
        'vector_backup_restore_job_v1',
        'vector_source_deletion_journal_v1',
      ])
        v[key] = undefined;
      v[keys.initializedFlag] = true;
      v[WIPE_JOB] = mirrors;
    },
  );
  try {
    await recoverVaultWipe();
  } catch {
    throw new Error('资料库已清空，本地缓存待清理。请重新打开页面完成清理。');
  }
}
