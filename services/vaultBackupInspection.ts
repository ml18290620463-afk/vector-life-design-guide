import { validateVaultBackup, type VaultBackup } from './vaultBackup';
import {
  decryptVaultBackupFile,
  isEncryptedVaultBackup,
  type EncryptedVaultBackup,
} from './vaultBackupFile';

export interface VaultBackupInspection {
  encrypted: boolean;
  needsPassword: boolean;
  version?: string;
  schemaVersion: number;
  exportedAt?: string;
  entryCount?: number;
  dataCounts?: Record<string, number>;
  cacheCounts?: Record<string, number>;
  encryption?: Pick<EncryptedVaultBackup, 'schemaVersion' | 'cipher' | 'kdf' | 'iterations'>;
}

const countDomains = (backup: VaultBackup) => ({
  dataCounts: Object.fromEntries(
    Object.entries(backup.vault.data).map(([key, value]) => [key, value.length]),
  ),
  cacheCounts: Object.fromEntries(
    Object.entries(backup.vault.caches).map(([key, value]) => [key, value.length]),
  ),
});

const inspectPlaintext = (value: unknown): VaultBackupInspection => {
  validateVaultBackup(value);
  const backup = value as VaultBackup;
  return {
    encrypted: false,
    needsPassword: false,
    version: backup.version,
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    entryCount: backup.entryCount,
    ...countDomains(backup),
  };
};

/** Read-only format validation. This function never imports, writes, or merges a backup. */
export const inspectVaultBackup = async (
  value: unknown,
  password = '',
): Promise<VaultBackupInspection> => {
  if (!isEncryptedVaultBackup(value)) return inspectPlaintext(value);
  const encryption = {
    schemaVersion: value.schemaVersion,
    cipher: value.cipher,
    kdf: value.kdf,
    iterations: value.iterations,
  };
  if (!password) {
    if (
      value.schemaVersion !== 1 ||
      value.cipher !== 'AES-256-GCM' ||
      value.kdf !== 'PBKDF2-SHA256'
    )
      throw new Error('不支持的加密备份版本或参数');
    return { encrypted: true, needsPassword: true, schemaVersion: value.schemaVersion, encryption };
  }
  const decrypted = await decryptVaultBackupFile(value, password);
  return { ...inspectPlaintext(decrypted), encrypted: true, needsPassword: false, encryption };
};
