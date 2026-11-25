import { describe, expect, it } from 'vitest';
import {
  blockedOntologyRows,
  hashDeletedId,
  mergeDeletionTombstones,
  readDeletionTombstones,
  tombstoneBlocksEntry,
} from './deletionTombstone';

describe('deletion tombstones', () => {
  it('stores only a stable hash and deletion metadata', async () => {
    const id = 'private-record-id';
    const hash = await hashDeletedId(id);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(id);
    const old = {
      entityIdHash: hash,
      entityKind: 'source_record' as const,
      opType: 'deleted' as const,
      occurredAt: '2025-01-01T00:00:00.000Z',
      schemaVersion: 1 as const,
    };
    const newer = { ...old, opType: 'ai_revoked' as const, occurredAt: '2025-02-01T00:00:00.000Z' };
    expect(mergeDeletionTombstones([old], [newer])).toEqual([newer]);
    expect(JSON.stringify(readDeletionTombstones([newer]))).not.toContain(id);
  });

  it('rejects content or summary fields in a malformed tombstone', async () => {
    const entityIdHash = await hashDeletedId('a');
    expect(() =>
      readDeletionTombstones([
        {
          entityIdHash,
          entityKind: 'source_record',
          opType: 'deleted',
          occurredAt: '2025-01-01T00:00:00.000Z',
          schemaVersion: 1,
          summary: 'private',
        },
      ]),
    ).toThrow();
  });

  it('blocks only an incoming version older than the deletion', async () => {
    const tombstone = {
      entityIdHash: await hashDeletedId('a'),
      entityKind: 'source_record' as const,
      opType: 'deleted' as const,
      occurredAt: '2025-01-02T00:00:00.000Z',
      schemaVersion: 1 as const,
    };
    expect(tombstoneBlocksEntry(tombstone, { createdAt: Date.parse('2025-01-01') })).toBe(true);
    expect(tombstoneBlocksEntry(tombstone, { updatedAt: Date.parse('2025-01-03') })).toBe(false);
    expect(tombstoneBlocksEntry(tombstone, {})).toBe(true);
  });

  it('blocks older cognitive rows and edges independently of source records', async () => {
    const occurredAt = '2025-02-01T00:00:00.000Z';
    const graph = {
      objects: [{ id: 'old-object', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }],
      edges: [{ id: 'old-edge', createdAt: '2025-01-01T00:00:00.000Z' }],
    } as Parameters<typeof blockedOntologyRows>[0];
    const tombstones = await Promise.all([
      { id: 'old-object', entityKind: 'cognitive_object' as const },
      { id: 'old-edge', entityKind: 'ontology_edge' as const },
    ].map(async ({ id, entityKind }) => ({
      entityIdHash: await hashDeletedId(id, entityKind), entityKind,
      opType: 'deleted' as const, occurredAt, schemaVersion: 1 as const,
    })));
    expect(await blockedOntologyRows(graph, tombstones)).toEqual(['old-object', 'old-edge']);
  });
});
