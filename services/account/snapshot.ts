import {
  migrateAvatarTransport,
  readLegacyAvatarTransportCaches,
  isLegacyAvatarTransportKey,
  hasLegacyAvatarTransport,
  retireLegacyAvatarTransportCaches,
} from '../avatarOntologyMigration';
import { useAppStore } from '../../stores/appStore';
import { VaultLockedError } from '../vaultTransaction';
import { withAvatarSession } from '../avatarOntologySessionGuard';
import { decodeSnapshotOntology, validateSnapshotOntology } from './snapshotOntology';
import { SecurityService } from '../securityService';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from '../avatarOntologyKey';
import { accountStore } from '../accountIdb';
import { accountLocalStorage, currentAccountId } from '../accountScope';
import { DiaryStorageKeys as K } from '../diaryStorage';
import {
  DELETION_TOMBSTONES_KEY,
  hashDeletedId,
  mergeDeletionTombstones,
  tombstoneBlocksEntry,
  readDeletionTombstones,
  blockedOntologyRows,
} from '../deletionTombstone';
import { PRIVATE_DRAFT_KEY, FUTURE_DRAFT_KEY } from '../privateDraftKey';
import {
  decryptVaultBackupFile,
  encryptVaultBackupFile,
  type EncryptedVaultBackup,
} from '../vaultBackupFile';

const dataKeys = new Set<string>([
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
  K.entries,
  DELETION_TOMBSTONES_KEY,
  K.principles,
  K.patternPrincipleLinks,
  K.passwordHash,
  K.passwordSalt,
  K.guidingStars,
  K.containers,
  K.actions,
  K.future,
  K.initializedFlag,
  PRIVATE_DRAFT_KEY,
  FUTURE_DRAFT_KEY,
]);
const cacheKeys = new Set(['user_custom_anchors']);
const allowed = (key: string) =>
  dataKeys.has(key) ||
  key.startsWith('past-supplement-draft:') ||
  key === `vector_materials_${currentAccountId()}` ||
  key === `vector_selected_stars_${currentAccountId()}`;
export interface AccountSnapshot {
  format: 'vector-account-snapshot-v1';
  ontologySchemaVersion?: 2;
  owner: string;
  data: Record<string, unknown>;
  caches: Record<string, string>;
}
export interface SyncBase {
  revision: number;
  fingerprint: string;
}
export const SYNC_BASE_KEY = 'vector-cloud-base-v1';
export function readSyncBase(): SyncBase {
  const raw = accountLocalStorage.getItem(SYNC_BASE_KEY);
  if (!raw) return { revision: 0, fingerprint: '' };
  const value = JSON.parse(raw);
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.fingerprint !== 'string'
  )
    throw new Error('同步检查点损坏，请保留本机资料并联系维护者');
  return value;
}
export function saveSyncBase(base: SyncBase) {
  accountLocalStorage.setItem(SYNC_BASE_KEY, JSON.stringify(base));
}
export async function captureSnapshot(): Promise<AccountSnapshot> {
  return withAvatarSession(async (assertCurrent) => {
    const owner = currentAccountId();
    if (!owner) throw new Error('请先登录账号');
    const data = await accountStore()(
      'readonly',
      (store) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const values: Record<string, unknown> = {};
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            if (
              [
                'vector_vault_wipe_job_v1',
                'vector_backup_restore_job_v1',
                'vector_source_deletion_journal_v1',
                'vector-account-restore-v1',
              ].includes(String(item.key))
            ) {
              reject(new Error('本机资料正在整理，请稍后同步'));
              return;
            }
            if (typeof item.key === 'string' && allowed(item.key)) values[item.key] = item.value;
            item.continue();
          };
          store.transaction.oncomplete = () => resolve(values);
          store.transaction.onabort = () => reject(store.transaction.error);
        }),
    );
    assertCurrent();
    return { format: 'vector-account-snapshot-v1', owner, data, caches: readCaches() };
  });
}
function readCaches(): Record<string, string> {
  const caches: Record<string, string> = readLegacyAvatarTransportCaches();
  for (const key of cacheKeys) {
    const value = accountLocalStorage.getItem(key);
    if (value !== null) caches[key] = value;
  }
  return caches;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export async function fingerprint(snapshot: AccountSnapshot) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical(snapshot)),
  );
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
}
export function validateSnapshot(value: unknown): asserts value is AccountSnapshot {
  const s = value as AccountSnapshot;
  if (
    !s ||
    s.format !== 'vector-account-snapshot-v1' ||
    s.owner !== currentAccountId() ||
    (s.ontologySchemaVersion !== undefined && s.ontologySchemaVersion !== 2) ||
    !s.data ||
    !s.caches ||
    Array.isArray(s.data) ||
    Array.isArray(s.caches) ||
    Object.keys(s.data).some((key) => !allowed(key)) ||
    Object.entries(s.caches).some(
      ([key, v]) =>
        (!cacheKeys.has(key) && !isLegacyAvatarTransportKey(key)) || typeof v !== 'string',
    ) ||
    typeof s.data[K.passwordHash] !== 'string' ||
    typeof s.data[K.passwordSalt] !== 'string'
  )
    throw new Error('同步资料不属于当前账号或格式无效');
}
export async function openSnapshot(payload: EncryptedVaultBackup, password: string) {
  return withAvatarSession(async (assertCurrent) => {
    const snapshot = await decryptVaultBackupFile(structuredClone(payload), password);
    assertCurrent();
    validateSnapshot(snapshot);
    await validateSnapshotOntology(snapshot.data, password, snapshot.owner);
    assertCurrent();
    return snapshot;
  });
}
export async function sealSnapshot(snapshot: AccountSnapshot, password: string) {
  return withAvatarSession(async (assertCurrent) => {
    // Freeze the export before password verification yields to UI/account changes.
    const source = structuredClone(snapshot);
    validateSnapshot(source);
    if (
      !(await SecurityService.verifyPassword(
        password,
        String(source.data[K.passwordSalt]),
        String(source.data[K.passwordHash]),
      ))
    )
      throw new Error('资料库密码已变化，请重新解锁后同步');
    assertCurrent();
    const hasLegacy = hasLegacyAvatarTransport(source.caches);
    if (hasLegacy) {
      const session = useAppStore.getState();
      if (!session.isUnlocked || session.masterPassword !== password) throw new VaultLockedError();
    }
    const migrated = await migrateAvatarTransport(
      source.data,
      source.caches,
      password,
      source.owner,
    );
    await validateSnapshotOntology(migrated.data, password, source.owner);
    assertCurrent();
    // Only the transport is normalized. Local fingerprints remain byte-stable across
    // repeated sync checks; random encryption IVs cannot make unchanged data dirty.
    const payload = await encryptVaultBackupFile(
      { ...source, ...migrated, ontologySchemaVersion: 2 },
      password,
    );
    assertCurrent();
    return payload;
  });
}
/** Only called before App is imported. Keep a durable journal to recover interrupted cache writes. */
const RESTORE_KEY = 'vector-account-restore-v1';
export async function applySnapshot(
  snapshot: AccountSnapshot,
  revision: number,
  expectedFingerprint: string,
  recoveryPassword: string,
  sourcePassword = recoveryPassword,
) {
  return withAvatarSession(async (assertCurrent) => {
    snapshot = structuredClone(snapshot);
    validateSnapshot(snapshot);
    const base = { revision, fingerprint: await fingerprint(snapshot) };
    const before = await captureSnapshot();
    if ((await fingerprint(before)) !== expectedFingerprint)
      throw new Error('本机资料已变化，未覆盖，请重新加载');
    const hasLegacy = hasLegacyAvatarTransport(snapshot.caches);
    if (hasLegacy) {
      if (!useAppStore.getState().isUnlocked || !useAppStore.getState().masterPassword)
        throw new VaultLockedError();
      if (
        !(await SecurityService.verifyPassword(
          sourcePassword,
          String(snapshot.data[K.passwordSalt]),
          String(snapshot.data[K.passwordHash]),
        ))
      )
        throw new Error('旧版资料密码校验失败');
    }
    const imported = await migrateAvatarTransport(
      snapshot.data,
      snapshot.caches,
      sourcePassword,
      snapshot.owner,
    );
    const normalized = { ...snapshot, ...imported };
    await validateSnapshotOntology(normalized.data, sourcePassword, snapshot.owner);
    const localTombstones = readDeletionTombstones(before.data[DELETION_TOMBSTONES_KEY]);
    const remoteTombstones = readDeletionTombstones(normalized.data[DELETION_TOMBSTONES_KEY]);
    const remoteEntries = normalized.data[K.entries];
    if (!Array.isArray(remoteEntries)) throw new Error('同步记录格式无效');
    const localDeleted = new Map(localTombstones.map((item) => [item.entityIdHash, item]));
    const restored = await Promise.all(
      remoteEntries.map(
        async (entry: { id?: string; createdAt?: number; updatedAt?: number }) =>
          typeof entry?.id === 'string' &&
          tombstoneBlocksEntry(localDeleted.get(await hashDeletedId(entry.id)), entry),
      ),
    );
    if (restored.some(Boolean))
      throw new Error('同步资料包含本机已删除的记录，已阻止旧版本复活；请先在恢复预览中明确确认');
    const blockedGraphRows = await blockedOntologyRows(
      await decodeSnapshotOntology(normalized.data, sourcePassword, snapshot.owner) as import('../avatarOntologyStore').AvatarOntologySnapshot | undefined,
      localTombstones,
    );
    if (blockedGraphRows.length)
      throw new Error('同步资料包含本机已删除的认知资料，已阻止旧版本复活；请先在恢复预览中明确确认');
    normalized.data[DELETION_TOMBSTONES_KEY] = mergeDeletionTombstones(
      localTombstones,
      remoteTombstones,
    );
    const recovery = hasVault(before)
      ? await encryptVaultBackupFile(before, recoveryPassword)
      : null;
    assertCurrent();
    await accountStore()(
      'readwrite',
      (store) =>
        new Promise<void>((resolve, reject) => {
          let failed = false;
          const current: Record<string, unknown> = {};
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            try {
              assertCurrent();
            } catch {
              failed = true;
              store.transaction.abort();
              return;
            }
            const item = cursor.result;
            if (item) {
              if (typeof item.key === 'string' && allowed(item.key)) current[item.key] = item.value;
              item.continue();
              return;
            }
            if (
              canonical(current) !== canonical(before.data) ||
              canonical(readCaches()) !== canonical(before.caches)
            ) {
              failed = true;
              store.transaction.abort();
              return;
            }
            for (const key of Object.keys(current)) store.delete(key);
            for (const [key, value] of Object.entries(normalized.data)) store.put(value, key);
            // Keep the exact pre-restore state inside this same atomic transaction.
            if (recovery) store.put(recovery, `vector-sync-recovery:${Date.now()}`);
            store.put(
              {
                caches: normalized.caches,
                base,
                mirrors: [
                  ...new Set([...Object.keys(current), ...Object.keys(normalized.data), K.backup]),
                ],
              },
              RESTORE_KEY,
            );
          };
          store.transaction.oncomplete = () => resolve();
          store.transaction.onabort = () =>
            reject(new Error(failed ? '本机资料已变化，未覆盖' : '同步写入失败'));
        }),
    );
    assertCurrent();
    await recoverSnapshotRestoreWithPassword(sourcePassword);
  });
}
/** An explicit recovery password is verified against the pending journal's vault.
 * It is never installed as the application's unlocked session. */
export async function recoverSnapshotRestore(password?: string) {
  return recoverSnapshotRestoreWithPassword(password);
}
async function recoverSnapshotRestoreWithPassword(verifiedImportPassword?: string) {
  return withAvatarSession(async (assertCurrent) => {
    const pending = await accountStore()(
      'readonly',
      (store) =>
        new Promise<{
          job: { caches: Record<string, string>; base: SyncBase; mirrors?: string[] };
          data: Record<string, unknown>;
        } | null>((resolve, reject) => {
          const data: Record<string, unknown> = {};
          let job:
            | { caches: Record<string, string>; base: SyncBase; mirrors?: string[] }
            | undefined;
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            if (item.key === RESTORE_KEY) job = item.value;
            else if (typeof item.key === 'string' && allowed(item.key)) data[item.key] = item.value;
            item.continue();
          };
          store.transaction.oncomplete = () => resolve(job ? { job, data } : null);
          store.transaction.onabort = () => reject(store.transaction.error);
        }),
    );
    if (!pending) return;
    const hasLegacy = hasLegacyAvatarTransport(pending.job.caches);
    let normalized = { data: pending.data, caches: pending.job.caches };
    const hasOntology = [
      AVATAR_ONTOLOGY_KEY,
      AVATAR_MIGRATION_SNAPSHOT_KEY,
      AVATAR_MIGRATION_RESULT_KEY,
    ].some((key) => pending.data[key] !== undefined);
    if (hasLegacy || hasOntology) {
      const session = useAppStore.getState();
      const password =
        verifiedImportPassword ?? (session.isUnlocked ? session.masterPassword : null);
      if (!password) throw new VaultLockedError();
      if (
        !(await SecurityService.verifyPassword(
          password,
          String(pending.data[K.passwordSalt]),
          String(pending.data[K.passwordHash]),
        ))
      )
        throw new Error('恢复资料密码校验失败');
      normalized = await migrateAvatarTransport(
        pending.data,
        pending.job.caches,
        password,
        currentAccountId(),
      );
      await validateSnapshotOntology(normalized.data, password, currentAccountId()!);
    }
    assertCurrent();
    await accountStore()(
      'readwrite',
      (store) =>
        new Promise<void>((resolve, reject) => {
          const current: Record<string, unknown> = {};
          let currentJob: unknown;
          let failure: unknown;
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            try {
              assertCurrent();
              const item = cursor.result;
              if (item) {
                if (item.key === RESTORE_KEY) currentJob = item.value;
                else if (typeof item.key === 'string' && allowed(item.key))
                  current[item.key] = item.value;
                item.continue();
                return;
              }
              if (
                canonical(currentJob) !== canonical(pending.job) ||
                canonical(current) !== canonical(pending.data)
              )
                throw new Error('恢复期间本机资料已变化，请重试');
              for (const [key, value] of Object.entries(normalized.data)) store.put(value, key);
              for (const key of pending.job.mirrors ?? []) accountLocalStorage.removeItem(key);
              retireLegacyAvatarTransportCaches();
              for (const key of cacheKeys) {
                if (normalized.caches[key] === undefined) accountLocalStorage.removeItem(key);
                else accountLocalStorage.setItem(key, normalized.caches[key]);
              }
              saveSyncBase(pending.job.base);
              store.delete(RESTORE_KEY);
            } catch (error) {
              failure = error;
              store.transaction.abort();
            }
          };
          store.transaction.oncomplete = () => resolve();
          store.transaction.onabort = () =>
            reject(failure ?? new Error('本机存储空间不足，同步恢复尚未完成，请释放空间后重试'));
        }),
    );
  });
}
export function hasVault(snapshot: AccountSnapshot) {
  return Boolean(snapshot.data[K.passwordHash]);
}
