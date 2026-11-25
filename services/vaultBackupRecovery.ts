import { normalizeAvatarBackupPayload } from './avatarOntologyMigration';
import {
  avatarBackupKeys,
  exportAvatarCheckpoint,
  prepareAvatarCheckpointRestore,
  assignAvatarCheckpoint,
} from './avatarOntologyBackupCheckpoint';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { accountLocalStorage } from './accountScope';
import { DiaryStorageKeys as K } from './diaryStorage';
import {
  rawVaultTransaction,
  preparedVaultTransaction,
  BACKUP_RESTORE_JOB,
} from './vaultTransaction';
import { useAppStore } from '../stores/appStore';
import { PAST_PROCESSING_KEY } from './pastProcessingCache';
const cacheKeys = [PAST_PROCESSING_KEY, 'user_custom_anchors'] as const;
const RESTORE_JOB = BACKUP_RESTORE_JOB;

/** A persisted restore decision repairs the legacy local caches after a crash. */
let recovery: Promise<void> | undefined;
export function recoverBackupRestore(): Promise<void> {
  if (recovery) return recovery;
  recovery = (async () => {
    if (!(await rawVaultTransaction([RESTORE_JOB], (v) => Boolean(v[RESTORE_JOB]), true))) return;
    // Boot must reach the unlock screen before an encrypted recovery job can run.
    const session = useAppStore.getState();
    const protectedVault = await rawVaultTransaction(
      [K.passwordHash],
      (v) => v[K.passwordHash] ?? accountLocalStorage.getItem(K.passwordHash),
      true,
    );
    if (protectedVault && (!session.isUnlocked || !session.masterPassword)) return;
    await withAvatarSession((assertCurrent) =>
      preparedVaultTransaction(
        [RESTORE_JOB, ...avatarBackupKeys],
        async (v) => {
          const job = v[RESTORE_JOB] as
            | { caches: Record<string, unknown[]>; mirrorKeys: string[] }
            | undefined;
          if (!job) return;
          const password = useAppStore.getState().masterPassword;
          const normalized = await normalizeAvatarBackupPayload(
            {
              caches: job.caches,
              ontology: v[AVATAR_ONTOLOGY_KEY] as AvatarOntologySnapshot | undefined,
              migrationCheckpoint: await exportAvatarCheckpoint(v),
            },
            password,
          );
          const checkpoint = await prepareAvatarCheckpointRestore(
            v,
            normalized,
            'merge',
            password ?? undefined,
            password,
          );
          assignAvatarCheckpoint(v, checkpoint, normalized.ontology);
          v[AVATAR_ONTOLOGY_KEY] = normalized.ontology;
          assertCurrent();
          for (const key of cacheKeys)
            accountLocalStorage.setItem(key, JSON.stringify(normalized.caches[key] ?? []));
          for (const key of job.mirrorKeys) accountLocalStorage.removeItem(key);
          accountLocalStorage.removeItem(K.backup);
          v[RESTORE_JOB] = undefined;
        },
        false,
        undefined,
        assertCurrent,
      ),
    );
  })().finally(() => {
    recovery = undefined;
  });
  return recovery;
}
