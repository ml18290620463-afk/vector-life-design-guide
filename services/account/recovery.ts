import { accountStore, get } from '../accountIdb';
import { isEncryptedVaultBackup, type EncryptedVaultBackup } from '../vaultBackupFile';
export const RECOVERY_SELECTION = 'vector-selected-recovery';
const isRecovery = (key: string) => /^(vector-sync-conflict-copy:|vector-sync-recovery:)\d+$/.test(key);
export async function listRecoveryCopies(): Promise<string[]> {
  return accountStore()('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result.filter((key): key is string => typeof key === 'string' && isRecovery(key)).sort().reverse());
    request.onerror = () => reject(request.error);
  }));
}
export async function readRecoveryCopy(key: string): Promise<EncryptedVaultBackup> {
  if (!isRecovery(key)) throw new Error('恢复副本标识无效');
  const payload = await get(key);
  if (!isEncryptedVaultBackup(payload)) throw new Error('恢复副本不存在或已损坏');
  return payload;
}
export async function exportRecoveryCopy(key: string) {
  const payload = await readRecoveryCopy(key);
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `VECTOR-account-recovery-${key.split(':').pop()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
