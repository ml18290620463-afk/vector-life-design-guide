import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backupFile from './vaultBackupFile';
import { SecurityService } from './securityService';
import { changeFutureProtection } from './vaultTransaction';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { DiaryStorageKeys as K } from './diaryStorage';
import { mergeAvatarOntologyBackup } from './avatarOntologyBackup';
import { AVATAR_V1_KEYS } from './avatarOntologyMigration';
import { decodeAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import {
  validateVaultBackup,
  drillVaultBackupRestore,
  exportVaultBackup,
  exportVaultBackupFile,
  exportRecoverableVaultBackupFile,
  importVaultBackup,
} from './vaultBackup';

const graph = (revision = 0): AvatarOntologySnapshot => ({
  ontologySchemaVersion: 2,
  revision,
  objects: [],
  edges: [],
  sessions: [
    {
      id: 'session',
      mode: 'general',
      context: { mode: 'general', source: 'global' },
      createdAt: 1,
      updatedAt: 2,
      references: [],
      messages: [
        {
          id: 'message',
          role: 'user',
          content: '我喜欢安静',
          type: 'text',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  ],
});
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});

afterEach(() => vi.restoreAllMocks());

describe('v2 ontology backup boundary', () => {
  it('imports legacy data only through an encrypted checkpoint and exports v2 without old caches', async () => {
    const backup = await exportVaultBackup('legacy-import');
    const legacy = [{ id: 'ambiguous', statement: '历史原文必须保留', status: 'confirmed' }];
    backup.vault.caches[AVATAR_V1_KEYS.atoms] = legacy;
    const original = structuredClone(backup);
    await expect(importVaultBackup(backup, 'replace')).rejects.toThrow();
    expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
    expect(await get(K.passwordHash)).toBeUndefined();
    expect(backup).toEqual(original);

    const password = 'legacy-import-password-123';
    await importVaultBackup(backup, 'replace', undefined, password);
    expect(useAppStore.getState().masterPassword).toBe(password);
    expect((await get(AVATAR_ONTOLOGY_KEY)).format).toBe('vector-private-v1');
    for (const key of Object.values(AVATAR_V1_KEYS)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    const envelope = await exportVaultBackupFile('v2-export');
    expect(backupFile.isEncryptedVaultBackup(envelope)).toBe(true);
    if (!backupFile.isEncryptedVaultBackup(envelope)) throw new Error('Expected encrypted backup');
    const exported = await backupFile.decryptVaultBackupFile(envelope, password);
    validateVaultBackup(exported);
    expect(exported.vault.ontology?.ontologySchemaVersion).toBe(2);
    expect(exported.vault.ontology?.migrationCheckpointRequired).toBe(true);
    for (const key of Object.values(AVATAR_V1_KEYS)) {
      expect(exported.vault.caches).not.toHaveProperty(key);
    }
    const checkpoint = exported.vault.migrationCheckpoint!;
    expect(JSON.stringify(checkpoint)).not.toContain('历史原文必须保留');
    const decoded = await decodeAvatarMigrationCheckpoint(checkpoint, password);
    expect(JSON.parse(decoded.snapshot.raw.atoms!)).toEqual(legacy);
    expect(backup).toEqual(original);
  }, 30000);

  it('blocks legacy import into a locked account without changing protected state', async () => {
    const backup = await exportVaultBackup('legacy-import');
    backup.vault.caches[AVATAR_V1_KEYS.atoms] = [{ id: 'legacy', statement: '保留原文' }];
    const password = 'locked-import-password-123';
    const salt = 'locked-import-salt';
    await changeFutureProtection(password, await SecurityService.hashPassword(password, salt), salt);
    useAppStore.setState({ masterPassword: null, isUnlocked: false });
    const before = await get(K.passwordHash);
    await expect(importVaultBackup(backup, 'replace', undefined, password)).rejects.toThrow();
    expect(await get(K.passwordHash)).toEqual(before);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
    expect(useAppStore.getState().isUnlocked).toBe(false);
    expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBeNull();
  }, 30000);

  it('exports and restores stable source messages, invalidating old confirmation revisions', async () => {
    await set(AVATAR_ONTOLOGY_KEY, graph(8));
    const backup = await exportVaultBackup('test');
    expect(backup.vault.ontology).toEqual(graph(8));
    await clear();
    await importVaultBackup(backup, 'replace');
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(graph(9));
  });
  it('rejects conflicting original messages in both drill and import without partial writes', async () => {
    await set(AVATAR_ONTOLOGY_KEY, graph(2));
    const backup = await exportVaultBackup('test');
    backup.vault.ontology!.sessions![0].messages[0].content = '不同的原文';
    const before = await get(K.entries);
    const drill = await drillVaultBackupRestore(backup);
    expect(drill.canRestore).toBe(false);
    expect(drill.conflicts.join()).toContain('认知资料编号冲突');
    await expect(importVaultBackup(backup)).rejects.toThrow('认知资料编号冲突');
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(graph(2));
    expect(await get(K.entries)).toEqual(before);
  });
  it('prevents a graphless backup replacing existing cognition', () => {
    expect(() => mergeAvatarOntologyBackup(graph(), undefined, 'replace')).toThrow('缺少 v2');
    expect(mergeAvatarOntologyBackup(graph(), undefined, 'merge')).toEqual(graph());
  });
  it('deduplicates identical sources and never mutates its inputs', () => {
    const local = graph(7);
    const incoming = graph(2);
    const result = mergeAvatarOntologyBackup(local, incoming, 'merge')!;
    expect(result.revision).toBe(8);
    expect(result.sessions).toHaveLength(1);
    result.sessions![0].messages[0].content = 'mutation';
    expect(local).toEqual(graph(7));
    expect(incoming).toEqual(graph(2));
  });
  it('preserves the migration checkpoint requirement when merging a new account backup', () => {
    const local = { ...graph(4), migrationCheckpointRequired: true as const };
    const incoming = graph(1);
    expect(mergeAvatarOntologyBackup(local, incoming, 'merge')).toMatchObject({
      revision: 5,
      migrationCheckpointRequired: true,
    });
    expect(incoming.migrationCheckpointRequired).toBeUndefined();
  });
  it('rejects malformed imported graphs before restore', () => {
    expect(() =>
      mergeAvatarOntologyBackup(graph(), { ...graph(), revision: -1 }, 'replace'),
    ).toThrow('校验失败');
  });
  it('rejects restore after lock-unlock during encryption without committing the graph', async () => {
    await set(AVATAR_ONTOLOGY_KEY, graph(4));
    const backup = await exportVaultBackup('test');
    backup.vault.ontology!.revision = 20;
    const password = 'restore-security-test';
    const salt = 'restore-security-salt';
    await changeFutureProtection(
      password,
      await SecurityService.hashPassword(password, salt),
      salt,
    );
    useAppStore.setState({ masterPassword: password, isUnlocked: true });
    const before = await get(AVATAR_ONTOLOGY_KEY);
    const encrypt = SecurityService.encrypt;
    let changed = false;
    vi.spyOn(SecurityService, 'encrypt').mockImplementation(async (...args) => {
      if (!changed) {
        changed = true;
        useAppStore.setState({ masterPassword: null, isUnlocked: false });
        useAppStore.setState({ masterPassword: password, isUnlocked: true });
      }
      return encrypt(...args);
    });
    await expect(importVaultBackup(backup, 'replace')).rejects.toThrow();
    expect(changed).toBe(true);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(before);
  });
  it.each([exportVaultBackupFile, exportRecoverableVaultBackupFile])(
    'discards an encrypted export after a lock-unlock transition',
    async (exportFile) => {
      const password = 'backup-security-test';
      const salt = 'ontology-backup-test-salt';
      await changeFutureProtection(
        password,
        await SecurityService.hashPassword(password, salt),
        salt,
      );
      useAppStore.setState({ masterPassword: password, isUnlocked: true });
      const encrypt = backupFile.encryptVaultBackupFile;
      vi.spyOn(backupFile, 'encryptVaultBackupFile').mockImplementation(async (...args) => {
        useAppStore.setState({ masterPassword: null, isUnlocked: false });
        useAppStore.setState({ masterPassword: password, isUnlocked: true });
        return encrypt(...args);
      });
      await expect(exportFile('test')).rejects.toThrow();
    },
  );
});
