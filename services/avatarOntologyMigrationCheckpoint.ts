/** Encrypted migration archive transport; never writes legacy runtime storage. */
import {
  AVATAR_V1_KEYS,
  convertAvatarV1Snapshot,
  type RawStore,
  type Snapshot,
} from './avatarOntologyMigration';
import { AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY } from './avatarOntologyKey';
import {
  decryptVaultBackupFile,
  encryptVaultBackupFile,
  isEncryptedVaultBackup,
  type EncryptedVaultBackup,
} from './vaultBackupFile';
import { useAppStore } from '../stores/appStore';
import { currentAccountId } from './accountScope';
import { VaultLockedError } from './vaultTransaction';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface AvatarMigrationCheckpoint {
  snapshot: EncryptedVaultBackup;
  result: EncryptedVaultBackup;
}

/** Portable checkpoints remain encrypted even inside a decrypted backup. */
export async function decodeAvatarMigrationCheckpoint(
  checkpoint: AvatarMigrationCheckpoint,
  password: string,
  expectedAccountId?: string | null,
) {
  if (!isEncryptedVaultBackup(checkpoint.snapshot) || !isEncryptedVaultBackup(checkpoint.result))
    throw new Error('迁移快照格式校验失败');
  const decoded = await decryptVaultBackupFile(checkpoint.snapshot, password);
  const raw = record(decoded) && record(decoded.raw) ? decoded.raw : undefined;
  if (
    !record(decoded) ||
    decoded.version !== 1 ||
    (decoded.accountId !== null && typeof decoded.accountId !== 'string') ||
    (expectedAccountId !== undefined && decoded.accountId !== expectedAccountId) ||
    typeof decoded.capturedAt !== 'string' ||
    !Number.isFinite(Date.parse(decoded.capturedAt)) ||
    !raw ||
    Object.keys(AVATAR_V1_KEYS).some((key) => raw[key] !== null && typeof raw[key] !== 'string')
  )
    throw new Error('迁移快照校验失败');
  const expected = convertAvatarV1Snapshot(raw as RawStore);
  if (!equal(await decryptVaultBackupFile(checkpoint.result, password), expected))
    throw new Error('迁移结果校验失败');
  return { snapshot: decoded as unknown as Snapshot, result: expected };
}

export function avatarMigrationCheckpointFrom(
  values: Record<string, unknown>,
): AvatarMigrationCheckpoint {
  const snapshot = values[AVATAR_MIGRATION_SNAPSHOT_KEY];
  const result = values[AVATAR_MIGRATION_RESULT_KEY];
  if (snapshot === undefined || result === undefined)
    throw new Error('已升级资料缺少迁移快照或结果，请恢复完整备份');
  if (!isEncryptedVaultBackup(snapshot) || !isEncryptedVaultBackup(result))
    throw new Error('迁移快照格式校验失败');
  return { snapshot, result };
}

/** Verify recovery material independently of the retired runtime storage. */
export async function verifyAvatarMigrationCheckpoint(values: Record<string, unknown>) {
  const password = useAppStore.getState().masterPassword;
  if (!useAppStore.getState().isUnlocked || !password) throw new VaultLockedError();
  await decodeAvatarMigrationCheckpoint(
    avatarMigrationCheckpointFrom(values),
    password,
    currentAccountId(),
  );
}

/** Used only by explicit restore/password rotation; no legacy runtime writes. */
export async function reencryptAvatarMigrationCheckpoint(
  checkpoint: AvatarMigrationCheckpoint,
  sourcePassword: string,
  targetPassword: string,
  targetAccountId: string | null,
) {
  if (!targetPassword) throw new VaultLockedError();
  const decoded = await decodeAvatarMigrationCheckpoint(checkpoint, sourcePassword);
  const next = {
    snapshot: await encryptVaultBackupFile(
      { ...decoded.snapshot, accountId: targetAccountId },
      targetPassword,
    ),
    result: await encryptVaultBackupFile(decoded.result, targetPassword),
  };
  await decodeAvatarMigrationCheckpoint(next, targetPassword, targetAccountId);
  return next;
}
