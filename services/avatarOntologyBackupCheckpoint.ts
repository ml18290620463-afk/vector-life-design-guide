import { currentAccountId } from './accountScope';
import { useAppStore } from '../stores/appStore';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
import {
  avatarMigrationCheckpointFrom,
  decodeAvatarMigrationCheckpoint,
  reencryptAvatarMigrationCheckpoint,
  type AvatarMigrationCheckpoint,
} from './avatarOntologyMigrationCheckpoint';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { canonical } from './vaultBackupNormalization';

export const avatarBackupKeys = [
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
];

export async function exportAvatarCheckpoint(values: Record<string, unknown>) {
  const graph = values[AVATAR_ONTOLOGY_KEY] as AvatarOntologySnapshot | undefined;
  if (
    !graph?.migrationCheckpointRequired &&
    values[AVATAR_MIGRATION_SNAPSHOT_KEY] === undefined &&
    values[AVATAR_MIGRATION_RESULT_KEY] === undefined
  )
    return undefined;
  const session = useAppStore.getState();
  if (!session.isUnlocked || !session.masterPassword) throw new Error('请先解锁迁移归档');
  const checkpoint = avatarMigrationCheckpointFrom(values);
  await decodeAvatarMigrationCheckpoint(checkpoint, session.masterPassword, currentAccountId());
  return structuredClone(checkpoint);
}

/** Prepares encrypted archives only; caller commits them atomically with the graph. */
export async function prepareAvatarCheckpointRestore(
  values: Record<string, unknown>,
  incoming: { ontology?: AvatarOntologySnapshot; migrationCheckpoint?: AvatarMigrationCheckpoint },
  mode: 'merge' | 'replace',
  sourcePassword: string | undefined,
  targetPassword: string | null,
) {
  const local = await exportAvatarCheckpoint(values);
  if (incoming.ontology?.migrationCheckpointRequired && !incoming.migrationCheckpoint)
    throw new Error('备份缺少迁移快照或结果');
  const remote = incoming.migrationCheckpoint;
  if (!remote) return local;
  if (!sourcePassword || !targetPassword) throw new Error('恢复迁移归档需要来源密码及目标密钥');
  const decoded = await decodeAvatarMigrationCheckpoint(remote, sourcePassword);
  if (mode === 'merge' && local) {
    const existing = await decodeAvatarMigrationCheckpoint(
      local,
      useAppStore.getState().masterPassword!,
    );
    if (canonical(existing.snapshot.raw) !== canonical(decoded.snapshot.raw))
      throw new Error('迁移历史归档冲突，未导入任何数据');
    return local;
  }
  return reencryptAvatarMigrationCheckpoint(
    remote,
    sourcePassword,
    targetPassword,
    currentAccountId(),
  );
}

export function assignAvatarCheckpoint(
  values: Record<string, unknown>,
  checkpoint: AvatarMigrationCheckpoint | undefined,
  graph: AvatarOntologySnapshot | undefined,
) {
  if (!checkpoint) return;
  if (!graph) throw new Error('迁移归档缺少 v2 认知库');
  graph.migrationCheckpointRequired = true;
  values[AVATAR_MIGRATION_SNAPSHOT_KEY] = checkpoint.snapshot;
  values[AVATAR_MIGRATION_RESULT_KEY] = checkpoint.result;
}
