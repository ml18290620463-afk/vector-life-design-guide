import { accountAccessToken, accountConfig } from './auth';
import { isEncryptedVaultBackup, type EncryptedVaultBackup } from '../vaultBackupFile';
export interface CloudRevision {
  revision: number;
  payload: EncryptedVaultBackup;
  created_at: string;
}
export class SyncConflictError extends Error {
  constructor(public readonly revision?: number) {
    super('另一台设备已有更新，双方版本均已保留，请处理同步冲突');
  }
}
async function rpc(name: string, body: unknown) {
  const token = await accountAccessToken();
  const response = await fetch(`${accountConfig.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: accountConfig.key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 410)
    throw new Error('云端资料已删除，此账号已阻止自动重新上传；本机资料仍保留');
  if (response.status === 409) throw new SyncConflictError();
  if (response.status === 401 || response.status === 403)
    throw new Error('账号会话已失效，请退出后重新登录');
  if (!response.ok) throw new Error('云端暂不可用，本机修改已保留，稍后会重试');
  return response.json();
}
export async function readCloudRevision(): Promise<CloudRevision | null> {
  const rows = await rpc('vector_read_vault', {});
  const row = rows[0];
  if (!row) return null;
  if (
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    !isEncryptedVaultBackup(row.payload)
  )
    throw new Error('云端资料格式不兼容');
  return row;
}
export async function writeCloudRevision(
  expected: number,
  payload: EncryptedVaultBackup,
): Promise<number> {
  if (!isEncryptedVaultBackup(payload)) throw new Error('云端仅接受加密资料');
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 19_900_000)
    throw new Error('加密资料超过云同步单版本 20 MB 上限，请先导出备份并减少附件；本机内容已保留');
  const revision = await rpc('vector_write_vault', {
    expected_revision: expected,
    encrypted_payload: payload,
  });
  if (!Number.isSafeInteger(revision) || revision !== expected + 1)
    throw new Error('云端版本确认失败，请重新同步');
  return revision;
}

export async function eraseCloudRevision(expected: number): Promise<void> {
  if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('云端版本无效');
  if ((await rpc('vector_erase_vault', { expected_revision: expected })) !== true)
    throw new Error('云端未确认删除，请保留本机资料并重试');
}
