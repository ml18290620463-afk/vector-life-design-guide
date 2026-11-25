import { openSnapshot } from './snapshot';
import { accountStore, get, set } from '../accountIdb';
import { isEncryptedVaultBackup, type EncryptedVaultBackup } from '../vaultBackupFile';
export const RECOVERY_SELECTION = 'vector-selected-recovery';
const isRecovery = (key: string) =>
  /^(vector-sync-conflict-copy:|vector-sync-recovery:)\d+$/.test(key);
export async function listRecoveryCopies(): Promise<string[]> {
  return accountStore()(
    'readonly',
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () =>
          resolve(
            request.result
              .filter((key): key is string => typeof key === 'string' && isRecovery(key))
              .sort()
              .reverse(),
          );
        request.onerror = () => reject(request.error);
      }),
  );
}
export async function readRecoveryCopy(key: string): Promise<EncryptedVaultBackup> {
  if (!isRecovery(key)) throw new Error('恢复副本标识无效');
  const payload = await get(key);
  if (!isEncryptedVaultBackup(payload)) throw new Error('恢复副本不存在或已损坏');
  return payload;
}
export async function exportRecoveryCopy(key: string) {
  const payload = await readRecoveryCopy(key);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `VECTOR-account-recovery-${key.split(':').pop()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Validate size, encryption, password and owner before retaining a file in this account. */
export async function importRecoveryCopy(
  file: Pick<File, 'size' | 'text'>,
  password: string,
): Promise<string> {
  if (file.size > 20_000_000) throw new Error('恢复文件超过 20 MB 上限');
  if (!password) throw new Error('请输入该副本的资料库密码');
  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('恢复文件不是有效的 JSON 文件');
  }
  if (!isEncryptedVaultBackup(payload)) throw new Error('请选择 VECTOR 加密账号恢复副本');
  await openSnapshot(payload, password);
  const key = `vector-sync-recovery:${Date.now()}`;
  await set(key, payload);
  return key;
}
