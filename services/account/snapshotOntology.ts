import { SecurityService } from '../securityService';
import { validateAvatarOntology } from '../avatarOntologyValidation';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from '../avatarOntologyKey';
import {
  avatarMigrationCheckpointFrom,
  decodeAvatarMigrationCheckpoint,
} from '../avatarOntologyMigrationCheckpoint';

/** Validate transport copies without writing or exposing decrypted graph/archive data. */
export async function validateSnapshotOntology(
  data: Record<string, unknown>,
  password: string,
  owner: string,
) {
  await decodeSnapshotOntology(data, password, owner);
}

/** Return only a validated transient graph for deletion checks during import. */
export async function decodeSnapshotOntology(
  data: Record<string, unknown>,
  password: string,
  owner: string,
) {
  let graph = data[AVATAR_ONTOLOGY_KEY];
  if (graph && typeof graph === 'object' && 'format' in graph) {
    if (
      graph.format !== 'vector-private-v1' ||
      !('ciphertext' in graph) ||
      typeof graph.ciphertext !== 'string'
    )
      throw new Error('同步认知资料加密格式无效');
    graph = JSON.parse(await SecurityService.decrypt(graph.ciphertext, password));
  }
  if (graph !== undefined) validateAvatarOntology(graph);
  const checkpointRequired =
    !!graph &&
    typeof graph === 'object' &&
    'migrationCheckpointRequired' in graph &&
    graph.migrationCheckpointRequired === true;
  if (
    checkpointRequired ||
    data[AVATAR_MIGRATION_SNAPSHOT_KEY] !== undefined ||
    data[AVATAR_MIGRATION_RESULT_KEY] !== undefined
  ) {
    await decodeAvatarMigrationCheckpoint(avatarMigrationCheckpointFrom(data), password, owner);
  }
  return graph;
}
