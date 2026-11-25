import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
import { verifyAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import { validateAvatarOntology } from './avatarOntologyValidation';
import { preparedVaultTransaction, VaultConflictError } from './vaultTransaction';

/** Checkpoint bytes participate in the same optimistic commit as the graph. */
export function avatarOntologyTransaction<T>(
  keys: string[],
  mutate: (values: Record<string, unknown>) => T | Promise<T>,
  readonly = false,
  protection?: Parameters<typeof preparedVaultTransaction>[3],
  beforeCommit?: () => void,
) {
  return preparedVaultTransaction(
    [...keys, AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY],
    async (values) => {
      const graph = values[AVATAR_ONTOLOGY_KEY];
      if (graph !== undefined) {
        validateAvatarOntology(graph);
        if (graph.migrationCheckpointRequired) await verifyAvatarMigrationCheckpoint(values);
      }
      beforeCommit?.();
      return mutate(values);
    },
    readonly,
    protection,
    beforeCommit,
  );
}

/** Only for pure reads: discard invalidated snapshots and read fresh data while
 * retaining the caller's original account/key guard across all attempts. */
export async function readFreshAvatarSnapshot<T>(
  read: () => Promise<T>,
  assertCurrent: () => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    assertCurrent();
    try {
      const result = await read();
      assertCurrent();
      return result;
    } catch (error) {
      assertCurrent();
      if (!(error instanceof VaultConflictError) || attempt >= 4) throw error;
    }
  }
}
