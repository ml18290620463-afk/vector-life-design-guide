import { expect, it } from 'vitest';
import { validateSnapshotOntology } from './snapshotOntology';
import {
  AVATAR_ONTOLOGY_KEY as GRAPH,
  AVATAR_MIGRATION_SNAPSHOT_KEY as SNAPSHOT,
  AVATAR_MIGRATION_RESULT_KEY as RESULT,
} from '../avatarOntologyKey';
import { encryptVaultBackupFile } from '../vaultBackupFile';
import { convertAvatarV1Snapshot } from '../avatarOntologyMigration';
import { SecurityService } from '../securityService';

async function fixture() {
  const raw = { sessions: null, understandings: null, atoms: '[]', relations: null, tags: null };
  return {
    [GRAPH]: {
      format: 'vector-private-v1',
      ciphertext: await SecurityService.encrypt(
        JSON.stringify({
          ontologySchemaVersion: 2,
          revision: 0,
          objects: [],
          edges: [],
          migrationCheckpointRequired: true,
        }),
        'pw',
      ),
    },
    [SNAPSHOT]: await encryptVaultBackupFile(
      { version: 1, accountId: 'owner', capturedAt: new Date().toISOString(), raw },
      'pw',
    ),
    [RESULT]: await encryptVaultBackupFile(convertAvatarV1Snapshot(raw), 'pw'),
  };
}
it('validates an encrypted graph and exact migration archive without mutating transport bytes', async () => {
  const data = await fixture();
  const before = structuredClone(data);
  await validateSnapshotOntology(data, 'pw', 'owner');
  expect(data).toEqual(before);
});
it('rejects missing archives, mismatched owners and incorrect keys', async () => {
  const data = await fixture();
  await expect(validateSnapshotOntology({ [GRAPH]: data[GRAPH] }, 'pw', 'owner')).rejects.toThrow(
    '缺少',
  );
  await expect(validateSnapshotOntology(data, 'pw', 'other')).rejects.toThrow();
  await expect(validateSnapshotOntology(data, 'wrong', 'owner')).rejects.toThrow();
});
it('rejects encrypted but inconsistent migration results and invalid graph schemas', async () => {
  const data = await fixture();
  data[RESULT] = await encryptVaultBackupFile({ ontologySchemaVersion: 2, objects: [] }, 'pw');
  await expect(validateSnapshotOntology(data, 'pw', 'owner')).rejects.toThrow('迁移结果');
  await expect(
    validateSnapshotOntology({ [GRAPH]: { ontologySchemaVersion: 1 } }, 'pw', 'owner'),
  ).rejects.toThrow('认知资料');
});
