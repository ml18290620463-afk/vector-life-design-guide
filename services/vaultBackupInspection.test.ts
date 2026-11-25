import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, set, get } from 'idb-keyval';
import { DiaryStorageKeys as K, getMaterialsStorageKey } from './diaryStorage';
import { exportVaultBackup, importVaultBackup, validateVaultBackup } from './vaultBackup';
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

  it('discloses whether material bytes or only references are recoverable', async () => {
    await set(K.entries, [
      {
        id: 'entry',
        title: 'record',
        content: 'fact',
        createdAt: 1,
        tags: [],
        isLocked: false,
        attachment: { type: 'image', data: 'data:image/png;base64,AAAA', name: 'proof.png' },
        nowMaterials: [
          { id: 'web', type: 'link', url: 'https://example.com/proof', sort_order: 0 },
          { id: 'old', type: 'link', url: 'blob:unavailable', sort_order: 1 },
        ],
      },
    ]);
    const inspection = await inspectVaultBackup(await exportVaultBackup('inspection-test'));
    expect(inspection.contentSummary?.materialReferences).toEqual({
      embedded: 1,
      externalLink: 1,
      unstableReference: 1,
    });
  });
});

describe('legacy standalone material backup', () => {
  it('preserves duplicate attachments, stable IDs and idempotent merge', async () => {
    const key = getMaterialsStorageKey(undefined);
    const attachment = { type: 'image', name: 'legacy.png', data: 'data:image/png;base64,AAAA' };
    await set(key, [attachment, attachment, { ...attachment, id: 'existing-id' }]);
    const first = await exportVaultBackup('test');
    const second = await exportVaultBackup('test');
    expect(first.vault.data.materials).toEqual(second.vault.data.materials);
    expect(new Set(first.vault.data.materials.map((r) => (r as { id: string }).id)).size).toBe(3);
    expect(first.vault.data.materials[2]).toMatchObject({ id: 'existing-id' });
    expect((await get(key))[0]).not.toHaveProperty('id');
    await importVaultBackup(first, 'merge');
    await importVaultBackup(first, 'merge');
    expect(await get(key)).toEqual(first.vault.data.materials);
    await clear();
    await importVaultBackup(first, 'replace');
    expect(await get(key)).toEqual(first.vault.data.materials);
  });

  it('continues to reject incoming missing and duplicate IDs', async () => {
    const backup = await exportVaultBackup('test');
    backup.vault.data.materials = [{ type: 'image', name: 'invalid' }];
    expect(() => validateVaultBackup(backup)).toThrow('编号');
    backup.vault.data.materials = [{ id: 'same' }, { id: 'same' }];
    await expect(importVaultBackup(backup)).rejects.toThrow('编号');
    expect(await get(getMaterialsStorageKey(undefined))).toBeUndefined();
  });
});
