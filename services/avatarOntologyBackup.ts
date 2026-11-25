import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { validateAvatarOntology } from './avatarOntologyValidation';
import { canonical } from './vaultBackupNormalization';

/** Restore never guesses which independently edited cognition or source message wins. */
export function mergeAvatarOntologyBackup(
  current: unknown,
  incoming: unknown,
  mode: 'merge' | 'replace',
): AvatarOntologySnapshot | undefined {
  if (current !== undefined) validateAvatarOntology(current);
  if (incoming !== undefined) validateAvatarOntology(incoming);
  // Older backups do not contain the ontology. They must not erase a live v2 graph.
  if (incoming === undefined) {
    if (current !== undefined && mode === 'replace')
      throw new Error('备份缺少 v2 认知资料，不能替换现有认知库');
    return current === undefined ? undefined : structuredClone(current as AvatarOntologySnapshot);
  }
  const incomingGraph = incoming as AvatarOntologySnapshot;
  const currentGraph = current as AvatarOntologySnapshot | undefined;
  const next = structuredClone(incomingGraph);
  if (mode === 'merge' && currentGraph) {
    if (currentGraph.migrationCheckpointRequired) next.migrationCheckpointRequired = true;
    const merge = <T extends { id: string }>(local: T[], imported: T[]): T[] => {
      const result = new Map(local.map((row) => [row.id, structuredClone(row)]));
      for (const row of imported) {
        const existing = result.get(row.id);
        if (existing && canonical(existing) !== canonical(row))
          throw new Error(`认知资料编号冲突：${row.id}，未导入任何数据`);
        if (!existing) result.set(row.id, structuredClone(row));
      }
      return [...result.values()];
    };
    next.objects = merge(currentGraph.objects, next.objects);
    next.edges = merge(currentGraph.edges, next.edges);
    next.sessions = merge(currentGraph.sessions ?? [], next.sessions ?? []);
  }
  // Invalidate previews issued before restore, even when imported revisions are older.
  next.revision = Math.max(currentGraph?.revision ?? 0, next.revision) + 1;
  validateAvatarOntology(next);
  return next;
}
