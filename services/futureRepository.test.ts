import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import type { DiaryEntry, Principle } from '../types';
import type { Goal, OutcomeInput } from '../types/future';
import { DiaryStorageKeys as K } from './diaryStorage';
import {
  deleteFutureAction,
  deleteFutureActions,
  deleteActionPractice,
  deleteGoalFeedback,
  deleteProgress,
  deleteGoal,
  deleteVision,
  saveArchiveDirection,
  stateFrom,
  goalProgress,
  readFutureSnapshot,
  recordActionPractice,
  recordGoalFeedback,
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
const principle = (id = 'principle-1'): Principle => ({
  id,
  text: '重要沟通前先定义目标',
  year: 2026,
  createdAt: 1,
  showOnHome: true,
});

beforeEach(async () => {
  await clear();
  localStorage.clear();
});

describe('Future atomic outcome ledger', () => {
  it('atomically connects an explicit practice judgment to its linked principle', async () => {
    await set(K.principles, [principle()]);
    const action = await saveFutureAction({
      title: '在客户会前写下决策目标',
      status: 'pending',
      resultIntent: 'preparation',
      principleId: 'principle-1',
    });

    const record = await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-10-09',
      status: 'completed',
      note: '先写清目标后，会议聚焦且推进顺利。',
      nextStep: 'end',
      principleFeedback: { principleId: 'principle-1', outcome: 'helpful' },
    });

    expect(record.principleFeedback).toEqual({
      principleId: 'principle-1',
      principleText: '重要沟通前先定义目标',
      outcome: 'helpful',
    });
    const saved = (await get<Principle[]>(K.principles))![0];
    expect(saved).toMatchObject({
      derivedFromPracticeIds: [record.id],
      appliedFeedbackPracticeIds: [record.id],
      helpfulCount: 1,
      recallCount: 1,
      confidence: 0.62,
    });
  });

  it('keeps an unrelated practice judgment as context without changing the principle evidence', async () => {
    await set(K.principles, [principle()]);
    const action = await saveFutureAction({
      title: '尝试新的会前准备',
      status: 'pending',
      resultIntent: 'preparation',
      principleId: 'principle-1',
    });

    const record = await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision!,
      occurredOn: '2026-10-09',
      status: 'completed',
      note: '这次结果主要受外部时间限制影响。',
      nextStep: 'end',
      principleFeedback: { principleId: 'principle-1', outcome: 'unrelated' },
    });

    expect(record.principleFeedback?.outcome).toBe('unrelated');
    expect((await get<Principle[]>(K.principles))![0]).toMatchObject({
      id: 'principle-1',
      confidence: 0.5,
      recallCount: 0,
      helpfulCount: 0,
      partialCount: 0,
      unhelpfulCount: 0,
      appliedFeedbackPracticeIds: undefined,
      derivedFromPracticeIds: undefined,
    });
  });

  it('rejects a practice judgment for a principle other than the action link without writing', async () => {
    await set(K.principles, [principle(), principle('principle-2')]);
    const action = await saveFutureAction({
      title: '准备会议议程',
      status: 'pending',
      resultIntent: 'preparation',
      principleId: 'principle-1',
    });
    const before = await readFutureSnapshot();

    await expect(
      recordActionPractice({
        actionId: action.id,
        expectedActionRevision: action.revision!,
        occurredOn: '2026-10-09',
        status: 'completed',
        note: '完成准备。',
        nextStep: 'end',
        principleFeedback: { principleId: 'principle-2', outcome: 'helpful' },
      }),
    ).rejects.toThrow('原则关联已更新');

    expect(await readFutureSnapshot()).toEqual(before);
    expect(
      (await get<Principle[]>(K.principles))!.map(({ id, appliedFeedbackPracticeIds }) => ({
        id,
        appliedFeedbackPracticeIds,
      })),
    ).toEqual([
      { id: 'principle-1', appliedFeedbackPracticeIds: undefined },
      { id: 'principle-2', appliedFeedbackPracticeIds: undefined },
    ]);
  });

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

  it('cascades deletion through every dependent future record', async () => {
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
    await expect(deleteVision(linkedVision.id, linkedVision.revision)).resolves.toBeUndefined();
    expect((await readFutureSnapshot()).state.goals).not.toContainEqual(
      expect.objectContaining({ id: goal.id }),
    );

    const action = await saveFutureAction({
      title: '可以删除的行动',
      status: 'pending',
      resultIntent: 'preparation',
    });
    await expect(deleteFutureAction(action.id, action.revision!)).resolves.toBeUndefined();

    const batchOne = await saveFutureAction({
      title: '批量删除一',
      status: 'pending',
      resultIntent: 'preparation',
    });
    const batchTwo = await saveFutureAction({
      title: '批量删除二',
      status: 'pending',
      resultIntent: 'preparation',
    });
    await expect(
      deleteFutureActions([
        { id: batchOne.id, revision: batchOne.revision },
        { id: batchTwo.id, revision: batchTwo.revision },
      ]),
    ).resolves.toBeUndefined();

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
    await expect(deleteFutureAction(practiced.id, practiced.revision! + 1)).resolves.toBeUndefined();
    expect((await readFutureSnapshot()).state.practiceRecords).toEqual([]);
  });
});

describe('future deletion dependencies', () => {
  it('deletes one action feedback, its coupled goal feedback, and its principle impact while retaining the action', async () => {
    await set(K.principles, [principle()]);
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '检查登山装备',
      goalId: goal.id,
      status: 'pending',
      principleId: 'principle-1',
      resultIntent: 'preparation',
    });
    const practice = await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision ?? 0,
      occurredOn: '2026-10-14',
      status: 'partial',
      note: '确认了装备清单。',
      nextStep: 'continue',
      principleFeedback: { principleId: 'principle-1', outcome: 'helpful' },
      goalFeedback: {
        goalId: goal.id,
        expectedGoalRevision: goal.revision,
        decision: 'continue',
        note: '装备准备按计划推进。',
      },
    });

    await deleteActionPractice(practice.id);

    const after = await readFutureSnapshot();
    expect(after.actions).toContainEqual(expect.objectContaining({ id: action.id }));
    expect(after.state.practiceRecords).toEqual([]);
    expect(after.state.goalFeedbackRecords).toEqual([]);
    expect((await get<Principle[]>(K.principles))![0]).toMatchObject({
      recallCount: 0,
      helpfulCount: 0,
      confidence: 0.5,
      appliedFeedbackPracticeIds: [],
      derivedFromPracticeIds: [],
    });
  });

  it('deletes one goal feedback and clears its action-feedback reference without deleting either plan', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '预订登山交通',
      goalId: goal.id,
      status: 'pending',
      resultIntent: 'preparation',
    });
    const practice = await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision ?? 0,
      occurredOn: '2026-10-14',
      status: 'partial',
      note: '已比较出行方案。',
      nextStep: 'continue',
      goalFeedback: {
        goalId: goal.id,
        expectedGoalRevision: goal.revision,
        decision: 'continue',
        note: '继续按当前节奏推进。',
      },
    });
    const goalFeedbackId = practice.goalFeedbackId!;

    await deleteGoalFeedback(goalFeedbackId);

    const after = await readFutureSnapshot();
    expect(after.state.goals).toContainEqual(expect.objectContaining({ id: goal.id }));
    expect(after.actions).toContainEqual(expect.objectContaining({ id: action.id }));
    expect(after.state.goalFeedbackRecords).toEqual([]);
    expect(after.state.practiceRecords).toContainEqual(
      expect.objectContaining({ id: practice.id, goalFeedbackId: undefined }),
    );
  });

  it('deletes one confirmed progress event and removes its unused receipt, item, and closure reference', async () => {
    const goal = await mountainGoal();
    const [eventId] = await recordOutcome(outcome(goal, 'delete-one-outcome'));
    const currentGoal = (await readFutureSnapshot()).state.goals.find((item) => item.id === goal.id)!;
    await setGoalStatus(currentGoal.id, 'completed', currentGoal.revision);

    await deleteProgress(eventId);

    const after = await readFutureSnapshot();
    expect(after.state.events).toEqual([]);
    expect(after.state.receipts).toEqual([]);
    expect(after.state.items).toEqual([]);
    expect(after.state.closures).toHaveLength(1);
    expect(after.state.closures[0].progressEventIds).toEqual([]);
  });

  it('removes an action, its practice feedback, outcomes, receipt, item, and principle impact', async () => {
    await set(K.principles, [principle()]);
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '完成黄山路线',
      goalId: goal.id,
      status: 'pending',
      principleId: 'principle-1',
      resultIntent: 'outcome',
    });
    const practice = await recordActionPractice({
      actionId: action.id,
      expectedActionRevision: action.revision ?? 0,
      occurredOn: '2026-10-14',
      status: 'partial',
      note: '已确认交通和线路。',
      nextStep: 'continue',
      principleFeedback: { principleId: 'principle-1', outcome: 'helpful' },
    });
    const currentAction = (await readFutureSnapshot()).actions.find((item) => item.id === action.id)!;
    await recordOutcome({
      ...outcome(goal, 'remove-action-outcome'),
      actionId: action.id,
      expectedActionRevision: currentAction.revision,
      actionStatus: 'completed',
    });

    const before = await readFutureSnapshot();
    const removable = before.actions.find((item) => item.id === action.id)!;
    await deleteFutureAction(removable.id, removable.revision ?? 0);

    const after = await readFutureSnapshot();
    expect(after.actions).not.toContainEqual(expect.objectContaining({ id: action.id }));
    expect(after.state.practiceRecords).not.toContainEqual(expect.objectContaining({ id: practice.id }));
    expect(after.state.events).toEqual([]);
    expect(after.state.receipts).toEqual([]);
    expect(after.state.items).toEqual([]);
    const updatedPrinciple = (await get<Principle[]>(K.principles))![0];
    expect(updatedPrinciple).toMatchObject({ recallCount: 0, helpfulCount: 0 });
    expect(updatedPrinciple.appliedFeedbackPracticeIds).not.toContain(practice.id);
    expect(updatedPrinciple.derivedFromPracticeIds).not.toContain(practice.id);
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

describe('Goal feedback boundaries', () => {
  it('records a goal direction without changing past entries, action feedback, or progress events', async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({
      title: '确认登山路线',
      goalId: goal.id,
      status: 'pending',
    });
    const originalEntries = [entry('past-source')];
    await set(K.entries, originalEntries);

    const record = await recordGoalFeedback({
      goalId: goal.id,
      expectedGoalRevision: goal.revision,
      decision: 'pause',
      note: '本月需要先处理家庭安排。',
      nextStep: '下月重新评估',
      occurredOn: '2026-10-14',
    });

    const snapshot = await readFutureSnapshot();
    expect(record).toMatchObject({
      goalId: goal.id,
      decision: 'pause',
      goalRevision: goal.revision,
    });
    expect(snapshot.state.goalFeedbackRecords).toEqual([record]);
    expect(snapshot.state.goals.find((item) => item.id === goal.id)).toMatchObject({
      status: 'paused',
      revision: goal.revision + 1,
    });
    expect(snapshot.state.events).toEqual([]);
    expect(snapshot.state.practiceRecords ?? []).toEqual([]);
    expect(snapshot.actions.find((item) => item.id === action.id)?.status).toBe('pending');
    expect(await get(K.entries)).toEqual(originalEntries);
  });

  it('rejects complete or end while a goal still has active work without saving feedback', async () => {
    const goal = await mountainGoal();
    await saveFutureAction({ title: '完成装备检查', goalId: goal.id, status: 'active' });
    for (const decision of ['complete', 'end'] as const)
      await expect(
        recordGoalFeedback({
          goalId: goal.id,
          expectedGoalRevision: goal.revision,
          decision,
          note: '',
          occurredOn: '2026-10-14',
        }),
      ).rejects.toThrow('请先处理关联行动，再结束目标');
    const snapshot = await readFutureSnapshot();
    expect(snapshot.state.goals.find((item) => item.id === goal.id)?.status).toBe('active');
    expect(snapshot.state.goalFeedbackRecords ?? []).toEqual([]);
  });

  it('protects a goal feedback from stale writes and retains goal history from deletion', async () => {
    const goal = await mountainGoal();
    await recordGoalFeedback({
      goalId: goal.id,
      expectedGoalRevision: goal.revision,
      decision: 'adjust',
      note: '缩小范围后继续。',
      occurredOn: '2026-10-14',
    });
    await expect(
      recordGoalFeedback({
        goalId: goal.id,
        expectedGoalRevision: goal.revision,
        decision: 'pause',
        note: '过期写入',
        occurredOn: '2026-10-14',
      }),
    ).rejects.toThrow('目标已更新，请刷新后重试');
    const saved = await readFutureSnapshot();
    await expect(
      deleteGoal(goal.id, saved.state.goals.find((item) => item.id === goal.id)!.revision),
    ).resolves.toBeUndefined();
    const afterDeletion = await readFutureSnapshot();
    expect(afterDeletion.state.goals).toEqual([]);
    expect(afterDeletion.state.goalFeedbackRecords).toEqual([]);
  });

  it('reads historical future data that has no goal-feedback field', async () => {
    const snapshot = await readFutureSnapshot();
    await set(K.future, { ...snapshot.state, goalFeedbackRecords: undefined });
    expect((await readFutureSnapshot()).state.goalFeedbackRecords).toEqual([]);
  });
});

it('removes goal feedback under the original goal while keeping an action moved to another goal', async () => {
  const original = await mountainGoal();
  const next = await saveGoal({
    title: '新的方向',
    status: 'active',
    tags: [],
    measurement: { kind: 'narrative' },
  });
  let action = await saveFutureAction({
    title: '确认路线',
    goalId: original.id,
    status: 'pending',
  });
  const record = await recordActionPractice({
    actionId: action.id,
    expectedActionRevision: action.revision ?? 0,
    occurredOn: '2026-10-14',
    status: 'partial',
    nextStep: 'continue',
    note: '路线待核对',
  });
  expect(record.goalId).toBe(original.id);
  action = (await readFutureSnapshot()).actions[0];
  await saveFutureAction({ ...action, goalId: next.id });
  expect((await readFutureSnapshot()).state.practiceRecords?.[0]).toEqual(record);
  await expect(deleteGoal(original.id, original.revision)).resolves.toBeUndefined();
  const afterDeletion = await readFutureSnapshot();
  expect(afterDeletion.actions).toContainEqual(expect.objectContaining({ id: action.id, goalId: next.id }));
  expect(afterDeletion.state.practiceRecords?.[0]).toMatchObject({ id: record.id, goalId: null });
});

it('preserves an unassigned feedback snapshot when an action later gains a goal', async () => {
  const action = await saveFutureAction({ title: '随手练习', status: 'pending' });
  const record = await recordActionPractice({
    actionId: action.id,
    expectedActionRevision: action.revision ?? 0,
    occurredOn: '2026-10-14',
    status: 'partial',
    nextStep: 'continue',
    note: '第一次练习',
  });
  expect(record.goalId).toBeNull();
});

describe('Joint action and goal feedback', () => {
  const create = async () => {
    const goal = await mountainGoal();
    const action = await saveFutureAction({ title: '爬黄山', status: 'pending', goalId: goal.id });
    const input = {
      actionId: action.id,
      expectedActionRevision: action.revision ?? 0,
      status: 'completed' as const,
      nextStep: 'end' as const,
      note: '登顶',
      occurredOn: '2026-10-14',
    };
    return { goal, action, input };
  };
  it('keeps goal completion independent by default', async () => {
    const { goal, input } = await create();
    await recordActionPractice(input);
    const { state } = await readFutureSnapshot();
    expect(state.goals.find((g) => g.id === goal.id)?.status).toBe('active');
    expect(state.goalFeedbackRecords).toHaveLength(0);
  });
  it('saves explicit completion and its linked feedback together without inventing measured progress', async () => {
    const { goal, input } = await create();
    const record = await recordActionPractice({
      ...input,
      goalFeedback: {
        goalId: goal.id,
        expectedGoalRevision: goal.revision,
        decision: 'complete',
        note: '目标已达成',
      },
    });
    const { state, actions } = await readFutureSnapshot();
    expect(actions[0].status).toBe('completed');
    expect(state.goals[0].status).toBe('completed');
    expect(state.goalFeedbackRecords?.[0].id).toBe(record.goalFeedbackId);
    expect(state.events).toHaveLength(0);
  });
  it.each(['stale', 'unlinked', 'unfinished'])(
    'rolls back both changes when %s',
    async (reason) => {
      const { goal, input } = await create();
      if (reason === 'unfinished')
        await saveFutureAction({ title: '另一项行动', status: 'pending', goalId: goal.id });
      const before = await readFutureSnapshot();
      await expect(
        recordActionPractice({
          ...input,
          goalFeedback: {
            goalId: reason === 'unlinked' ? 'different-goal' : goal.id,
            expectedGoalRevision: reason === 'stale' ? 0 : goal.revision,
            decision: 'complete',
            note: '',
          },
        }),
      ).rejects.toThrow();
      expect(await readFutureSnapshot()).toEqual(before);
    },
  );
});


describe('completed action destination', () => {
  it.each(['long_term', 'past'] as const)('saves %s atomically with ordinary entries', async (destination) => {
    const action = await saveFutureAction({ title: '完成一次访谈', status: 'pending' });
    const record = await recordActionPractice({
      actionId: action.id, expectedActionRevision: action.revision!,
      occurredOn: '2026-10-15', status: 'completed', nextStep: 'end',
      note: '明确了三个需求', completionDestination: destination,
    });
    const snapshot = await readFutureSnapshot();
    expect(snapshot.actions[0].status).toBe('completed');
    const entries = (await get<DiaryEntry[]>(K.entries)) ?? [];
    if (destination === 'past') {
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: record.pastEntryId, title: action.title, isLocked: false, tags: [],
        content: '行动：完成一次访谈\n\n结果：明确了三个需求', createdAt: record.createdAt,
      });
      expect(snapshot.actions[0].resultEntryId).toBe(entries[0].id);
      expect(snapshot.actions[0].archivedToPast).toBe(true);
      await expect(recordActionPractice({
        actionId: action.id, expectedActionRevision: action.revision!,
        occurredOn: '2026-10-15', status: 'completed', nextStep: 'end',
        note: '重复提交', completionDestination: 'past',
      })).rejects.toThrow();
      expect(await get(K.entries)).toEqual(entries);
      await expect(recordActionPractice({
        actionId: action.id, expectedActionRevision: snapshot.actions[0].revision!,
        occurredOn: '2026-10-15', status: 'completed', nextStep: 'end',
        note: '再次转存', completionDestination: 'past',
      })).rejects.toThrow('该行动已经结束');
    } else {
      expect(entries).toHaveLength(0);
      expect(snapshot.actions[0].resultEntryId).toBeUndefined();
      await recordActionPractice({
        actionId: action.id, expectedActionRevision: snapshot.actions[0].revision!,
        occurredOn: '2026-10-15', status: 'completed', nextStep: 'end',
        note: '长期推进后的结果', completionDestination: 'past',
      });
      expect(await get<DiaryEntry[]>(K.entries)).toHaveLength(1);
      expect((await readFutureSnapshot()).actions[0].archivedToPast).toBe(true);
    }
  });
});
