import { PRIVATE_DRAFT_KEY } from './privateDraftKey';
import { createStore } from 'idb-keyval';
import { DiaryStorageKeys as K, readDiaryString } from './diaryStorage';
import { SecurityService } from './securityService';
import { useAppStore } from '../stores/appStore';

// Same database/store as idb-keyval's default. A read/check/write is one transaction.
const store = createStore('keyval-store', 'keyval');
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
export function publishVaultChange() {
  notifyListeners();
  // Observers must never turn an already committed write into a reported failure.
  try {
    channel?.postMessage('committed');
  } catch (error) {
    console.error('Vault notification failed', error);
  }
}
function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Vault observer failed', error);
    }
  });
}
export function subscribeVault(listener: () => void) {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('vector-vault-commits-v1');
    channel.onmessage = notifyListeners;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function rawVaultTransaction<T>(
  keys: string[],
  mutate: (values: Record<string, unknown>) => T,
  readonly = false,
): Promise<T> {
  const unique = [...new Set(keys)];
  if (!unique.length) throw new Error('事务必须指定存储键');
  const result = await store(
    readonly ? 'readonly' : 'readwrite',
    (objectStore) =>
      new Promise<T>((resolve, reject) => {
        const tx = objectStore.transaction;
        const values: Record<string, unknown> = {};
        let output: T;
        let failure: unknown;
        tx.oncomplete = () => resolve(output);
        tx.onabort = () => reject(failure ?? tx.error ?? new Error('保存失败，请重试'));
        tx.onerror = () => {
          failure ??= tx.error;
        };
        let remaining = unique.length;
        for (const key of unique) {
          const request = objectStore.get(key);
          request.onsuccess = () => {
            values[key] = request.result;
            if (--remaining !== 0) return;
            try {
              output = mutate(values);
              if (!readonly)
                for (const name of unique) {
                  if (values[name] === undefined) objectStore.delete(name);
                  else objectStore.put(values[name], name);
                }
            } catch (error) {
              failure = error;
              tx.abort();
            }
          };
        }
      }),
  );
  if (!readonly) publishVaultChange();
  return result;
}

export class VaultLockedError extends Error {
  constructor() {
    super('请先解锁资料库，再查看或编辑');
  }
}
export const BACKUP_RESTORE_JOB = 'vector_backup_restore_job_v1';
const privateKeys = [K.future, K.actions, PRIVATE_DRAFT_KEY, BACKUP_RESTORE_JOB] as string[];
type Envelope = { format: 'vector-private-v1'; ciphertext: string };
const encrypted = (value: unknown): value is Envelope =>
  !!value && typeof value === 'object' && 'format' in value && value.format === 'vector-private-v1';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const conflict = new Error('资料库同时发生了更新，请重试');

// Only session state is observed; the password is never persisted in this layer.
useAppStore.subscribe((next, previous) => {
  if (next.isUnlocked !== previous.isUnlocked || next.masterPassword !== previous.masterPassword)
    notifyListeners();
});

/** Crypto must run outside IDB transactions. Compare every input again at commit. */
async function privateTransaction<T>(
  keys: string[],
  mutate: (values: Record<string, unknown>) => T | Promise<T>,
  readonly: boolean,
  replacement?: {
    password: string | null;
    hash?: string;
    salt?: string;
    onlyIfUnprotected?: boolean;
  },
): Promise<T> {
  const all = [...new Set([...keys, K.passwordHash, K.passwordSalt])];
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = useAppStore.getState();
    const snapshot = await rawVaultTransaction(all, (v) => v, true);
    const hash = snapshot[K.passwordHash] ?? readDiaryString(K.passwordHash);
    const salt = snapshot[K.passwordSalt] ?? readDiaryString(K.passwordSalt) ?? '';
    const password = session.isUnlocked ? session.masterPassword : null;
    if (
      hash &&
      (!password || !(await SecurityService.verifyPassword(password, String(salt), String(hash))))
    )
      throw new VaultLockedError();
    if (replacement && hash && replacement.onlyIfUnprotected)
      throw new Error('资料库保护状态已变化，请重新导入');
    const decoded = structuredClone(snapshot);
    for (const key of privateKeys.filter((k) => keys.includes(k))) {
      const value = snapshot[key];
      if (encrypted(value)) {
        if (!password) throw new VaultLockedError();
        decoded[key] = JSON.parse(await SecurityService.decrypt(value.ciphertext, password));
      }
    }
    const output = await mutate(decoded);
    const assertSession = () => {
      const current = useAppStore.getState();
      if (
        session.isUnlocked !== current.isUnlocked ||
        session.masterPassword !== current.masterPassword
      )
        throw new VaultLockedError();
    };
    assertSession();
    if (readonly) return output;
    const nextPassword = replacement ? replacement.password : hash ? password : null;
    for (const key of privateKeys.filter((k) => keys.includes(k))) {
      if (decoded[key] === undefined) continue;
      decoded[key] = nextPassword
        ? {
            format: 'vector-private-v1',
            ciphertext: await SecurityService.encrypt(JSON.stringify(decoded[key]), nextPassword),
          }
        : decoded[key];
    }
    if (replacement) {
      decoded[K.passwordHash] = replacement.hash;
      decoded[K.passwordSalt] = replacement.salt;
    }
    try {
      await rawVaultTransaction(all, (latest) => {
        assertSession();
        if (all.some((key) => !same(snapshot[key], latest[key]))) throw conflict;
        for (const key of all) latest[key] = decoded[key];
      });
      return output;
    } catch (error) {
      if (error !== conflict) throw error;
    }
  }
  throw conflict;
}

export function vaultTransaction<T>(
  keys: string[],
  mutate: (values: Record<string, unknown>) => T,
  readonly = false,
): Promise<T> {
  return keys.some((key) => privateKeys.includes(key))
    ? privateTransaction(keys, mutate, readonly)
    : rawVaultTransaction(keys, mutate, readonly);
}

/** Prepare crypto outside IDB, then atomically compare and commit all inputs. */
export function preparedVaultTransaction<T>(
  keys: string[],
  mutate: (values: Record<string, unknown>) => T | Promise<T>,
  readonly = false,
  protection?: { password: string; hash: string; salt: string; onlyIfUnprotected: true },
) {
  return privateTransaction(keys, mutate, readonly, protection);
}

/** Rotate future/actions and credentials together; never require a second password. */
export function changeFutureProtection(password: string | null, hash?: string, salt?: string) {
  return privateTransaction(privateKeys, () => undefined, false, { password, hash, salt });
}

/** Apply an editor's delta to latest storage; never overwrite unrelated concurrent rows. */
export function commitArrayDelta<T extends { id: string }>(
  key: string,
  before: T[],
  after: T[],
  backupKey?: string,
  normalize?: (row: T) => unknown,
) {
  return vaultTransaction(backupKey ? [key, backupKey] : [key], (values) => {
    const comparable = (row: T | undefined) =>
      JSON.stringify(row && normalize ? normalize(row) : row);
    const latest = (values[key] as T[] | undefined) ?? before;
    const original = new Map(before.map((row) => [row.id, row]));
    const next = new Map(after.map((row) => [row.id, row]));
    const changed = after.filter(
      (row) => JSON.stringify(row) !== JSON.stringify(original.get(row.id)),
    );
    const removed = new Set(before.filter((row) => !next.has(row.id)).map((row) => row.id));
    for (const row of [...changed, ...before.filter((row) => removed.has(row.id))]) {
      const current = latest.find((item) => item.id === row.id);
      const base = original.get(row.id);
      if (
        comparable(current) !== comparable(base) &&
        comparable(current) !== comparable(next.get(row.id))
      ) {
        throw new Error('内容已在其他页面更新，请刷新后重试');
      }
    }
    const updates = new Map(changed.map((row) => [row.id, row]));
    const merged = latest
      .filter((row) => !removed.has(row.id))
      .map((row) => updates.get(row.id) ?? row);
    for (const row of changed) if (!latest.some((item) => item.id === row.id)) merged.unshift(row);
    values[key] = merged;
    if (backupKey) values[backupKey] = merged;
    return merged;
  });
}
