import { AVATAR_V1_KEYS } from './avatarLegacyTypes';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
import { accountLocalStorage } from './accountScope';
import { PAST_PROCESSING_KEY } from './pastProcessingCache';
import { PRIVATE_DRAFT_KEY, FUTURE_DRAFT_KEY } from './privateDraftKey';
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
    for (const key of job) accountLocalStorage.removeItem(key);
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
  const avatarKeys = [
    AVATAR_ONTOLOGY_KEY,
    AVATAR_MIGRATION_SNAPSHOT_KEY,
    AVATAR_MIGRATION_RESULT_KEY,
    ...Object.values(AVATAR_V1_KEYS),
  ];
  const mirrors = [
    ...avatarKeys,
    PAST_PROCESSING_KEY,
    ...Object.values(keys),
    ...legacyKeys,
    `vector:backup-status:v1:${userId ?? 'local'}`,
    'now_draft',
    'pending_records',
    'user_custom_anchors',
  ];
  await vaultTransaction(
    [
      ...avatarKeys,
      PRIVATE_DRAFT_KEY,
      FUTURE_DRAFT_KEY,
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
      for (const key of avatarKeys) v[key] = undefined;
      for (const key of legacyKeys) v[key] = undefined;
      v[keys.future] = emptyFutureState();
      for (const key of [
        PRIVATE_DRAFT_KEY,
        FUTURE_DRAFT_KEY,
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
