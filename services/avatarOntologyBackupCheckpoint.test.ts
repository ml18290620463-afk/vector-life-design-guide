import { beforeEach, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import {
  AVATAR_ONTOLOGY_KEY as graphKey,
  AVATAR_MIGRATION_SNAPSHOT_KEY as snapshotKey,
  AVATAR_MIGRATION_RESULT_KEY as resultKey,
} from './avatarOntologyKey';
import { convertAvatarV1Snapshot } from './avatarOntologyMigration';
import { decodeAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import {
  encryptVaultBackupFile,
  decryptVaultBackupFile,
  isEncryptedVaultBackup,
} from './vaultBackupFile';
import {
  exportVaultBackupFile,
  importVaultBackup,
  drillVaultBackupRestore,
  type VaultBackup,
} from './vaultBackup';
const password = 'archive-source-password';
const raw = { sessions: null, understandings: null, atoms: '[]', relations: null, tags: null };
async function protect(key: string) {
  await set(K.passwordHash, await SecurityService.hashPassword(key, 'salt'));
  await set(K.passwordSalt, 'salt');
  useAppStore.setState({ masterPassword: key, isUnlocked: true });
}
async function backup() {
  await protect(password);
  await set(graphKey, {
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [],
    edges: [],
    sessions: [],
    migrationCheckpointRequired: true,
  });
  await set(
    snapshotKey,
    await encryptVaultBackupFile(
      { version: 1, accountId: null, capturedAt: '2026-11-24T00:00:00.000Z', raw },
      password,
    ),
  );
  await set(resultKey, await encryptVaultBackupFile(convertAvatarV1Snapshot(raw), password));
  const file = await exportVaultBackupFile('test');
  if (!isEncryptedVaultBackup(file)) throw new Error('Expected encrypted export');
  return (await decryptVaultBackupFile(file, password)) as VaultBackup;
}
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
it('exports encrypted archives and restores them using the target vault key', async () => {
  const source = await backup();
  expect(source.vault.migrationCheckpoint).toBeDefined();
  await clear();
  await protect('target-password');
  await importVaultBackup(source, 'replace', undefined, password);
  const restored = { snapshot: await get(snapshotKey), result: await get(resultKey) };
  expect(
    (await decodeAvatarMigrationCheckpoint(restored, 'target-password', null)).snapshot.raw,
  ).toEqual(raw);
  await expect(decodeAvatarMigrationCheckpoint(restored, password)).rejects.toThrow();
}, 15_000);
it('rejects an incomplete archive in drill and import without writing the target', async () => {
  const source = await backup();
  delete source.vault.migrationCheckpoint;
  await clear();
  await protect('target-password');
  const before = await get(K.passwordHash);
  expect((await drillVaultBackupRestore(source, 'replace', undefined, password)).canRestore).toBe(
    false,
  );
  await expect(importVaultBackup(source, 'replace', undefined, password)).rejects.toThrow(
    '缺少迁移',
  );
  expect(await get(graphKey)).toBeUndefined();
  expect(await get(snapshotKey)).toBeUndefined();
  expect(await get(K.passwordHash)).toBe(before);
});
it('rejects a wrong source key without partially writing any graph or archive', async () => {
  const source = await backup();
  await clear();
  await protect('target-password');
  await expect(importVaultBackup(source, 'replace', undefined, 'wrong-key')).rejects.toThrow();
  expect(await get(graphKey)).toBeUndefined();
  expect(await get(snapshotKey)).toBeUndefined();
  expect(await get(resultKey)).toBeUndefined();
});
