import { beforeEach, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { AVATAR_V1_KEYS, normalizeAvatarBackupPayload } from './avatarOntologyMigration';
import { decodeAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { BACKUP_RESTORE_JOB } from './vaultTransaction';
import { recoverBackupRestore } from './vaultBackup';

const password = 'migration-backup-test-123';
const legacy = [{ id: 'unknown', statement: '不可丢弃的历史原文', status: 'confirmed' }];
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ isUnlocked: true, masterPassword: null });
});
it('requires a key for nonempty legacy payloads without modifying input or storage', async () => {
  const input = { caches: { [AVATAR_V1_KEYS.atoms]: legacy } };
  await expect(normalizeAvatarBackupPayload(input, null)).rejects.toThrow('解锁');
  expect(input.caches[AVATAR_V1_KEYS.atoms]).toEqual(legacy);
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
});
it('removes empty legacy arrays without requiring a password', async () => {
  expect(
    await normalizeAvatarBackupPayload(
      { caches: { [AVATAR_V1_KEYS.atoms]: [], user_custom_anchors: ['工作'] } },
      null,
    ),
  ).toEqual({ caches: { user_custom_anchors: ['工作'] } });
});
it('preserves unknown raw data in the encrypted checkpoint and rejects changed legacy imports', async () => {
  const input = { caches: { [AVATAR_V1_KEYS.atoms]: legacy } };
  const normalized = await normalizeAvatarBackupPayload(input, password);
  expect(normalized.caches).toEqual({});
  expect(normalized.ontology?.objects ?? []).not.toContainEqual(
    expect.objectContaining({ status: 'confirmed' }),
  );
  expect(JSON.stringify(normalized.migrationCheckpoint)).not.toContain('不可丢弃');
  const decoded = await decodeAvatarMigrationCheckpoint(normalized.migrationCheckpoint!, password);
  expect(JSON.parse(decoded.snapshot.raw.atoms!)).toEqual(legacy);
  const repeated = await normalizeAvatarBackupPayload(
    { ...normalized, caches: input.caches },
    password,
  );
  expect(repeated).toEqual(normalized);
  await expect(
    normalizeAvatarBackupPayload(
      {
        ...normalized,
        caches: { [AVATAR_V1_KEYS.atoms]: [{ ...legacy[0], statement: '被修改' }] },
      },
      password,
    ),
  ).rejects.toThrow('不一致');
}, 30000);
it('rejects unproven mixed legacy and v2 payloads', async () => {
  await expect(
    normalizeAvatarBackupPayload(
      {
        ontology: { ontologySchemaVersion: 2, revision: 0, objects: [], edges: [] },
        caches: { [AVATAR_V1_KEYS.atoms]: legacy },
      },
      password,
    ),
  ).rejects.toThrow('混合版本');
});
it('keeps an old interrupted restore journal intact while no key is available', async () => {
  const job = { caches: { [AVATAR_V1_KEYS.atoms]: legacy }, mirrorKeys: [] };
  await set(BACKUP_RESTORE_JOB, job);
  await expect(recoverBackupRestore()).rejects.toThrow('解锁');
  expect(await get(BACKUP_RESTORE_JOB)).toEqual(job);
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
  expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBeNull();
});
it('recovers a legacy journal into encrypted v2 state without recreating legacy caches', async () => {
  const { changeFutureProtection } = await import('./vaultTransaction');
  const { SecurityService } = await import('./securityService');
  const { AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY } =
    await import('./avatarOntologyKey');
  const salt = 'legacy-journal-salt';
  await changeFutureProtection(password, await SecurityService.hashPassword(password, salt), salt);
  useAppStore.setState({ isUnlocked: true, masterPassword: password });
  // This is the old durable journal format, before the v2 graph was committed.
  const { vaultTransaction } = await import('./vaultTransaction');
  await vaultTransaction([BACKUP_RESTORE_JOB], (values) => {
    values[BACKUP_RESTORE_JOB] = { caches: { [AVATAR_V1_KEYS.atoms]: legacy }, mirrorKeys: [] };
  });
  await recoverBackupRestore();
  expect(await get(BACKUP_RESTORE_JOB)).toBeUndefined();
  const graph = await get(AVATAR_ONTOLOGY_KEY);
  expect(graph.format).toBe('vector-private-v1');
  expect(JSON.stringify(graph)).not.toContain('不可丢弃');
  const snapshot = await get(AVATAR_MIGRATION_SNAPSHOT_KEY);
  const result = await get(AVATAR_MIGRATION_RESULT_KEY);
  const decoded = await decodeAvatarMigrationCheckpoint({ snapshot, result }, password);
  expect(JSON.parse(decoded.snapshot.raw.atoms!)).toEqual(legacy);
  expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBeNull();
  await recoverBackupRestore();
  expect(await get(AVATAR_MIGRATION_SNAPSHOT_KEY)).toEqual(snapshot);
}, 30000);
