import { currentAccountId } from './accountScope';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';

export const DELETION_TOMBSTONES_KEY = 'vector_deletion_tombstones_v1';

export interface DeletionTombstone {
  entityIdHash: string;
  entityKind: 'source_record' | 'cognitive_object' | 'ontology_edge';
  opType: 'deleted' | 'ai_revoked';
  occurredAt: string;
  schemaVersion: 1;
}

export async function hashDeletedId(
  id: string,
  entityKind: DeletionTombstone['entityKind'] = 'source_record',
  accountSalt = currentAccountId() ?? 'local-vault',
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${accountSalt}:${entityKind}:${id}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readDeletionTombstones(value: unknown): DeletionTombstone[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        Object.keys(item).some(
          (key) =>
            !['entityIdHash', 'entityKind', 'opType', 'occurredAt', 'schemaVersion'].includes(key),
        ) ||
        !/^[a-f0-9]{64}$/.test(item.entityIdHash) ||
        !['source_record', 'cognitive_object', 'ontology_edge'].includes(item.entityKind) ||
        !['deleted', 'ai_revoked'].includes(item.opType) ||
        !Number.isFinite(Date.parse(item.occurredAt)) ||
        item.schemaVersion !== 1,
    )
  )
    throw new Error('删除记录校验失败，已停止恢复');
  return value as DeletionTombstone[];
}

export function mergeDeletionTombstones(...groups: DeletionTombstone[][]): DeletionTombstone[] {
  const latest = new Map<string, DeletionTombstone>();
  for (const item of groups.flat()) {
    const previous = latest.get(item.entityIdHash);
    if (!previous || item.occurredAt > previous.occurredAt) latest.set(item.entityIdHash, item);
  }
  return [...latest.values()];
}

/** An older copy may only be restored after the user explicitly confirms it. */
export function tombstoneBlocksEntry(
  tombstone: DeletionTombstone | undefined,
  entry: { createdAt?: number | string; updatedAt?: number | string },
): boolean {
  if (!tombstone) return false;
  const changedAt = entry.updatedAt ?? entry.createdAt;
  const timestamp = typeof changedAt === 'string' ? Date.parse(changedAt) : changedAt;
  return !Number.isFinite(timestamp) || Date.parse(tombstone.occurredAt) > timestamp!;
}

/** Check every imported graph row before it can replace or merge with the live graph. */
export async function blockedOntologyRows(
  incoming: AvatarOntologySnapshot | undefined,
  tombstones: DeletionTombstone[],
): Promise<string[]> {
  if (!incoming) return [];
  const deleted = new Map(tombstones.map((item) => [item.entityIdHash, item]));
  // Account snapshots can carry the encrypted graph envelope rather than decoded rows.
  // The envelope is validated by validateSnapshotOntology before this check.
  if (!Array.isArray(incoming.objects) || !Array.isArray(incoming.edges)) return [];
  const rows = [
    ...incoming.objects.map((row) => ({ ...row, entityKind: 'cognitive_object' as const })),
    ...incoming.edges.map((row) => ({ ...row, entityKind: 'ontology_edge' as const })),
  ];
  const blocked = await Promise.all(rows.map(async (row) =>
    tombstoneBlocksEntry(deleted.get(await hashDeletedId(row.id, row.entityKind)), row)
      ? row.id : null,
  ));
  return blocked.filter((id): id is string => id !== null);
}
