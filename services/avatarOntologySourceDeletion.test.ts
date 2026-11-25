import { beforeEach, describe, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { deleteSourceEntries, DELETION_JOURNAL } from './sourceDeletion';
import { deleteOntologySources } from './avatarOntologySourceDeletion';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { validateAvatarOntology } from './avatarOntologyStore';

describe('atomic v2 source deletion', () => {
  const object = (id: string, version = 1) => ({
    id,
    schemaVersion: 2,
    domain: 'about_me',
    category: 'preferences_boundaries',
    statement: '喜欢安静',
    status: 'candidate',
    lineageId: 'lineage',
    version,
    origin: 'user_manual',
    confidenceScore: 1,
    reinforcementCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    validity: { mode: 'long_term', validFrom: '2026-01-01T00:00:00.000Z' },
    privacy: { sensitivity: 'normal', aiVisible: false, traceabilityDegraded: false },
    evidenceGate: {
      requiresMultiSourceGate: false,
      independentExperienceCount: 0,
      distinctUserMessageCount: 0,
      distinctDateCount: 0,
      distinctSessionCount: 0,
      isReadyForConfirmation: false,
    },
  });

  const graph = () => ({
    ontologySchemaVersion: 2,
    revision: 0,
    objects: [object('a'), { ...object('b'), lineageId: 'other' }],
    edges: [
      {
        id: 'e',
        schemaVersion: 2,
        type: 'EVIDENCED_BY',
        fromId: 'a',
        toId: 'source',
        createdAt: '2026-01-01T00:00:00.000Z',
        sourceKind: 'now_entry',
        verbatimQuote: '喜欢安静',
        quoteVerifiedByServer: true,
        sourceOccurredAt: '2026-01-01T00:00:00.000Z',
        lastKnownSourceState: 'accessible',
      },
    ],
  });
  beforeEach(async () => {
    await clear();
    localStorage.clear();
    useAppStore.setState({ masterPassword: null, isUnlocked: true });
  });
  it('rolls back records and graph when a required migration checkpoint is missing', async () => {
    const original = { ...graph(), migrationCheckpointRequired: true };
    const entries = [{ id: 'source', content: '喜欢安静' }];
    await set(AVATAR_ONTOLOGY_KEY, original);
    await set(K.entries, entries);
    await expect(deleteSourceEntries(['source'], false, false)).rejects.toThrow();
    expect(await get(K.entries)).toEqual(entries);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(original);
    expect(await get(DELETION_JOURNAL)).toBeUndefined();
  });
  it('blocks a locked account before deleting records or cognition', async () => {
    const original = graph();
    const entries = [{ id: 'source', content: '喜欢安静' }];
    await set(AVATAR_ONTOLOGY_KEY, original);
    await set(K.entries, entries);
    await set(K.passwordHash, 'configured-password');
    useAppStore.setState({ isUnlocked: false });
    await expect(deleteSourceEntries(['source'], false, false)).rejects.toThrow();
    expect(await get(K.entries)).toEqual(entries);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(original);
  });
  it('allows source deletion for passwordless legacy users without touching paused Avatar bytes', async () => {
    const legacyKey = 'vector:avatar:atomic-memories:v1';
    const original = '[{"id":"legacy","statement":"original"}]';
    localStorage.setItem(legacyKey, original);
    await set(K.entries, [{ id: 'source', content: '喜欢安静' }]);
    await deleteSourceEntries(['source'], false, false);
    expect(await get(K.entries)).toEqual([]);
    expect(localStorage.getItem(legacyKey)).toBe(original);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
  });
  it('does not initialize a paused legacy account or rewrite its data', () => {
    const values = { legacy: 'original' };
    expect(deleteOntologySources(values, ['source'], false)).toEqual(new Set());
    expect(values).toEqual({ legacy: 'original' });
  });
  it('removes dependent objects and evidence but preserves unrelated cognition', () => {
    const values = { [AVATAR_ONTOLOGY_KEY]: graph() };
    expect(deleteOntologySources(values, ['source'], false)).toEqual(new Set(['a']));
    expect(values[AVATAR_ONTOLOGY_KEY].objects.map((o) => o.id)).toEqual(['b']);
    expect(values[AVATAR_ONTOLOGY_KEY].edges).toEqual([]);
    validateAvatarOntology(values[AVATAR_ONTOLOGY_KEY]);
  });
  it('retains chosen cognition while disabling AI and removing deleted quotations', () => {
    const values = { [AVATAR_ONTOLOGY_KEY]: graph() };
    deleteOntologySources(values, ['source'], true);
    expect(values[AVATAR_ONTOLOGY_KEY].objects[0]).toMatchObject({
      status: 'retained_after_source_delete',
      privacy: { aiVisible: false, traceabilityDegraded: true },
    });
    expect(values[AVATAR_ONTOLOGY_KEY].edges).toEqual([]);
    validateAvatarOntology(values[AVATAR_ONTOLOGY_KEY]);
  });
  it('removes all evidence attached to a deleted contextual session, including other messages', () => {
    const original = graph();
    const values: Record<string, unknown> = {
      [AVATAR_ONTOLOGY_KEY]: {
        ...original,
        edges: [
          {
            ...original.edges[0],
            sourceKind: 'chat_user_message',
            sessionId: 's',
            userMessageIndex: 0,
            toId: 'm',
          },
        ],
        sessions: [
          {
            id: 's',
            mode: 'general',
            context: { mode: 'general', source: 'past-detail', entryId: 'source' },
            messages: [
              {
                id: 'm',
                role: 'user',
                type: 'text',
                content: '喜欢安静',
                created_at: '2026-01-01T00:00:00.000Z',
              },
            ],
            references: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    };
    expect(deleteOntologySources(values, ['source'], false)).toEqual(new Set(['a']));
    expect(values[AVATAR_ONTOLOGY_KEY]).toMatchObject({ edges: [], sessions: [] });
    validateAvatarOntology(values[AVATAR_ONTOLOGY_KEY]);
  });
});
