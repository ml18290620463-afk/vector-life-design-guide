import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import type { DiaryEntry } from '../types';
import type { Goal, OutcomeInput } from '../types/future';
import { DiaryStorageKeys as K } from './diaryStorage';
import {
  deleteFutureAction,
  deleteGoal,
  deleteVision,
  saveArchiveDirection,
  stateFrom,
  goalProgress,
  readFutureSnapshot,
  recordActionPractice,
  recordOutcome,
  revokeProgress,
  saveFutureAction,
  saveGoal,
  saveVision,
  setGoalStatus,
} from './futureRepository';
import { commitArrayDelta, subscribeVault, vaultTransaction } from './vaultTransaction';
import { deleteSourceEntries } from './sourceDeletion';
import { exportVaultBackup, importVaultBackup } from './vaultBackup';
import { wipeVault } from './vaultWipe';
import { readStoredArray } from './diaryDataRead';
import {
  readAvatarAtomicMemories,
  readAvatarMemoryRelations,
  readAvatarUnderstandings,
  upsertAvatarMemoryRelations,
  writeAvatarAtomicMemory,
  writeAvatarUnderstanding,
} from './avatarMemory';

const entry = (id: string): DiaryEntry => ({
  id,
  title: id,
  content: `登顶${id}`,
  tags: ['事件:身体健康'],
  createdAt: 1789257600000,
  isLocked: false,
});
const mountainGoal = () =>
  saveGoal({
    title: '今年爬十座不同的山',
    status: 'active',
    tags: [],
    measurement: { kind: 'quantity', target: 10, unit: '座', precision: 0, distinctItems: true },
  });
const outcome = (goal: Goal, operationId: string, itemLabel = '黄山'): OutcomeInput => ({
  goalId: goal.id,
  expectedRevision: goal.revision,
  operationId,
  itemLabel,
  occurredOn: '2026-09-13',
  value: { kind: 'quantity', amount: 1 },
});
const total = async (goal: Goal) => goalProgress((await readFutureSnapshot()).state, goal).total;

beforeEach(async () => {
  await clear();
  localStorage.clear();
});

describe('Future atomic outcome ledger', () => {
  it('keeps independent action practice outside the goal-progress ledger', async () => {
    const action = await saveFutureAction({
      title: '整理旅行证件',
      status: 'pending',
      resultIntent: 'preparation',
      scheduledOn: '2026-09-22',
    });

    await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-09-22',
      status: 'partial',
      note: '证件已核对，签证材料明天补齐。',
      nextStep: 'continue',
    });

    const saved = await readFutureSnapshot();
    expect(saved.state.practiceRecords).toMatchObject([
      {
        actionId: action.id,
        status: 'partial',
        nextStep: 'continue',
        note: '证件已核对，签证材料明天补齐。',
      },
    ]);
    expect(saved.state.events).toEqual([]);
    expect(saved.actions).toMatchObject([
      { id: action.id, status: 'active', revision: action.revision! + 1 },
    ]);

    await expect(
      recordActionPractice({
        actionId: action.id,
        expectedActionRevision: action.revision!,
        occurredOn: '2026-09-22',
        status: 'completed',
        note: '重复写入应被拒绝',
        nextStep: 'end',
      }),
    ).rejects.toThrow('行动已更新');
  });

  it('keeps practice for a goal-linked action outside the goal-progress ledger', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '本周完成一次五公里慢跑',
      goalId: goal.id,
      status: 'pending',
      resultIntent: 'outcome',
      scheduledOn: '2026-09-22',
    });

    await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-09-22',
      status: 'completed',
      note: '完成五公里慢跑，身体感觉良好。',
      nextStep: 'end',
    });

    const saved = await readFutureSnapshot();
    expect(saved.state.events).toEqual([]);
    expect(saved.state.practiceRecords).toMatchObject([
      {
        actionId: action.id,
        status: 'completed',
        note: '完成五公里慢跑，身体感觉良好。',
      },
    ]);
    expect(saved.actions).toMatchObject([
      { id: action.id, status: 'completed', revision: action.revision! + 1 },
    ]);
    expect(goalProgress(saved.state, goal).total).toBe(0);
  });

  it('completing preparation does not create progress or a diary', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '买登山鞋',
      goalId: goal.id,
      status: 'pending',
      resultIntent: 'preparation',
    });
    await saveFutureAction({ ...action, status: 'completed' });
    expect(await total(goal)).toBe(0);
    expect(await get(K.entries)).toBeUndefined();
    expect((await readFutureSnapshot()).actions[0].status).toBe('completed');
  });

  it('retries exactly once, deduplicates mountains, corrects and revokes without losing history', async () => {
    const goal = await mountainGoal();
    const first = { ...outcome(goal, 'first'), entry: entry('huangshan') };
    const ids = await recordOutcome(first);
    expect(await recordOutcome(first)).toEqual(ids);
    await expect(recordOutcome({ ...first, itemLabel: '泰山' })).rejects.toThrow('内容已改变');
    await recordOutcome({ ...outcome(goal, 'another-diary'), entry: entry('same-mountain') });
    expect(await total(goal)).toBe(1);
    expect(await get(K.entries)).toHaveLength(2);
    const [second] = await recordOutcome(outcome(goal, 'second', '泰山'));
    expect(await total(goal)).toBe(2);
    await recordOutcome({ ...outcome(goal, 'correction'), replacesEventId: second });
    expect(await total(goal)).toBe(1);
    await revokeProgress(ids[0]);
    expect(await total(goal)).toBe(0);
    expect((await readFutureSnapshot()).state.events).toHaveLength(4);
  });

  it('aborts entries, progress, receipt and action together on a stale action revision', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '登黄山',
      goalId: goal.id,
      status: 'pending',
      resultIntent: 'outcome',
    });
    const input = {
      ...outcome(goal, 'atomic'),
      entry: entry('source'),
      actionId: action.id,
      expectedActionRevision: 0,
    };
    const before = await readFutureSnapshot();
    await expect(recordOutcome(input)).rejects.toThrow('行动已更新');
    expect(await readFutureSnapshot()).toEqual(before);
    expect(await get(K.entries)).toBeUndefined();
    await recordOutcome({ ...input, expectedActionRevision: action.revision });
    expect(await total(goal)).toBe(1);
    expect((await readFutureSnapshot()).actions[0].status).toBe('completed');
    expect(await get(K.entries)).toHaveLength(1);
  });

  it('serializes concurrent duplicate submissions and rejects stale goal edits', async () => {
    const goal = await mountainGoal();
    const input = outcome(goal, 'concurrent');
    const result = await Promise.all([recordOutcome(input), recordOutcome(input)]);
    expect(result[0]).toEqual(result[1]);
    expect(await total(goal)).toBe(1);
    const edits = await Promise.allSettled([
      saveGoal({ ...goal, title: '改名一' }),
      saveGoal({ ...goal, title: '改名二' }),
    ]);
    expect(edits.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(edits.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('commits one experience to two independently measured goals exactly once', async () => {
    const first = await mountainGoal();
    const second = await saveGoal({
      title: '探索户外生活',
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    const unrelated = await mountainGoal();
    const action = await saveFutureAction({
      title: '登黄山',
      goalId: first.id,
      status: 'pending',
      resultIntent: 'outcome',
    });
    const input: OutcomeInput = {
      ...outcome(first, 'multi'),
      entry: entry('one-source'),
      actionId: action.id,
      expectedActionRevision: action.revision,
      additionalTargets: [
        {
          goalId: second.id,
          expectedRevision: second.revision,
          value: { kind: 'narrative', note: '找到适合自己的徒步节奏' },
        },
      ],
    };
    const [left, right] = await Promise.all([recordOutcome(input), recordOutcome(input)]);
    expect(left).toEqual(right);
    expect(left).toHaveLength(2);
    expect(await get(K.entries)).toHaveLength(1);
    const saved = await readFutureSnapshot();
    expect(saved.state.receipts).toHaveLength(1);
    expect(saved.actions[0].revision).toBe((action.revision ?? 0) + 1);
    expect(goalProgress(saved.state, first).total).toBe(1);
    expect(goalProgress(saved.state, second).latest).toEqual({
      kind: 'narrative',
      note: '找到适合自己的徒步节奏',
    });
    expect(goalProgress(saved.state, unrelated).total).toBe(0);
    await revokeProgress(left[0]);
    expect(await total(first)).toBe(0);
    expect(goalProgress((await readFutureSnapshot()).state, second).latest).toEqual({
      kind: 'narrative',
      note: '找到适合自己的徒步节奏',
    });
  });

  it('rolls back the entire outcome when any additional goal is stale or invalid', async () => {
    const first = await mountainGoal();
    const second = await mountainGoal();
    const before = await readFutureSnapshot();
    const input: OutcomeInput = {
      ...outcome(first, 'multi-abort'),
      entry: entry('not-saved'),
      additionalTargets: [{ ...outcome(second, 'ignored'), expectedRevision: 0 }],
    };
    await expect(recordOutcome(input)).rejects.toThrow('目标已更新');
    expect(await readFutureSnapshot()).toEqual(before);
    expect(await get(K.entries)).toBeUndefined();
    await expect(
      recordOutcome({ ...input, additionalTargets: [outcome(first, 'ignored')] }),
    ).rejects.toThrow('同一目标');
    expect(await readFutureSnapshot()).toEqual(before);
    await recordOutcome({ ...input, additionalTargets: [outcome(second, 'ignored')] });
    expect(await total(first)).toBe(1);
    expect(await total(second)).toBe(1);
  });

  it('keeps completion snapshots immutable after reopening, target changes and revocation', async () => {
    const vision = await saveVision({ text: '亲近自然的生活', status: 'active' });
    const goal = await saveGoal({ ...(await mountainGoal()), visionId: vision.id });
    let last = '';
    for (let i = 0; i < 10; i++)
      [last] = await recordOutcome(outcome(goal, `mountain-${i}`, `山${i}`));
    expect(goalProgress((await readFutureSnapshot()).state, goal).reached).toBe(true);
    expect((await readFutureSnapshot()).state.closures).toHaveLength(0);
    await setGoalStatus(goal.id, 'completed', goal.revision);
    const closed = (await readFutureSnapshot()).state;
    expect(closed.closures[0].total).toBe(10);
    expect(closed.visions[0].status).toBe('active');
    await revokeProgress(last);
    await setGoalStatus(goal.id, 'active', closed.goals[0].revision);
    const reopened = (await readFutureSnapshot()).state.goals[0];
    await saveGoal({
      ...reopened,
      measurement: { kind: 'quantity', target: 12, unit: '座', precision: 0, distinctItems: true },
    });
    const current = (await readFutureSnapshot()).state;
    expect(current.closures).toEqual(closed.closures);
    expect(goalProgress(current, current.goals[0]).total).toBe(9);
    expect(await get(K.entries)).toBeUndefined();
    await expect(
      saveGoal({ ...current.goals[0], measurement: { kind: 'narrative' } }),
    ).rejects.toThrow('计量规则');
  });

  it('supports narrative goals and rejects private/sample source injection', async () => {
    const goal = await saveGoal({
      title: '探索适合自己的工作',
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    const input: OutcomeInput = {
      ...outcome(goal, 'note'),
      value: { kind: 'narrative', note: '尝试了志愿活动' },
    };
    await expect(
      recordOutcome({ ...input, entry: { ...entry('bad'), isSample: true } }),
    ).rejects.toThrow('真实记录');
    await recordOutcome(input);
    expect(goalProgress((await readFutureSnapshot()).state, goal)).toMatchObject({
      total: null,
      reached: false,
      latest: { kind: 'narrative', note: '尝试了志愿活动' },
    });
  });

  it('blocks plaintext future writes for password-protected vaults', async () => {
    await set(K.passwordHash, 'protected');
    await expect(mountainGoal()).rejects.toThrow('解锁资料库');
    expect((await readFutureSnapshot()).protectedVault).toBe(true);
  });
});

describe('future planning lifecycle guards', () => {
  it('does not allow an active or paused goal to be detached by ending its vision', async () => {
    const vision = await saveVision({ text: '过有创造力的生活', status: 'active' });
    const activeGoal = await saveGoal({
      title: '完成作品集',
      visionId: vision.id,
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    await expect(saveVision({ ...vision, status: 'archived' })).rejects.toThrow(
      '请先处理关联目标，再结束愿景',
    );
    await setGoalStatus(activeGoal.id, 'paused', activeGoal.revision);
    await expect(saveVision({ ...vision, status: 'archived' })).rejects.toThrow(
      '请先处理关联目标，再结束愿景',
    );
    const endedGoal = (await readFutureSnapshot()).state.goals[0];
    await setGoalStatus(endedGoal.id, 'ended', endedGoal.revision);
    await expect(saveVision({ ...vision, status: 'archived' })).resolves.toMatchObject({
      id: vision.id,
      status: 'archived',
    });
  });

  it('does not link a new goal to an ended vision', async () => {
    const vision = await saveVision({ text: '长期学习', status: 'active' });
    const ended = await saveVision({ ...vision, status: 'archived' });
    await expect(
      saveGoal({
        title: '读完十本书',
        visionId: ended.id,
        status: 'active',
        tags: [],
        measurement: { kind: 'narrative' },
      }),
    ).rejects.toThrow('不能关联已结束的愿景');
  });

  it('keeps a goal open until its pending or active actions have been handled', async () => {
    const goal = await mountainGoal();
    const pending = await saveFutureAction({
      title: '预订徒步路线',
      goalId: goal.id,
      status: 'pending',
      resultIntent: 'preparation',
    });
    await expect(setGoalStatus(goal.id, 'completed', goal.revision)).rejects.toThrow(
      '请先处理关联行动，再结束目标',
    );
    const afterRejected = (await readFutureSnapshot()).state.goals[0];
    await recordActionPractice({
      actionId: pending.id,
      expectedActionRevision: pending.revision!,
      occurredOn: '2026-09-22',
      status: 'cancelled',
      note: '天气原因取消本次徒步。',
      nextStep: 'end',
    });
    await expect(
      setGoalStatus(afterRejected.id, 'completed', afterRejected.revision),
    ).resolves.toMatchObject({ goal: { status: 'completed' } });
  });

  it('allows actions only for active goals and constrains terminal practice choices', async () => {
    const goal = await mountainGoal();
    await setGoalStatus(goal.id, 'paused', goal.revision);
    await expect(
      saveFutureAction({
        title: '暂停目标的新行动',
        goalId: goal.id,
        status: 'pending',
        resultIntent: 'outcome',
      }),
    ).rejects.toThrow('只能为进行中的目标新增行动');

    const action = await saveFutureAction({
      title: '独立行动',
      status: 'pending',
      resultIntent: 'preparation',
    });
    const base = {
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-09-22',
      note: '已处理。',
    };
    await expect(
      recordActionPractice({ ...base, status: 'completed', nextStep: 'continue' }),
    ).rejects.toThrow('已完成行动只能结束');
    await expect(
      recordActionPractice({ ...base, status: 'cancelled', nextStep: 'adjust' }),
    ).rejects.toThrow('已取消行动只能结束');
    await expect(
      recordActionPractice({ ...base, status: 'completed', nextStep: 'end' }),
    ).resolves.toMatchObject({
      actionId: action.id,
    });
  });

  it('deletes only draft plans that have no dependent records', async () => {
    const vision = await saveVision({ text: '独立愿景', status: 'active' });
    await expect(deleteVision(vision.id, vision.revision)).resolves.toBeUndefined();

    const linkedVision = await saveVision({ text: '有关联的愿景', status: 'active' });
    const goal = await saveGoal({
      title: '独立目标',
      visionId: linkedVision.id,
      status: 'active',
      tags: [],
      measurement: { kind: 'narrative' },
    });
    await expect(deleteVision(linkedVision.id, linkedVision.revision)).rejects.toThrow(
      '愿景已有关联目标，不能删除',
    );
    await expect(deleteGoal(goal.id, goal.revision)).resolves.toBeUndefined();

    const action = await saveFutureAction({
      title: '可以删除的行动',
      status: 'pending',
      resultIntent: 'preparation',
    });
    await expect(deleteFutureAction(action.id, action.revision!)).resolves.toBeUndefined();

    const practiced = await saveFutureAction({
      title: '已践行的行动',
      status: 'pending',
      resultIntent: 'preparation',
    });
    await recordActionPractice({
      actionId: practiced.id,
      expectedActionRevision: practiced.revision!,
      occurredOn: '2026-09-22',
      status: 'partial',
      note: '已开始处理。',
      nextStep: 'continue',
    });
    await expect(deleteFutureAction(practiced.id, practiced.revision! + 1)).rejects.toThrow(
      '行动已有践行或成果记录，不能删除',
    );
  });
});

describe('shared persistence and lifecycle', () => {
  it('merges unrelated concurrent rows and rejects overlapping edits', async () => {
    const before = [
      { id: 'a', value: 1 },
      { id: 'b', value: 1 },
    ];
    await set('test-rows', before);
    await Promise.all([
      commitArrayDelta('test-rows', before, [{ id: 'a', value: 2 }, before[1]]),
      commitArrayDelta('test-rows', before, [before[0], { id: 'b', value: 2 }]),
    ]);
    expect(await get('test-rows')).toEqual([
      { id: 'a', value: 2 },
      { id: 'b', value: 2 },
    ]);
    await expect(
      commitArrayDelta('test-rows', before, [{ id: 'a', value: 3 }, before[1]]),
    ).rejects.toThrow('其他页面更新');
  });

  it('a thrown observer cannot report a committed transaction as failed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = subscribeVault(() => {
      throw new Error('observer');
    });
    try {
      await expect(
        vaultTransaction(['test-key'], (v) => {
          v['test-key'] = 42;
          return 'saved';
        }),
      ).resolves.toBe('saved');
      expect(await get('test-key')).toBe(42);
    } finally {
      unsubscribe();
      log.mockRestore();
    }
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('independent deletion choices: knowledge %s / progress %s', async (knowledge, progress) => {
    const goal = await mountainGoal();
    await recordOutcome({ ...outcome(goal, 'source'), entry: entry('source') });
    await set(K.principles, [
      { id: 'derived', text: '每周走向户外', derivedFromEntryIds: ['source'] },
      { id: 'multiple', text: '多来源原则', derivedFromEntryIds: ['source', 'other'] },
      { id: 'independent', text: '独立原则' },
    ]);
    localStorage.setItem('vector:avatar:sessions:v1', '{broken');
    await deleteSourceEntries(['source'], knowledge, progress);
    expect(await get(K.entries)).toEqual([]);
    expect(await total(goal)).toBe(progress ? 1 : 0);
    const event = (await readFutureSnapshot()).state.events[0];
    expect(event.sourceEntryId).toBeUndefined();
    expect(event.sourceState).toBe('source-deleted');
    expect((await get<Array<{ id: string }>>(K.principles))?.map((p) => p.id)).toEqual(
      knowledge ? ['derived', 'multiple', 'independent'] : ['multiple', 'independent'],
    );
    expect(JSON.parse(localStorage.getItem('vector:avatar:sessions:v1')!)).toEqual([]);
  });

  it('removes every deleted-experience reference across the past, future, avatar and chat stores', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '把登山心得整理成下次的准备清单',
      status: 'pending',
      goalId: goal.id,
      sourceEntryId: 'source',
      evidenceEntryIds: ['source', 'other-entry'],
      resultEntryId: 'source',
    });
    await recordOutcome({ ...outcome(goal, 'linked-source'), entry: entry('source') });
    await set(K.principles, [
      { id: 'source-principle', text: '先做准备再出发', derivedFromEntryIds: ['source'] },
    ]);
    await set(K.patternPrincipleLinks, [
      {
        id: 'source-link',
        patternId: 'source-pattern',
        principleId: 'source-principle',
        createdBy: 'user',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    writeAvatarUnderstanding({
      id: 'source-pattern',
      statement: '复杂任务开始前会先准备',
      status: 'confirmed',
      sourceEntryIds: ['source'],
      createdAt: 1,
      confirmedAt: 1,
    });
    writeAvatarAtomicMemory({
      id: 'source-memory',
      statement: '登山后会把经验整理成清单',
      nature: 'experience',
      facets: ['habit'],
      tags: [],
      contexts: [],
      sourceRefs: [{ source: 'entry', id: 'source' }],
      confidence: 0.8,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 1,
      confirmedAt: 1,
    });
    writeAvatarAtomicMemory({
      id: 'independent-memory',
      statement: '独立保存的偏好',
      nature: 'explicit',
      facets: ['preference'],
      tags: [],
      contexts: [],
      sourceRefs: [],
      confidence: 0.8,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 2,
      confirmedAt: 2,
    });
    upsertAvatarMemoryRelations([
      {
        id: 'source-relation',
        fromId: 'source-memory',
        toId: 'independent-memory',
        kind: 'supports',
        confidence: 0.8,
        sourceRefs: [{ source: 'entry', id: 'source' }],
        createdAt: 1,
      },
    ]);
    localStorage.setItem(
      'vector:avatar:sessions:v1',
      JSON.stringify([
        { id: 'source-session', messages: [{ id: 'message', sourceEntryId: 'source' }] },
        { id: 'independent-session', messages: [{ id: 'message-2', text: '保留' }] },
      ]),
    );

    await deleteSourceEntries(['source'], false, false);

    expect(await get(K.entries)).toEqual([]);
    expect(readAvatarUnderstandings()).toEqual([]);
    expect(readAvatarAtomicMemories().map((memory) => memory.id)).toEqual(['independent-memory']);
    expect(readAvatarMemoryRelations()).toEqual([]);
    expect(await get(K.principles)).toEqual([]);
    expect(await get(K.patternPrincipleLinks)).toEqual([]);
    expect(JSON.parse(localStorage.getItem('vector:avatar:sessions:v1')!)).toEqual([
      { id: 'independent-session', messages: [{ id: 'message-2', text: '保留' }] },
    ]);

    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.events[0]).toMatchObject({
      sourceState: 'source-deleted',
      status: 'revoked',
    });
    expect(snapshot.state.events[0].sourceEntryId).toBeUndefined();
    expect(snapshot.actions).toEqual([
      expect.objectContaining({
        id: action.id,
        sourceEntryId: undefined,
        resultEntryId: undefined,
        evidenceEntryIds: ['other-entry'],
      }),
    ]);
  });

  it('roundtrips backup v2, allows identical reimport and aborts conflicting IDs', async () => {
    const goal = await mountainGoal();
    await recordOutcome({ ...outcome(goal, 'backup'), entry: entry('source') });
    const backup = await exportVaultBackup('test');
    await wipeVault();
    expect((await readFutureSnapshot()).state.goals).toEqual([]);
    expect(await get(K.initializedFlag)).toBe(true);
    await importVaultBackup(backup);
    await importVaultBackup(backup);
    expect(await total(goal)).toBe(1);
    expect(await get(K.entries)).toHaveLength(1);
    const before = await exportVaultBackup('test');
    const conflict = structuredClone(backup);
    conflict.vault.future.goals[0].title = '冲突';
    await expect(importVaultBackup(conflict)).rejects.toThrow('编号冲突');
    const after = await exportVaultBackup('test');
    expect(after.vault).toEqual(before.vault);
    expect(after.entries).toEqual(before.entries);
  });

  it('preserves local-only legacy data, treats IDB empty as authoritative and rejects corruption', async () => {
    localStorage.setItem(K.entries, JSON.stringify([entry('legacy')]));
    expect((await exportVaultBackup('test')).entries).toHaveLength(1);
    expect(await readStoredArray(K.entries)).toHaveLength(1);
    await set(K.entries, []);
    expect((await exportVaultBackup('test')).entries).toEqual([]);
    await set(K.entries, { bad: true });
    await expect(exportVaultBackup('test')).rejects.toThrow('格式无效');
    await expect(readStoredArray(K.entries)).rejects.toThrow('格式无效');
  });
});

describe('archive canonical direction writes', () => {
  it('commits one canonical action and origin, retries once, and preserves it through backup', async () => {
    const input = {
      proposalId: 'memory-1',
      kind: 'action' as const,
      text: '今晚散步',
      tags: [],
      sourceRefs: [{ source: 'message' as const, id: 'chat-1' }],
    };
    const result = await saveArchiveDirection(input);
    expect(await saveArchiveDirection(input)).toEqual(result);
    await expect(saveArchiveDirection({ ...input, text: '改了内容' })).rejects.toThrow(
      '内容已改变',
    );
    const snapshot = await readFutureSnapshot();
    expect(snapshot.actions).toHaveLength(1);
    expect(snapshot.actions[0].id).toBe(result.id);
    expect(
      stateFrom(JSON.parse(JSON.stringify(snapshot.state))).archiveOrigins?.['memory-1'],
    ).toEqual(result);
    const backup = await exportVaultBackup('archive-origins');
    await clear();
    await importVaultBackup(backup);
    expect((await readFutureSnapshot()).state.archiveOrigins?.['memory-1']).toEqual(result);
    await saveFutureAction({ ...snapshot.actions[0], title: '明晚散步' });
    expect((await readFutureSnapshot()).actions[0].title).toBe('明晚散步');
    // Equal text from an independent explicit proposal is never silently merged.
    await saveArchiveDirection({ ...input, proposalId: 'memory-2' });
    expect((await readFutureSnapshot()).actions).toHaveLength(2);
  });
  it('validates origin metadata before accepting imported data', async () => {
    const { state } = await readFutureSnapshot();
    expect(() =>
      stateFrom({
        ...state,
        archiveOrigins: { bad: { kind: 'goal', id: 'g', sourceRefs: [null] } },
      }),
    ).toThrow('数据结构');
  });
  it('records a status-only completion without requiring a note', async () => {
    const action = await saveFutureAction({
      title: '整理材料',
      status: 'pending',
      resultIntent: 'preparation',
    });
    await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-10-08',
      note: '',
      status: 'completed',
      nextStep: 'end',
    });
    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.practiceRecords.at(-1)?.note).toBe('');
    expect(snapshot.actions.find((item) => item.id === action.id)?.status).toBe('completed');
  });
});

it('saves a concrete adjustment atomically and preserves previous action wording', async () => {
  const action = await saveFutureAction({ title: '整理所有材料', status: 'pending' });
  const input = {
    actionId: action.id,
    expectedActionRevision: action.revision!,
    occurredOn: '2026-10-09',
    status: 'not_completed' as const,
    note: '范围太大',
    nextStep: 'adjust' as const,
  };
  const before = await readFutureSnapshot();
  await expect(recordActionPractice({ ...input, nextAction: '  ' })).rejects.toThrow(
    '调整后的行动',
  );
  expect(await readFutureSnapshot()).toEqual(before);
  const first = await recordActionPractice({ ...input, nextAction: ' 明天先核对一份材料 ' });
  const adjusted = await readFutureSnapshot();
  expect(first).toMatchObject({ actionTitle: '整理所有材料', nextAction: '明天先核对一份材料' });
  expect(adjusted.actions[0]).toMatchObject({
    title: '明天先核对一份材料',
    status: 'active',
    revision: action.revision! + 1,
  });
  await expect(recordActionPractice({ ...input, nextAction: '过期覆盖' })).rejects.toThrow(
    '行动已更新',
  );
  await recordActionPractice({
    ...input,
    expectedActionRevision: adjusted.actions[0].revision!,
    status: 'completed',
    nextStep: 'end',
    note: '已核对',
  });
  const done = await readFutureSnapshot();
  expect(done.actions[0].status).toBe('completed');
  expect(done.state.practiceRecords).toHaveLength(2);
  expect(done.state.practiceRecords?.find((r) => r.id === first.id)).toEqual(first);
  expect(done.state.events).toEqual([]);
});
