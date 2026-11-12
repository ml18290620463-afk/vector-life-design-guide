import { SecurityService } from '../securityService';
import { accountStore } from '../accountIdb';
import { accountLocalStorage, currentAccountId } from '../accountScope';
import { DiaryStorageKeys as K } from '../diaryStorage';
import { PRIVATE_DRAFT_KEY, FUTURE_DRAFT_KEY } from '../privateDraftKey';
import { decryptVaultBackupFile, encryptVaultBackupFile, type EncryptedVaultBackup } from '../vaultBackupFile';

const dataKeys = new Set<string>([
  K.entries, K.principles, K.patternPrincipleLinks, K.passwordHash, K.passwordSalt,
  K.guidingStars, K.containers, K.actions, K.future, K.initializedFlag,
  PRIVATE_DRAFT_KEY, FUTURE_DRAFT_KEY,
]);
const cacheKeys = new Set([
  'vector:avatar:atomic-memories:v1', 'vector:avatar:memory-relations:v1',
  'vector:avatar:memory-tags:v1', 'vector:avatar:understandings:v1',
  'vector:avatar:sessions:v1', 'user_custom_anchors',
]);
const allowed = (key: string) => dataKeys.has(key) || key.startsWith('past-supplement-draft:') || key === `vector_materials_${currentAccountId()}` || key === `vector_selected_stars_${currentAccountId()}`;
export interface AccountSnapshot {
  format: 'vector-account-snapshot-v1';
  owner: string;
  data: Record<string, unknown>;
  caches: Record<string, string>;
}
export interface SyncBase { revision: number; fingerprint: string }
export const SYNC_BASE_KEY = 'vector-cloud-base-v1';
export function readSyncBase(): SyncBase {
  const raw = accountLocalStorage.getItem(SYNC_BASE_KEY);
  if (!raw) return { revision: 0, fingerprint: '' };
  const value = JSON.parse(raw);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.fingerprint !== 'string') throw new Error('同步检查点损坏，请保留本机资料并联系维护者');
  return value;
}
export function saveSyncBase(base: SyncBase) { accountLocalStorage.setItem(SYNC_BASE_KEY, JSON.stringify(base)); }
export async function captureSnapshot(): Promise<AccountSnapshot> {
  const owner = currentAccountId();
  if (!owner) throw new Error('请先登录账号');
  const data = await accountStore()('readonly', (store) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const values: Record<string, unknown> = {};
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      if (['vector_vault_wipe_job_v1', 'vector_backup_restore_job_v1', 'vector_source_deletion_journal_v1', 'vector-account-restore-v1'].includes(String(item.key))) {
        reject(new Error('本机资料正在整理，请稍后同步'));
        return;
      }
      if (typeof item.key === 'string' && allowed(item.key)) values[item.key] = item.value;
      item.continue();
    };
    store.transaction.oncomplete = () => resolve(values);
    store.transaction.onabort = () => reject(store.transaction.error);
  }));
  const caches: Record<string, string> = {};
  for (const key of cacheKeys) { const value = accountLocalStorage.getItem(key); if (value !== null) caches[key] = value; }
  return { format: 'vector-account-snapshot-v1', owner, data, caches };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function fingerprint(snapshot: AccountSnapshot) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(snapshot)));
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
}
export function validateSnapshot(value: unknown): asserts value is AccountSnapshot {
  const s = value as AccountSnapshot;
  if (!s || s.format !== 'vector-account-snapshot-v1' || s.owner !== currentAccountId() || !s.data || !s.caches || Array.isArray(s.data) || Array.isArray(s.caches) || Object.keys(s.data).some((key) => !allowed(key)) || Object.entries(s.caches).some(([key, v]) => !cacheKeys.has(key) || typeof v !== 'string') || typeof s.data[K.passwordHash] !== 'string' || typeof s.data[K.passwordSalt] !== 'string') throw new Error('同步资料不属于当前账号或格式无效');
}
export async function openSnapshot(payload: EncryptedVaultBackup, password: string) {
  const snapshot = await decryptVaultBackupFile(payload, password);
  validateSnapshot(snapshot);
  return snapshot;
}
export async function sealSnapshot(snapshot: AccountSnapshot, password: string) {
  validateSnapshot(snapshot);
  if (!await SecurityService.verifyPassword(password, String(snapshot.data[K.passwordSalt]), String(snapshot.data[K.passwordHash]))) throw new Error('资料库密码已变化，请重新解锁后同步');
  return encryptVaultBackupFile(snapshot, password);
}
/** Only called before App is imported. Keep a durable journal to recover interrupted cache writes. */
const RESTORE_KEY = 'vector-account-restore-v1';
export async function applySnapshot(snapshot: AccountSnapshot, revision: number, expectedFingerprint: string, recoveryPassword: string) {
  validateSnapshot(snapshot);
  const base = { revision, fingerprint: await fingerprint(snapshot) };
  const before = await captureSnapshot();
  if (await fingerprint(before) !== expectedFingerprint) throw new Error('本机资料已变化，未覆盖，请重新加载');
  const recovery = hasVault(before) ? await encryptVaultBackupFile(before, recoveryPassword) : null;
  await accountStore()('readwrite', (store) => new Promise<void>((resolve, reject) => {
    let failed = false;
    const current: Record<string, unknown> = {};
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (item) {
        if (typeof item.key === 'string' && allowed(item.key)) current[item.key] = item.value;
        item.continue(); return;
      }
      if (canonical(current) !== canonical(before.data)) { failed = true; store.transaction.abort(); return; }
      for (const key of Object.keys(current)) store.delete(key);
      for (const [key, value] of Object.entries(snapshot.data)) store.put(value, key);
      // Keep the exact pre-restore state inside this same atomic transaction.
      if (recovery) store.put(recovery, `vector-sync-recovery:${Date.now()}`);
      store.put({ caches: snapshot.caches, base, mirrors: [...new Set([...Object.keys(current), ...Object.keys(snapshot.data), K.backup])] }, RESTORE_KEY);
    };
    store.transaction.oncomplete = () => resolve();
    store.transaction.onabort = () => reject(new Error(failed ? '本机资料已变化，未覆盖' : '同步写入失败'));
  }));
  await recoverSnapshotRestore();
}
export async function recoverSnapshotRestore() {
  await accountStore()('readwrite', (store) => new Promise<void>((resolve, reject) => {
    const request = store.get(RESTORE_KEY);
    request.onsuccess = () => {
      const job = request.result;
      if (!job) return;
      try {
        for (const key of job.mirrors ?? []) accountLocalStorage.removeItem(key);
        for (const key of cacheKeys) {
          if (job.caches[key] === undefined) accountLocalStorage.removeItem(key);
          else accountLocalStorage.setItem(key, job.caches[key]);
        }
        saveSyncBase(job.base);
        store.delete(RESTORE_KEY);
      } catch { store.transaction.abort(); }
    };
    store.transaction.oncomplete = () => resolve();
    store.transaction.onabort = () => reject(new Error('本机存储空间不足，同步恢复尚未完成，请释放空间后重试'));
  }));
}
export function hasVault(snapshot: AccountSnapshot) { return Boolean(snapshot.data[K.passwordHash]); }
