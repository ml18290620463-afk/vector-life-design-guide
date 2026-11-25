import { beforeEach, expect, it } from 'vitest';
import { clear, get } from 'idb-keyval';
import { useAppStore } from '../stores/appStore';
import type { DiaryEntry } from '../types';
import { cognition, evidenceGraph } from '../tests/fixtures/avatarOntology';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { decodeAvatarMigrationCheckpoint } from './avatarOntologyMigrationCheckpoint';
import { buildGuidanceSources } from './avatarGuidance';
import {
  saveGoal,
  saveVision,
  saveFutureAction,
  readFutureSnapshot,
  setGoalStatus,
} from './futureRepository';
import {
  exportVaultBackup,
  exportVaultBackupFile,
  importVaultBackup,
  validateVaultBackup,
} from './vaultBackup';
import { decryptVaultBackupFile, isEncryptedVaultBackup } from './vaultBackupFile';
import { deleteOntologySources } from './avatarOntologySourceDeletion';

beforeEach(async () => {
  await clear();
  localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
});

const entries: DiaryEntry[] = [1, 2].map((n) => ({
  id: `entry-${n}`,
  title: '记录',
  content: `独处之后更容易思考${n}`,
  createdAt: n * 86400000,
  tags: ['工作'],
  isLocked: false,
  aiVisibility: 'allowed',
}));

it('reads authoritative Future lifecycle without creating cognitive copies', async () => {
  const graph = evidenceGraph([], []);
  const original = structuredClone(graph);
  const vision = await saveVision({ aiVisibility: 'allowed', text: '自然', status: 'active' });
  const goal = await saveGoal({
    aiVisibility: 'allowed',
    title: '登山',
    status: 'active',
    visionId: vision.id,
    tags: [],
    measurement: { kind: 'narrative' },
  });
  const action = await saveFutureAction({
    aiVisibility: 'allowed',
    title: '准备',
    status: 'pending',
    goalId: goal.id,
  });
  let snapshot = await readFutureSnapshot();
  const sources = () =>
    buildGuidanceSources({
      entries: [],
      principles: [],
      actions: snapshot.actions,
      future: snapshot.state,
      graph,
    });
  expect(sources().filter((s) => s.text.includes('登山'))).toHaveLength(1);
  await saveFutureAction({ ...action, status: 'abandoned' });
  await setGoalStatus(goal.id, 'completed', goal.revision);
  await saveVision({ ...vision, status: 'archived' });
  snapshot = await readFutureSnapshot();
  expect(sources()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: '背景',
        status: 'archived',
        detail: expect.stringContaining('不作为当前义务'),
      }),
      expect.objectContaining({
        kind: '背景',
        status: 'completed',
        detail: expect.stringContaining('不作为当前义务'),
      }),
    ]),
  );
  snapshot = { ...snapshot, actions: [], state: { ...snapshot.state, goals: [] } };
  expect(sources().some((s) => s.text.includes('登山'))).toBe(false);
  expect(graph).toEqual(original);
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
});

it('excludes a previously confirmed inference after its original quote changes', () => {
  const graph = evidenceGraph([cognition()], entries);
  const original = structuredClone(graph);
  const sources = (live: DiaryEntry[]) =>
    buildGuidanceSources({ entries: live, principles: [], actions: [], graph });
  expect(sources(entries).some((s) => s.text.includes('行动前会准备'))).toBe(true);
  expect(
    sources([{ ...entries[0], content: '原文已修改' }, entries[1]]).some((s) =>
      s.text.includes('行动前会准备'),
    ),
  ).toBe(false);
  expect(graph).toEqual(original);
});

it.each(['private', 'locked', 'deleted'] as const)(
  'rechecks %s source access for cognition and derived principles',
  (restriction) => {
    const graph = evidenceGraph([cognition()], entries);
    const principle = {
      id: 'principle',
      text: '先确认范围',
      year: 2026,
      createdAt: 2,
      showOnHome: false,
      aiVisibility: 'allowed' as const,
      derivedFromEntryIds: [entries[0].id],
    };
    const sources = (live: DiaryEntry[]) =>
      buildGuidanceSources({ entries: live, principles: [principle], actions: [], graph });
    expect(sources(entries).some((s) => s.text.includes(principle.text))).toBe(true);
    const live =
      restriction === 'deleted'
        ? [entries[1]]
        : [
            {
              ...entries[0],
              ...(restriction === 'private'
                ? { aiVisibility: 'private' as const }
                : { isLocked: true }),
            },
            entries[1],
          ];
    expect(
      sources(live).some((s) => s.text.includes(principle.text) || s.text.includes('行动前会准备')),
    ).toBe(false);
  },
);

it.each([true, false])(
  'honors explicit source-deletion retain=%s without preserving AI evidence',
  (retain) => {
    const graph = evidenceGraph(
      [
        cognition({
          evidenceGate: {
            requiresMultiSourceGate: true,
            independentExperienceCount: 2,
            distinctUserMessageCount: 0,
            distinctDateCount: 2,
            distinctSessionCount: 0,
            isReadyForConfirmation: true,
          },
        }),
      ],
      entries,
    );
    const values = { [AVATAR_ONTOLOGY_KEY]: graph };
    deleteOntologySources(values, [entries[0].id], retain);
    expect(graph.objects).toHaveLength(retain ? 1 : 0);
    if (retain)
      expect(graph.objects[0]).toMatchObject({
        status: 'retained_after_source_delete',
        privacy: { aiVisible: false, traceabilityDegraded: true },
      });
    expect(graph.edges.some((e) => e.toId === entries[0].id)).toBe(false);
    expect(
      buildGuidanceSources({ entries: [entries[1]], principles: [], actions: [], graph }).some(
        (s) => s.text.includes('行动前会准备'),
      ),
    ).toBe(false);
  },
);

it('preserves legacy backup bytes behind encryption without restoring dual-track caches', async () => {
  const payloads = {
    'vector:avatar:atomic-memories:v1': [
      { id: 'm1', statement: '偏好', status: 'confirmed' },
      { id: 'm2', statement: '背景', status: 'retained' },
    ],
    'vector:avatar:memory-relations:v1': [{ id: 'r1', fromId: 'm1', toId: 'm2', kind: 'supports' }],
    'vector:avatar:memory-tags:v1': [{ name: '工作', aliases: ['事业'], status: 'active' }],
  };
  const backup = await exportVaultBackup('test');
  backup.schemaVersion = 2;
  Object.assign(backup.vault.caches, payloads);
  const original = structuredClone(backup);
  expect(() => validateVaultBackup(backup)).not.toThrow();
  await expect(importVaultBackup(backup, 'replace')).rejects.toThrow();
  expect(await get(AVATAR_ONTOLOGY_KEY)).toBeUndefined();
  expect(backup).toEqual(original);

  const password = 'legacy-linkage-backup-123';
  await importVaultBackup(backup, 'replace', undefined, password);
  expect((await get(AVATAR_ONTOLOGY_KEY)).format).toBe('vector-private-v1');
  const envelope = await exportVaultBackupFile('test');
  expect(isEncryptedVaultBackup(envelope)).toBe(true);
  if (!isEncryptedVaultBackup(envelope)) throw new Error('Expected encrypted backup');
  const exported = await decryptVaultBackupFile(envelope, password);
  validateVaultBackup(exported);
  expect(exported.schemaVersion).toBe(3);
  expect(exported.vault.ontology?.ontologySchemaVersion).toBe(2);
  expect(exported.vault.ontology?.migrationCheckpointRequired).toBe(true);
  for (const key of Object.keys(payloads)) {
    expect(localStorage.getItem(key)).toBeNull();
    expect(exported.vault.caches).not.toHaveProperty(key);
  }
  const checkpoint = exported.vault.migrationCheckpoint!;
  expect(JSON.stringify(checkpoint)).not.toContain('偏好');
  const decoded = await decodeAvatarMigrationCheckpoint(checkpoint, password);
  expect(JSON.parse(decoded.snapshot.raw.atoms!)).toEqual(
    payloads['vector:avatar:atomic-memories:v1'],
  );
  expect(JSON.parse(decoded.snapshot.raw.relations!)).toEqual(
    payloads['vector:avatar:memory-relations:v1'],
  );
  expect(JSON.parse(decoded.snapshot.raw.tags!)).toEqual(payloads['vector:avatar:memory-tags:v1']);
  expect(exported.vault.ontology?.objects.every((object) => object.status !== 'confirmed')).toBe(
    true,
  );
  await expect(importVaultBackup(exported, 'replace')).rejects.toThrow(
    '恢复迁移归档需要来源密码及目标密钥',
  );
  await importVaultBackup(exported, 'replace', undefined, password);
  expect(backup).toEqual(original);
  for (const key of Object.keys(payloads)) expect(localStorage.getItem(key)).toBeNull();
}, 30000);
