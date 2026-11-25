import { cognition, evidenceGraph } from '../tests/fixtures/avatarOntology';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clear, del, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import { DiaryStorageKeys as K } from './diaryStorage';
import { SecurityService } from './securityService';
import { AVATAR_V1_KEYS } from './avatarOntologyMigration';
import {
  AVATAR_ONTOLOGY_KEY,
  AVATAR_MIGRATION_SNAPSHOT_KEY,
  AVATAR_MIGRATION_RESULT_KEY,
} from './avatarOntologyKey';
import {
  settleExpiredAvatarOntology,
  getRevisionTrajectories,
  previewSourceDeletionImpact,
  confirmAvatarCognition,
  reviewAvatarPendingBatch,
  rejectAvatarCognition,
  readAvatarConfirmationPreview,
  initializeAvatarOntology,
  readAvatarOntology,
  commitAvatarOntology,
  AvatarUpgradeRequiredError,
  validateAvatarOntology,
} from './avatarOntologyStore';

const password = 'Phase1-private-123!';
async function unlock() {
  const salt = 'phase-one-salt';
  await set(K.passwordHash, await SecurityService.hashPassword(password, salt));
  await set(K.passwordSalt, salt);
  useAppStore.setState({ masterPassword: password, isUnlocked: true });
}
beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});
afterEach(() => vi.restoreAllMocks());

describe('ontology storage boundary', () => {
  it('initializes a passwordless new account once and preserves subsequent revisions', async () => {
    expect(await initializeAvatarOntology()).toEqual({
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [],
      edges: [],
    });
    await commitAvatarOntology(0, () => {});
    expect((await initializeAvatarOntology()).revision).toBe(1);
  });
  it('pauses a passwordless legacy account without altering original bytes', async () => {
    const original = '[ { "id": "legacy", "statement": "original" } ]';
    localStorage.setItem(AVATAR_V1_KEYS.atoms, original);
    await expect(initializeAvatarOntology()).rejects.toBeInstanceOf(AvatarUpgradeRequiredError);
    expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe(original);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
  });
  it('resumes a paused legacy account after password setup using an encrypted migration', async () => {
    const original = JSON.stringify([
      {
        id: 'old',
        statement: '喜欢安静的环境',
        nature: 'explicit',
        facets: ['preference'],
        tags: [],
        contexts: [],
        sourceRefs: [{ source: 'message', id: 'm1', sessionId: 's1', excerpt: '喜欢安静' }],
        confidence: 0.8,
        status: 'confirmed',
        createdAt: Date.UTC(2026, 0, 1),
        confirmedAt: Date.UTC(2026, 0, 1),
        confirmedBy: 'user',
      },
    ]);
    localStorage.setItem(AVATAR_V1_KEYS.atoms, original);
    await expect(initializeAvatarOntology()).rejects.toBeInstanceOf(AvatarUpgradeRequiredError);
    await unlock();
    const graph = await initializeAvatarOntology();
    expect(graph.objects).toHaveLength(1);
    expect(graph.objects[0]).toMatchObject({ status: 'candidate', privacy: { aiVisible: false } });
    expect(graph.objects[0].migration?.legacyConfirmedAt).toBeTruthy();
    expect(graph.objects[0].evidenceGate.isReadyForConfirmation).toBe(false);
    expect(await get(AVATAR_ONTOLOGY_KEY)).toMatchObject({ format: 'vector-private-v1' });
    expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe(original);
    expect(await initializeAvatarOntology()).toEqual(graph);
  });
  it.each([AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY])(
    'blocks reopening when the encrypted checkpoint is missing: %s',
    async (key) => {
      const original = '[{"id":"archived-original"}]';
      localStorage.setItem(AVATAR_V1_KEYS.atoms, original);
      await unlock();
      await initializeAvatarOntology();
      const graphBytes = await get(AVATAR_ONTOLOGY_KEY);
      await del(key);
      await expect(initializeAvatarOntology()).rejects.toThrow('缺少迁移快照或结果');
      expect(await get(key)).toBeUndefined();
      expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(graphBytes);
      expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe(original);
    },
  );
  it.each([AVATAR_MIGRATION_SNAPSHOT_KEY, AVATAR_MIGRATION_RESULT_KEY])(
    'requires checkpoint after retired storage is removed: %s',
    async (key) => {
      localStorage.setItem(AVATAR_V1_KEYS.atoms, '[{"id":"archived-original"}]');
      await unlock();
      const graph = await initializeAvatarOntology();
      expect(graph.migrationCheckpointRequired).toBe(true);
      localStorage.removeItem(AVATAR_V1_KEYS.atoms);
      expect(await readAvatarOntology()).toEqual(graph);
      expect(await initializeAvatarOntology()).toEqual(graph);
      await expect(
        commitAvatarOntology(graph.revision, (next) => {
          delete next.migrationCheckpointRequired;
        }),
      ).rejects.toThrow('不得改写迁移快照要求');
      const before = await get(AVATAR_ONTOLOGY_KEY);
      await del(key);
      await expect(readAvatarOntology()).rejects.toThrow('缺少迁移快照或结果');
      await expect(initializeAvatarOntology()).rejects.toThrow('缺少迁移快照或结果');
      await expect(commitAvatarOntology(graph.revision, () => {})).rejects.toThrow(
        '缺少迁移快照或结果',
      );
      await expect(readAvatarConfirmationPreview()).rejects.toThrow('缺少迁移快照或结果');
      expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(before);
    },
  );
  it('blocks reopening after encrypted checkpoint corruption without rewriting the graph', async () => {
    const original = '[{"id":"archived-original"}]';
    localStorage.setItem(AVATAR_V1_KEYS.atoms, original);
    await unlock();
    await initializeAvatarOntology();
    const graphBytes = await get(AVATAR_ONTOLOGY_KEY);
    const checkpoint = await get(AVATAR_MIGRATION_SNAPSHOT_KEY);
    await set(AVATAR_MIGRATION_SNAPSHOT_KEY, { ...checkpoint, ciphertext: 'corrupt' });
    await expect(initializeAvatarOntology()).rejects.toThrow();
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(graphBytes);
    expect(localStorage.getItem(AVATAR_V1_KEYS.atoms)).toBe(original);
  });
  it('does not silently replace a corrupt existing v2 database', async () => {
    const invalid = { ontologySchemaVersion: 2, revision: 0, objects: 'corrupt', edges: [] };
    await set(AVATAR_ONTOLOGY_KEY, invalid);
    await expect(initializeAvatarOntology()).rejects.toThrow('校验失败');
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(invalid);
  });
  it('rejects stale editors atomically', async () => {
    await initializeAvatarOntology();
    await commitAvatarOntology(0, () => {});
    await expect(commitAvatarOntology(0, () => {})).rejects.toThrow('已更新');
    expect((await readAvatarOntology()).revision).toBe(1);
  });
  it('encrypts protected graphs and blocks locked reads and initialization', async () => {
    await unlock();
    await initializeAvatarOntology();
    expect(await get(AVATAR_ONTOLOGY_KEY)).toMatchObject({ format: 'vector-private-v1' });
    useAppStore.setState({ masterPassword: null, isUnlocked: false });
    await expect(readAvatarOntology()).rejects.toThrow('解锁');
    await expect(initializeAvatarOntology()).rejects.toThrow('解锁');
  });
  it('aborts a write when lock/unlock occurs during encryption', async () => {
    await unlock();
    await initializeAvatarOntology();
    const before = await get(AVATAR_ONTOLOGY_KEY);
    const encrypt = SecurityService.encrypt.bind(SecurityService);
    vi.spyOn(SecurityService, 'encrypt').mockImplementationOnce(async (...args) => {
      useAppStore.setState({ isUnlocked: false, masterPassword: null });
      useAppStore.setState({ isUnlocked: true, masterPassword: password });
      return encrypt(...args);
    });
    await expect(commitAvatarOntology(0, () => {})).rejects.toThrow('解锁');
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(before);
  });
  it('rejects unsupported relation types rather than retaining an old relation', () => {
    expect(() =>
      validateAvatarOntology({
        ontologySchemaVersion: 2,
        revision: 0,
        objects: [],
        edges: [{ type: 'serves' }],
      }),
    ).toThrow('校验失败');
  });
});

describe('ontology lineage integrity', () => {
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
  it('previews direct and indirect record dependencies without changing graph or unrelated messages', () => {
    const timestamp = '2026-01-01T00:00:00.000Z';
    const reference = { entryId: 'source', title: '', date: 1, excerpt: 'original', reason: '' };
    const message = (id: string, references: (typeof reference)[] = []) => ({
      id,
      role: 'user' as const,
      type: 'text' as const,
      content: '喜欢安静',
      created_at: timestamp,
      references,
    });
    const evidence = (id: string, toId: string, sessionId?: string, index = 0) => ({
      id,
      schemaVersion: 2,
      type: 'EVIDENCED_BY',
      fromId: 'a',
      toId,
      createdAt: timestamp,
      sourceKind: sessionId ? 'chat_user_message' : 'now_entry',
      sessionId,
      userMessageIndex: sessionId ? index : undefined,
      verbatimQuote: '喜欢安静',
      quoteVerifiedByServer: true,
      sourceOccurredAt: timestamp,
      lastKnownSourceState: 'accessible',
    });
    const graph: unknown = {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [object('a')],
      edges: [
        evidence('direct', 'source'),
        evidence('context', 'm1', 'context-session'),
        evidence('reference', 'm2', 'reference-session'),
        evidence('independent', 'm3', 'reference-session', 1),
        evidence('other-record', 'other'),
      ],
      sessions: [
        {
          id: 'context-session',
          mode: 'general',
          context: { mode: 'general', source: 'past-detail', entryId: 'source' },
          messages: [message('m1')],
          references: [],
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'reference-session',
          mode: 'general',
          context: { mode: 'general', source: 'global' },
          messages: [message('m2', [reference]), message('m3')],
          references: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    validateAvatarOntology(graph);
    const before = structuredClone(graph);
    const impact = previewSourceDeletionImpact('source', graph);
    expect(impact).toHaveLength(1);
    expect(impact[0].removedEvidenceIds).toEqual(['direct', 'context', 'reference']);
    expect(impact[0].remainingEvidenceIds).toEqual(['independent', 'other-record']);
    impact[0].object.statement = 'changed preview';
    expect(graph).toEqual(before);
    expect(previewSourceDeletionImpact('missing', graph)).toEqual([]);
  });
  const entry = (id: string, day = 1) => ({
    id,
    title: '',
    content: '喜欢安静',
    tags: [],
    createdAt: Date.UTC(2026, 0, day),
    aiVisibility: 'allowed',
    isLocked: false,
  });
  async function seedConfirmation(inferred = false, days = [1]) {
    const candidate = object('a');
    const entries = days.map((day, index) => entry(`e${index}`, day));
    await set(K.entries, entries);
    await set(AVATAR_ONTOLOGY_KEY, {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [
        {
          ...candidate,
          ...(inferred
            ? {
                domain: 'my_understanding',
                category: 'understanding_judgment',
                evidenceGate: {
                  ...candidate.evidenceGate,
                  requiresMultiSourceGate: true,
                  isReadyForConfirmation: false,
                },
              }
            : {}),
        },
      ],
      edges: entries.map((source, index) => ({
        id: `edge${index}`,
        schemaVersion: 2,
        type: 'EVIDENCED_BY',
        fromId: 'a',
        toId: source.id,
        createdAt: candidate.createdAt,
        sourceKind: 'now_entry',
        verbatimQuote: '喜欢安静',
        quoteVerifiedByServer: true,
        sourceOccurredAt: new Date(source.createdAt).toISOString(),
        lastKnownSourceState: 'accessible',
      })),
    });
    return readAvatarConfirmationPreview();
  }
  it('confirms an explicit statement using one live verified original', async () => {
    const preview = await seedConfirmation();
    const graph = await confirmAvatarCognition(0, 'a', preview.token);
    expect(graph.objects[0]).toMatchObject({
      status: 'confirmed',
      evidenceGate: { independentExperienceCount: 1, requiresMultiSourceGate: false },
    });
  });
  it('commits the explicit visibility choice atomically with confirmation', async () => {
    const preview = await seedConfirmation();
    const graph = await confirmAvatarCognition(0, 'a', preview.token, undefined, false);
    expect(graph.revision).toBe(1);
    expect(graph.objects[0]).toMatchObject({ status: 'confirmed', privacy: { aiVisible: false } });
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(graph);
  });
  it('reviews a pending batch atomically and rejects stale source permissions', async () => {
    const preview = await seedConfirmation();
    await expect(reviewAvatarPendingBatch(0, preview.token, [
      { objectId: 'a', action: 'confirm', aiVisible: false },
      { objectId: 'missing', action: 'ignore' },
    ])).rejects.toThrow('仅可审核待确认候选');
    expect((await readAvatarOntology()).revision).toBe(0);
    await set(K.entries, []);
    await expect(reviewAvatarPendingBatch(0, preview.token, [
      { objectId: 'a', action: 'confirm', aiVisible: false },
    ])).rejects.toThrow('来源或权限已变化');
    expect((await readAvatarOntology()).objects[0].status).toBe('candidate');
  });
  it('does not persist visibility or confirmation when the reviewed sources change', async () => {
    const preview = await seedConfirmation();
    const before = await get(AVATAR_ONTOLOGY_KEY);
    await set(K.entries, []);
    await expect(confirmAvatarCognition(0, 'a', preview.token, undefined, true)).rejects.toThrow(
      '来源或权限已变化',
    );
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(before);
  });
  async function seedRevision() {
    const preview = await seedConfirmation();
    const graph = await confirmAvatarCognition(0, 'a', preview.token);
    graph.objects.push({
      ...graph.objects[0],
      id: 'b',
      lineageId: 'b',
      version: 1,
      statement: '需要安静与交流的平衡',
      status: 'candidate',
      confirmedAt: null,
    });
    graph.edges.push({ ...graph.edges[0], id: 'e-b', fromId: 'b' });
    await set(AVATAR_ONTOLOGY_KEY, graph);
    return readAvatarConfirmationPreview();
  }
  it('atomically confirms a revision and supersedes its predecessor', async () => {
    const preview = await seedRevision();
    const graph = await confirmAvatarCognition(1, 'b', preview.token, {
      previousObjectId: 'a',
      triggerRecordId: 'e0',
      reason: '重新审视',
    });
    expect(graph.objects[0].status).toBe('superseded');
    expect(graph.objects[1]).toMatchObject({
      status: 'confirmed',
      version: 2,
      lineageId: 'lineage',
    });
    expect(graph.edges.find((edge) => edge.type === 'SUPERSEDES')).toMatchObject({
      fromId: 'b',
      toId: 'a',
      triggerRecordId: 'e0',
    });
    expect(graph.revision).toBe(2);
    expect(getRevisionTrajectories(graph)).toHaveLength(1);
    const pending = structuredClone(graph);
    pending.objects.forEach((item) => {
      item.confirmedAt = null;
      if (item.status === 'confirmed') item.status = 'candidate';
    });
    expect(getRevisionTrajectories(pending)).toEqual([]);
    pending.objects.forEach((item) => {
      item.migration = {
        legacyIds: [item.id],
        legacyStatus: 'confirmed',
        diagnostics: [],
        legacyConfirmedAt: '2026-01-01T00:00:00.000Z',
      };
    });
    expect(getRevisionTrajectories(pending)).toHaveLength(1);
  });
  it('rejects current cognition explicitly while retaining its audit evidence and hiding its revision', async () => {
    const preview = await seedRevision();
    const confirmed = await confirmAvatarCognition(1, 'b', preview.token, {
      previousObjectId: 'a',
    });
    const review = await readAvatarConfirmationPreview();
    const rejected = await rejectAvatarCognition(confirmed.revision, 'b', review.token);
    expect(rejected.objects[1]).toMatchObject({
      status: 'rejected',
      privacy: { aiVisible: false },
      confirmedAt: confirmed.objects[1].confirmedAt,
    });
    expect(rejected.edges).toEqual(confirmed.edges);
    expect(getRevisionTrajectories(rejected)).toEqual([]);
    expect((await readAvatarOntology()).objects[1].status).toBe('rejected');
  });
  it('blocks rejection with a stale preview and preserves superseded predecessors', async () => {
    const preview = await seedRevision();
    const confirmed = await confirmAvatarCognition(1, 'b', preview.token, {
      previousObjectId: 'a',
    });
    await expect(rejectAvatarCognition(confirmed.revision, 'b', preview.token)).rejects.toThrow(
      '来源或权限已变化',
    );
    const review = await readAvatarConfirmationPreview();
    await expect(rejectAvatarCognition(confirmed.revision, 'a', review.token)).rejects.toThrow(
      '历史版本不可直接停用',
    );
    expect(await readAvatarOntology()).toEqual(confirmed);
  });
  it('does not present punctuation and whitespace edits as a change in understanding', async () => {
    const preview = await seedRevision();
    const graph = await confirmAvatarCognition(1, 'b', preview.token, { previousObjectId: 'a' });
    graph.objects[1].statement = ` ${graph.objects[0].statement}。 `;
    expect(getRevisionTrajectories(graph)).toEqual([]);
  });
  it('rejects a fabricated trigger record without committing either status', async () => {
    const preview = await seedRevision();
    await expect(
      confirmAvatarCognition(1, 'b', preview.token, {
        previousObjectId: 'a',
        triggerRecordId: 'unrelated',
      }),
    ).rejects.toThrow('修订触发记录');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('leaves the complete revision unchanged when its evidence is revoked', async () => {
    const preview = await seedRevision();
    await set(K.entries, [{ ...entry('e0'), aiVisibility: 'private' }]);
    await expect(
      confirmAvatarCognition(1, 'b', preview.token, {
        previousObjectId: 'a',
      }),
    ).rejects.toThrow('来源或权限已变化');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('requires independent sources across dates for inferred cognition', async () => {
    let preview = await seedConfirmation(true, [1]);
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('确认门槛');
    preview = await seedConfirmation(true, [1, 1]);
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('确认门槛');
    preview = await seedConfirmation(true, [1, 2]);
    expect((await confirmAvatarCognition(0, 'a', preview.token)).objects[0]).toMatchObject({
      status: 'confirmed',
      evidenceGate: { independentExperienceCount: 2, distinctDateCount: 2 },
    });
  });
  it('cannot downgrade an evidenced inference through a generic edit', async () => {
    const preview = await seedConfirmation(true, [1]);
    await expect(
      commitAvatarOntology(0, (graph) => {
        const candidate = graph.objects[0];
        candidate.domain = 'about_me';
        candidate.category = 'preferences_boundaries';
        candidate.evidenceGate.requiresMultiSourceGate = false;
        candidate.evidenceGate.independentExperienceCount = 1;
        candidate.evidenceGate.isReadyForConfirmation = true;
      }),
    ).rejects.toThrow('重新核验');
    expect(await readAvatarOntology()).toEqual(preview.graph);
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('确认门槛');
  });
  it('cannot reuse verified quotations for an edited candidate statement', async () => {
    const preview = await seedConfirmation();
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.objects[0].statement = '用户从未表达过的观点';
      }),
    ).rejects.toThrow('重新核验');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('rejects revoked source permissions after the confirmation preview', async () => {
    const preview = await seedConfirmation();
    await set(K.entries, [{ ...entry('e0'), aiVisibility: 'private' }]);
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('来源或权限已变化');
    expect((await readAvatarOntology()).objects[0].status).toBe('candidate');
  });
  it('does not trust cached accessible flags for restricted originals', async () => {
    await seedConfirmation();
    await set(K.entries, [{ ...entry('e0'), isLocked: true }]);
    const preview = await readAvatarConfirmationPreview();
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('原始证据不可访问');
  });
  it('requires server quote verification even when a matching original exists', async () => {
    await seedConfirmation();
    const graph = await get(AVATAR_ONTOLOGY_KEY);
    graph.edges[0].quoteVerifiedByServer = false;
    await set(AVATAR_ONTOLOGY_KEY, graph);
    const preview = await readAvatarConfirmationPreview();
    await expect(confirmAvatarCognition(0, 'a', preview.token)).rejects.toThrow('原始证据不可访问');
  });
  it('does not let a generic editor fabricate server-verified evidence', async () => {
    const preview = await seedConfirmation();
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.edges.push({ ...graph.edges[0], id: 'forged' });
      }),
    ).rejects.toThrow('证据核验与来源修改');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('does not let a generic editor rewrite or remove original evidence', async () => {
    const preview = await seedConfirmation();
    await expect(
      commitAvatarOntology(0, (graph) => {
        const edge = graph.edges[0];
        if (edge.type === 'EVIDENCED_BY') edge.verbatimQuote = '伪造';
      }),
    ).rejects.toThrow('证据核验与来源修改');
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.edges = [];
      }),
    ).rejects.toThrow('删除证据需要显式影响审核');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('does not let a generic editor replace the original conversation', async () => {
    const preview = await seedConfirmation();
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.sessions = [];
      }),
    ).rejects.toThrow('原始会话修改');
    expect(await readAvatarOntology()).toEqual(preview.graph);
  });
  it('cannot promote a candidate by supplying fabricated confirmation counters', async () => {
    const candidate = object('a');
    await set(AVATAR_ONTOLOGY_KEY, {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [candidate],
      edges: [],
    });
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.objects[0].status = 'confirmed';
        graph.objects[0].confirmedAt = candidate.createdAt;
        graph.objects[0].evidenceGate.distinctUserMessageCount = 1;
        graph.objects[0].evidenceGate.isReadyForConfirmation = true;
      }),
    ).rejects.toThrow('不得改写确认历史');
    expect((await readAvatarOntology()).objects[0].status).toBe('candidate');
    expect((await readAvatarOntology()).revision).toBe(0);
  });
  it('cannot insert a pre-confirmed object through the generic writer', async () => {
    await initializeAvatarOntology();
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.objects.push({
          ...object('a'),
          status: 'confirmed',
          confirmedAt: '2026-01-01T00:00:00.000Z',
          evidenceGate: {
            ...object('a').evidenceGate,
            distinctUserMessageCount: 1,
            isReadyForConfirmation: true,
          },
        } as (typeof graph.objects)[number]);
      }),
    ).rejects.toThrow('新认知必须先作为候选');
    expect((await readAvatarOntology()).objects).toEqual([]);
  });
  it('cannot edit or delete a historically confirmed viewpoint in place', async () => {
    const historical = {
      ...object('a'),
      migration: {
        legacyConfirmedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    await set(AVATAR_ONTOLOGY_KEY, {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [historical],
      edges: [],
    });
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.objects[0].statement = '改写历史';
      }),
    ).rejects.toThrow('已确认观点必须通过修订');
    await expect(
      commitAvatarOntology(0, (graph) => {
        graph.objects = [];
      }),
    ).rejects.toThrow('删除认知需要显式影响审核');
    expect((await readAvatarOntology()).objects[0].statement).toBe(historical.statement);
  });
  it('allows an ordinary candidate edit and explicit rejection', async () => {
    await set(AVATAR_ONTOLOGY_KEY, {
      ontologySchemaVersion: 2,
      revision: 0,
      objects: [object('a')],
      edges: [],
    });
    await commitAvatarOntology(0, (graph) => {
      graph.objects[0].statement = '更准确的候选';
      graph.objects[0].status = 'rejected';
    });
    expect((await readAvatarOntology()).objects[0]).toMatchObject({
      statement: '更准确的候选',
      status: 'rejected',
    });
  });
  it('rejects two unrelated objects claiming the same lineage version', () => {
    expect(() =>
      validateAvatarOntology({
        ontologySchemaVersion: 2,
        revision: 0,
        objects: [object('a'), object('b')],
        edges: [],
      }),
    ).toThrow('重复的谱系版本');
  });
  it('rejects orphan revision versions without a supersedes edge', () => {
    expect(() =>
      validateAvatarOntology({
        ontologySchemaVersion: 2,
        revision: 0,
        objects: [object('a', 2)],
        edges: [],
      }),
    ).toThrow('修订版本缺少前序关系');
  });
  it('rejects disabling the multi-source requirement on an inferred cognition', () => {
    expect(() =>
      validateAvatarOntology({
        ontologySchemaVersion: 2,
        revision: 0,
        objects: [
          { ...object('a'), domain: 'my_understanding', category: 'understanding_judgment' },
        ],
        edges: [],
      }),
    ).toThrow('证据门槛');
  });
});

describe('request-time expiry settlement', () => {
  it('archives only confirmed staged objects, preserves bytes and edges, and is idempotent', async () => {
    const expired = cognition({
      validity: {
        mode: 'staged',
        validFrom: new Date(0).toISOString(),
        validUntil: new Date(100).toISOString(),
      },
    });
    const candidate = {
      ...expired,
      id: 'candidate',
      lineageId: 'candidate',
      status: 'candidate' as const,
    };
    const permanent = cognition({ id: 'permanent', lineageId: 'permanent' });
    for (const item of [expired, permanent])
      item.evidenceGate = {
        requiresMultiSourceGate: true,
        independentExperienceCount: 2,
        distinctUserMessageCount: 0,
        distinctDateCount: 2,
        distinctSessionCount: 0,
        isReadyForConfirmation: true,
      };
    const graph = evidenceGraph([expired, candidate, permanent], []);
    await set(AVATAR_ONTOLOGY_KEY, graph);
    const settled = await settleExpiredAvatarOntology(100);
    expect(settled.objects).toEqual([
      { ...expired, status: 'archived_expired' },
      candidate,
      permanent,
    ]);
    expect(settled.edges).toEqual(graph.edges);
    expect(settled.revision).toBe(1);
    expect(await settleExpiredAvatarOntology(102)).toEqual(settled);
  });
  it('blocks settlement while locked without touching the stored graph', async () => {
    await unlock();
    await initializeAvatarOntology();
    const before = await get(AVATAR_ONTOLOGY_KEY);
    useAppStore.setState({ masterPassword: null, isUnlocked: false });
    await expect(settleExpiredAvatarOntology()).rejects.toThrow();
    expect(await get(AVATAR_ONTOLOGY_KEY)).toEqual(before);
  });
});
