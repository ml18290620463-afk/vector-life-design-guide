import { beforeEach, expect, it } from 'vitest';
import { clear } from 'idb-keyval';
import { buildGuidanceSources } from './avatarGuidance';
import { projectGoalToAvatarMemory, resolveAvatarKnowledge } from './avatarKnowledgeProjection';
import {
  saveGoal,
  saveVision,
  saveFutureAction,
  readFutureSnapshot,
  setGoalStatus,
} from './futureRepository';
import {
  readAvatarAtomicMemories,
  readAvatarUnderstandings,
  writeAvatarUnderstanding,
  invalidateAvatarEvidence,
  pruneAvatarUnderstandingsByEntryIds,
} from './avatarMemory';
import { exportVaultBackup, importVaultBackup, validateVaultBackup } from './vaultBackup';

beforeEach(async () => {
  await clear();
  localStorage.clear();
});

it('uses current sources after edits, goal completion, archiving, abandoning and unlinking', async () => {
  const vision = await saveVision({ text: '自然', status: 'active' });
  const goal = await saveGoal({
    title: '登山',
    status: 'active',
    visionId: vision.id,
    tags: [],
    measurement: { kind: 'narrative' },
  });
  const action = await saveFutureAction({ title: '准备', status: 'pending', goalId: goal.id });
  const stale = projectGoalToAvatarMemory(goal);
  expect(readAvatarAtomicMemories()).toEqual([]);
  let snapshot = await readFutureSnapshot();
  let view = resolveAvatarKnowledge({
    memories: stale,
    principles: [],
    actions: snapshot.actions,
    future: snapshot.state,
  });
  expect(view.relations).toHaveLength(2);
  expect(
    buildGuidanceSources({
      entries: [],
      patterns: [],
      principles: [],
      actions: snapshot.actions,
      future: snapshot.state,
      avatarMemories: view.memories,
    }).filter((s) => s.text.includes('登山')),
  ).toHaveLength(1);
  // A goal cannot be closed while it still has an unfinished action.  This is
  // the same closure order the future workspace presents to a user: first
  // record the action outcome, then close the goal and archive its vision.
  await saveFutureAction({ ...action, status: 'abandoned' });
  await setGoalStatus(goal.id, 'completed', goal.revision);
  await saveVision({ ...vision, status: 'archived' });
  snapshot = await readFutureSnapshot();
  view = resolveAvatarKnowledge({
    memories: stale,
    principles: [],
    actions: snapshot.actions,
    future: snapshot.state,
    relations: view.relations,
  });
  expect(view.memories).toHaveLength(1);
  expect(view.memories[0].statement).toContain('已完成');
  expect(view.relations).toEqual([]);
  expect(
    buildGuidanceSources({
      entries: [],
      patterns: [],
      principles: [],
      actions: snapshot.actions,
      future: snapshot.state,
      avatarMemories: view.memories,
    }),
  ).toEqual([]);
  expect(
    resolveAvatarKnowledge({
      memories: stale,
      principles: [],
      actions: [],
      future: { ...snapshot.state, goals: [] },
    }).memories,
  ).toEqual([]);
});

it('invalidates interpretations when their evidence changes, requiring confirmation again', () => {
  writeAvatarUnderstanding({
    id: 'p',
    statement: '习惯推迟',
    status: 'confirmed',
    sourceEntryIds: ['entry'],
    createdAt: 1,
    confirmedAt: 2,
  });
  invalidateAvatarEvidence('entry');
  expect(readAvatarUnderstandings()[0]).toMatchObject({ status: 'pending' });
  expect(readAvatarUnderstandings()[0].confirmedAt).toBeUndefined();
  expect(
    resolveAvatarKnowledge({
      memories: [],
      principles: [],
      actions: [],
      patterns: readAvatarUnderstandings(),
    }).memories,
  ).toEqual([]);
});

it('roundtrips independent memories, relations and name-keyed tags; accepts old v2 backups', async () => {
  const payloads = {
    'vector:avatar:atomic-memories:v1': [
      { id: 'm1', statement: '偏好', status: 'confirmed' },
      { id: 'm2', statement: '背景', status: 'retained' },
    ],
    'vector:avatar:memory-relations:v1': [{ id: 'r1', fromId: 'm1', toId: 'm2', kind: 'supports' }],
    'vector:avatar:memory-tags:v1': [{ name: '工作', aliases: ['事业'], status: 'active' }],
  };
  for (const [key, value] of Object.entries(payloads))
    localStorage.setItem(key, JSON.stringify(value));
  const backup = await exportVaultBackup('test');
  expect(backup.schemaVersion).toBe(3);
  localStorage.clear();
  await importVaultBackup(backup, 'replace');
  await importVaultBackup(backup);
  for (const [key, value] of Object.entries(payloads))
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(value);
  const old = structuredClone(backup);
  old.schemaVersion = 2;
  for (const key of Object.keys(payloads)) delete old.vault.caches[key];
  expect(() => validateVaultBackup(old)).not.toThrow();
  await importVaultBackup(old);
  expect(JSON.parse(localStorage.getItem('vector:avatar:memory-tags:v1')!)).toEqual(
    payloads['vector:avatar:memory-tags:v1'],
  );
  const invalid = structuredClone(backup);
  delete invalid.vault.caches['vector:avatar:atomic-memories:v1'];
  expect(() => validateVaultBackup(invalid)).toThrow();
});

it('reflects source edits without copies, links evidence, and excludes protected entries', () => {
  const entry = {
    id: 'e',
    title: '记录',
    content: '旧内容',
    tags: ['工作'],
    createdAt: 1,
    isLocked: false,
  };
  const principle = {
    id: 'p',
    text: '先确认范围',
    year: 2026,
    createdAt: 2,
    showOnHome: false,
    derivedFromEntryIds: ['e'],
  };
  const input = { memories: [], actions: [], principles: [principle], entries: [entry] };
  const before = resolveAvatarKnowledge(input);
  expect(before.relations).toHaveLength(1);
  const after = resolveAvatarKnowledge({
    ...input,
    memories: before.memories,
    entries: [{ ...entry, content: '修改后的内容' }],
    principles: [{ ...principle, text: '及时沟通' }],
  });
  expect(after.memories).toHaveLength(2);
  expect(after.memories.some((m) => m.statement.includes('旧内容'))).toBe(false);
  expect(after.memories.some((m) => m.statement.includes('及时沟通'))).toBe(true);
  const protectedView = resolveAvatarKnowledge({
    ...input,
    memories: before.memories,
    entries: [{ ...entry, isLocked: true }],
  });
  expect(protectedView.memories).toHaveLength(1);
  expect(protectedView.relations).toEqual([]);
  expect(readAvatarAtomicMemories()).toEqual([]);
});


it('keeps a user-retained pattern visible after deleting its only experience, and removes it when not retained', () => {
  const pattern = {
    id: 'source-owned-pattern',
    statement: '复杂选择前先留出独处时间',
    status: 'confirmed' as const,
    sourceEntryIds: ['deleted-entry'],
    createdAt: 1,
    confirmedAt: 1,
    patternDomain: 'cognitive' as const,
  };
  expect(writeAvatarUnderstanding(pattern)).toBe(true);
  pruneAvatarUnderstandingsByEntryIds(['deleted-entry'], true);
  const retained = readAvatarUnderstandings();
  expect(retained).toHaveLength(1);
  expect(retained[0]).toMatchObject({
    sourceEntryIds: [],
    retainedAfterSourceDeletion: true,
  });
  expect(
    resolveAvatarKnowledge({
      memories: [],
      principles: [],
      actions: [],
      patterns: retained,
    }).memories,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        statement: pattern.statement,
        retainedAfterSourceDeletion: true,
        sourceRefs: [expect.objectContaining({ source: 'pattern' })],
      }),
    ]),
  );

  localStorage.clear();
  expect(writeAvatarUnderstanding(pattern)).toBe(true);
  pruneAvatarUnderstandingsByEntryIds(['deleted-entry'], false);
  expect(readAvatarUnderstandings()).toEqual([]);
  expect(
    resolveAvatarKnowledge({
      memories: [],
      principles: [],
      actions: [],
      patterns: readAvatarUnderstandings(),
    }).memories,
  ).toEqual([]);
});
