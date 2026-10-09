import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, set } from 'idb-keyval';
import { DiaryStorageKeys as K } from './diaryStorage';
import { exportVaultBackup } from './vaultBackup';
import { encryptVaultBackupFile } from './vaultBackupFile';
import { inspectVaultBackup } from './vaultBackupInspection';

beforeEach(async () => {
  await clear();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('inspectVaultBackup', () => {
  it('validates plaintext backup content without importing it', async () => {
    await set(K.entries, [
      { id: 'entry', title: 'record', content: 'fact', createdAt: 1, tags: [], isLocked: false },
    ]);
    const backup = await exportVaultBackup('inspection-test');
    const result = await inspectVaultBackup(backup);
    expect(result).toMatchObject({
      encrypted: false,
      needsPassword: false,
      version: 'inspection-test',
      entryCount: 1,
    });
    expect(result.dataCounts?.entries).toBe(1);
  });

  it('shows encrypted envelope metadata without a password and validates with one', async () => {
    const backup = await exportVaultBackup('inspection-test');
    const encrypted = await encryptVaultBackupFile(backup, 'secret');
    const metadata = await inspectVaultBackup(encrypted);
    expect(metadata).toMatchObject({
      encrypted: true,
      needsPassword: true,
      encryption: { cipher: 'AES-256-GCM', iterations: 600000 },
    });
    await expect(inspectVaultBackup(encrypted, 'wrong')).rejects.toThrow('未导入');
    await expect(inspectVaultBackup({ nope: true })).rejects.toThrow('完整备份格式无效');
    expect((await inspectVaultBackup(encrypted, 'secret')).entryCount).toBe(0);
  });
});
