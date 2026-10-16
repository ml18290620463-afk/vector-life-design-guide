/* eslint-disable max-lines -- This repository keeps future-state transactions together for atomic writes. */
import type { AvatarMemorySourceRef } from '../features/avatar/types';
import type { ActionItem, DiaryEntry, Principle } from '../types';
import type {
  ActionPracticeInput,
  ActionPracticeRecord,
  FutureState,
  GoalFeedbackInput,
  Goal,
  OutcomeInput,
  Vision,
} from '../types/future';
import {
  emptyFutureState,
  goalProgress,
  hasLongTermActionTag,
  isLongTermAction,
  localDate,
  LONG_TERM_ACTION_TAG,
  LONG_TERM_ACTION_TARGET,
  stateFrom,
  validateDate,
  validateMeasurement,
  textRequired,
  units,
} from './futureDomain';
import { DiaryStorageKeys as K } from './diaryStorage';
import { sanitizeActionItem, sanitizePrinciple } from './diaryDataRead';
import { applyPrinciplePracticeFeedback } from './experienceFeedback';
import { generateSecureId } from './idGenerator';
import { vaultTransaction, VaultLockedError } from './vaultTransaction';
import { storedArray, withLegacyValue } from './vaultLegacyRead';

export {
  emptyFutureState,
  goalProgress,
  hasLongTermActionTag,
  isLongTermAction,
  localDate,
  LONG_TERM_ACTION_TAG,
  LONG_TERM_ACTION_TARGET,
  stateFrom,
  validateDate,
  validateMeasurement,
  textRequired,
  units,
};

const keys = [K.future, K.actions, K.entries, K.principles, K.backup, K.passwordHash];
export function readFutureSnapshot() {
  return vaultTransaction(
    keys,
    (values) => {
      const protectedVault = false;
      return {
        state: protectedVault
          ? emptyFutureState()
          : stateFrom(withLegacyValue(values[K.future], K.future)),
        actions: protectedVault
          ? []
          : (storedArray<ActionItem>(values[K.actions], K.actions) ?? []).flatMap(
              (a) => sanitizeActionItem(a) ?? [],
            ),
        protectedVault,
      };
    },
    true,
  ).catch((error: unknown) => {
    if (error instanceof VaultLockedError)
      return { state: emptyFutureState(), actions: [], protectedVault: true };
    throw error;
  });
}
function command<T>(fn: (state: FutureState, values: Record<string, unknown>) => T) {
  return vaultTransaction(keys, (values) => {
    const state = stateFrom(withLegacyValue(values[K.future], K.future));
    values[K.actions] = storedArray<ActionItem>(values[K.actions], K.actions);
    values[K.entries] = storedArray<DiaryEntry>(values[K.entries], K.entries);
    values[K.principles] = (storedArray<Principle>(values[K.principles], K.principles) ?? []).map(
      sanitizePrinciple,
    );
    const result = fn(state, values);
    state.revision += 1;
    values[K.future] = stateFrom(state);
    values[K.backup] = values[K.entries];
    return result;
  });
}
export async function saveVision(
  input: Pick<Vision, 'text' | 'status'> & Partial<Pick<Vision, 'id' | 'revision'>>,
) {
  const vision = await command((state) => {
    textRequired(input.text, '愿景');
    if (!['active', 'paused', 'archived'].includes(input.status)) throw new Error('愿景状态无效');
    const old = state.visions.find((v) => v.id === input.id);
    if (input.id && (!old || old.revision !== input.revision))
      throw new Error('愿景已更新，请重新打开');
    if (
      old &&
      input.status === 'archived' &&
      old.status !== 'archived' &&
      state.goals.some(
        (goal) =>
          goal.visionId === old.id && (goal.status === 'active' || goal.status === 'paused'),
      )
    )
      throw new Error('请先处理关联目标，再结束愿景');
    const vision: Vision = {
      id: old?.id ?? generateSecureId('vision'),
      text: input.text.trim(),
      status: input.status,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    state.visions = [...state.visions.filter((v) => v.id !== vision.id), vision];
    return vision;
  });
  return vision;
}
export async function saveGoal(
  input: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'revision'> &
    Partial<Pick<Goal, 'id' | 'revision'>>,
) {
  const result = await command((state) => {
    const longTermAction = hasLongTermActionTag(input);
    textRequired(input.title, longTermAction ? '行动' : '目标');
    validateMeasurement(input.measurement);
    if (input.startDate) validateDate(input.startDate);
    if (input.dueDate) validateDate(input.dueDate);
    if (input.startDate && input.dueDate && input.startDate > input.dueDate)
      throw new Error('结束日期不能早于开始日期');
    const vision = input.visionId
      ? state.visions.find((candidate) => candidate.id === input.visionId)
      : undefined;
    if (input.visionId && !vision) throw new Error('关联愿景不存在');
    if (vision?.status === 'archived') throw new Error('不能关联已结束的愿景');
    const old = state.goals.find((g) => g.id === input.id);
    if (!old && input.status !== 'active' && !(longTermAction && input.status === 'paused'))
      throw new Error('新目标须从进行中开始');
    if (old && ['completed', 'ended'].includes(old.status))
      throw new Error('请先重新开启目标再编辑');
    if (input.id && (!old || old.revision !== input.revision))
      throw new Error('目标已更新，请重新打开');
    if (old && input.status !== old.status) throw new Error('请使用目标状态操作');
    if (old && state.events.some((e) => e.goalId === old.id)) {
      const oldM = old.measurement,
        nextM = input.measurement;
      if (
        oldM.kind !== nextM.kind ||
        (oldM.kind === 'quantity' &&
          nextM.kind === 'quantity' &&
          (oldM.unit !== nextM.unit ||
            oldM.precision !== nextM.precision ||
            oldM.distinctItems !== nextM.distinctItems))
      )
        throw new Error('已有成果，请新建目标以改变计量规则');
    }
    const goal: Goal = {
      ...input,
      title: input.title.trim(),
      id: old?.id ?? generateSecureId('goal'),
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    if (old)
      state.revisions.push({
        id: generateSecureId('revision'),
        before: structuredClone(old),
        after: structuredClone(goal),
        createdAt: Date.now(),
      });
    state.goals = [...state.goals.filter((g) => g.id !== goal.id), goal];
    return { goal, vision: state.visions.find((vision) => vision.id === goal.visionId) };
  });
  return result.goal;
}
export async function setGoalStatus(id: string, status: Goal['status'], expectedRevision: number) {
  const result = await command((state, values) => {
    const goal = updateGoalStatusInState(state, values, id, status, expectedRevision);
    return { goal, vision: state.visions.find((vision) => vision.id === goal.visionId) };
  });
  return result;
}

function updateGoalStatusInState(
  state: FutureState,
  values: Record<string, unknown>,
  id: string,
  status: Goal['status'],
  expectedRevision: number,
) {
  if (!['active', 'paused', 'completed', 'ended'].includes(status)) throw new Error('目标状态无效');
  const goal = state.goals.find((candidate) => candidate.id === id);
  if (!goal || goal.revision !== expectedRevision) throw new Error('目标已更新，请刷新后重试');
  if (goal.status === status) return goal;
  if (
    (status === 'completed' || status === 'ended') &&
    (values[K.actions] as ActionItem[] | undefined)?.some(
      (action) =>
        action.goalId === id && (action.status === 'pending' || action.status === 'active'),
    )
  )
    throw new Error('请先处理关联行动，再结束目标');
  const before = structuredClone(goal);
  goal.status = status;
  goal.revision++;
  goal.updatedAt = Date.now();
  state.revisions.push({
    id: generateSecureId('revision'),
    before,
    after: structuredClone(goal),
    createdAt: Date.now(),
  });
  if (status === 'completed' || status === 'ended')
    state.closures.push({
      id: generateSecureId('closure'),
      goalId: id,
      snapshot: structuredClone(goal),
      progressEventIds: state.events
        .filter((event) => event.goalId === id && event.status === 'valid')
        .map((event) => event.id),
      total: goalProgress(state, goal).total,
      createdAt: Date.now(),
    });
  return goal;
}

/** Save a goal-direction review without creating, editing, or linking an experience. */
export async function recordGoalFeedback(input: GoalFeedbackInput) {
  return command((state, values) => {
    return recordGoalFeedbackInState(state, values, input);
  });
}
function recordGoalFeedbackInState(
  state: FutureState,
  values: Record<string, unknown>,
  input: GoalFeedbackInput,
) {
  validateDate(input.occurredOn);
  if (!['continue', 'adjust', 'pause', 'complete', 'end'].includes(input.decision))
    throw new Error('目标判断无效');
  if (
    typeof input.note !== 'string' ||
    (typeof input.nextStep !== 'undefined' && typeof input.nextStep !== 'string')
  )
    throw new Error('反馈内容无效');
  const goal = state.goals.find((candidate) => candidate.id === input.goalId);
  if (!goal || goal.revision !== input.expectedGoalRevision)
    throw new Error('目标已更新，请刷新后重试');
  const goalTitle = goal.title;
  const goalRevision = goal.revision;
  const status = {
    continue: 'active',
    adjust: 'active',
    pause: 'paused',
    complete: 'completed',
    end: 'ended',
  }[input.decision] as Goal['status'];
  const updatedGoal = updateGoalStatusInState(
    state,
    values,
    input.goalId,
    status,
    input.expectedGoalRevision,
  );
  // A direction review is a meaningful state transition even when its mapped
  // status is already active (for example, "adjust"). Advance the revision
  // so an older page cannot append a conflicting review afterwards.
  if (updatedGoal.revision === goalRevision) {
    const before = structuredClone(updatedGoal);
    updatedGoal.revision += 1;
    updatedGoal.updatedAt = Date.now();
    state.revisions.push({
      id: generateSecureId('revision'),
      before,
      after: structuredClone(updatedGoal),
      createdAt: Date.now(),
    });
  }
  const record = {
    id: generateSecureId('goal-feedback'),
    goalId: input.goalId,
    goalTitle,
    goalRevision,
    decision: input.decision,
    note: input.note.trim(),
    nextStep: input.nextStep?.trim() || undefined,
    occurredOn: input.occurredOn,
    createdAt: Date.now(),
  };
  state.goalFeedbackRecords = [record, ...(state.goalFeedbackRecords ?? [])];
  return record;
}
export async function saveFutureAction(
  input: Omit<ActionItem, 'id' | 'createdAt'> & { id?: string },
) {
  const result = await command((state, values) => {
    textRequired(input.title, '行动');
    if (!['pending', 'active', 'completed', 'abandoned'].includes(input.status))
      throw new Error('行动状态无效');
    if (input.scheduledOn) validateDate(input.scheduledOn);
    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    const old = actions.find((a) => a.id === input.id);
    const goal = input.goalId
      ? state.goals.find((candidate) => candidate.id === input.goalId)
      : undefined;
    if (input.goalId && !goal) throw new Error('目标不存在');
    if (input.goalId && goal?.status !== 'active' && (!old || old.goalId !== goal.id))
      throw new Error('只能为进行中的目标新增行动');
    if (input.id && (!old || (old.revision ?? 0) !== (input.revision ?? 0)))
      throw new Error('行动已更新，请刷新后重试');
    const action: ActionItem = {
      ...input,
      id: old?.id ?? generateSecureId('action'),
      createdAt: old?.createdAt ?? Date.now(),
      revision: (old?.revision ?? 0) + 1,
      updatedAt: Date.now(),
      completedAt: input.status === 'completed' ? (old?.completedAt ?? Date.now()) : undefined,
    };
    values[K.actions] = [action, ...actions.filter((a) => a.id !== action.id)];
    return {
      action,
      state: {
        ...emptyFutureState(),
        visions: state.visions,
        goals: state.goals,
      },
    };
  });
  return result.action;
}

/**
 * Remove a user's future data together with records that exist only because of it.
 * Past diary entries are deliberately outside this graph: a future plan may refer
 * to an experience, but deleting the plan must never erase that experience.
 */
const practiceFeedbackDelta = {
  helpful: 0.12,
  partial: 0.04,
  unhelpful: -0.12,
  unrelated: 0,
} as const;

function removePracticeFeedbackFromPrinciples(
  values: Record<string, unknown>,
  records: ActionPracticeRecord[],
) {
  const removed = new Map<string, ActionPracticeRecord['principleFeedback']>();
  for (const record of records) {
    const feedback = record.principleFeedback;
    if (feedback && feedback.outcome !== 'unrelated') removed.set(record.id, feedback);
  }
  if (!removed.size) return;

  const principles = (values[K.principles] as Principle[] | undefined) ?? [];
  values[K.principles] = principles.map((principle) => {
    const practiceIds = new Set(principle.appliedFeedbackPracticeIds ?? []);
    const applied = [...removed].filter(([id, feedback]) =>
      practiceIds.has(id) && feedback?.principleId === principle.id,
    );
    if (!applied.length) return principle;

    let confidence = principle.confidence ?? 0.5;
    let recallCount = principle.recallCount ?? 0;
    let helpfulCount = principle.helpfulCount ?? 0;
    let partialCount = principle.partialCount ?? 0;
    let unhelpfulCount = principle.unhelpfulCount ?? 0;
    for (const [, feedback] of applied) {
      confidence = Math.min(1, Math.max(0, Math.round((confidence - practiceFeedbackDelta[feedback!.outcome]) * 100) / 100));
      recallCount = Math.max(0, recallCount - 1);
      if (feedback!.outcome === 'helpful') helpfulCount = Math.max(0, helpfulCount - 1);
      if (feedback!.outcome === 'partial') partialCount = Math.max(0, partialCount - 1);
      if (feedback!.outcome === 'unhelpful') unhelpfulCount = Math.max(0, unhelpfulCount - 1);
    }
    const removedIds = new Set(applied.map(([id]) => id));
    return {
      ...principle,
      confidence,
      recallCount,
      helpfulCount,
      partialCount,
      unhelpfulCount,
      appliedFeedbackPracticeIds: (principle.appliedFeedbackPracticeIds ?? []).filter(
        (id) => !removedIds.has(id),
      ),
      derivedFromPracticeIds: (principle.derivedFromPracticeIds ?? []).filter(
        (id) => !removedIds.has(id),
      ),
    };
  });
}

function removeEventsInState(state: FutureState, eventIds: Set<string>) {
  if (!eventIds.size) return;
  state.events = state.events.filter((event) => !eventIds.has(event.id));
  state.closures = state.closures.map((closure) => ({
    ...closure,
    progressEventIds: closure.progressEventIds.filter((id) => !eventIds.has(id)),
  }));
  state.receipts = state.receipts.flatMap((receipt) => {
    const retainedEventIds = receipt.eventIds.filter((id) => !eventIds.has(id));
    return retainedEventIds.length ? [{ ...receipt, eventIds: retainedEventIds }] : [];
  });
  const referencedItemIds = new Set(
    state.events.flatMap((event) => (event.value.kind === 'quantity' && event.value.itemId ? [event.value.itemId] : [])),
  );
  state.items = state.items.filter((item) => referencedItemIds.has(item.id));
}

function removeArchiveOrigins(state: FutureState, kind: 'vision' | 'goal' | 'action', ids: Set<string>) {
  if (!state.archiveOrigins) return;
  state.archiveOrigins = Object.fromEntries(
    Object.entries(state.archiveOrigins).filter(([, origin]) => !(origin.kind === kind && ids.has(origin.id))),
  );
}

function deletePracticeRecordsInState(
  state: FutureState,
  values: Record<string, unknown>,
  practiceIds: Set<string>,
) {
  if (!practiceIds.size) return;
  const removedPractice = (state.practiceRecords ?? []).filter((record) => practiceIds.has(record.id));
  const removedGoalFeedbackIds = new Set(
    removedPractice.flatMap((record) => (record.goalFeedbackId ? [record.goalFeedbackId] : [])),
  );
  removePracticeFeedbackFromPrinciples(values, removedPractice);
  state.practiceRecords = (state.practiceRecords ?? []).filter((record) => !practiceIds.has(record.id));
  state.goalFeedbackRecords = (state.goalFeedbackRecords ?? []).filter(
    (record) => !removedGoalFeedbackIds.has(record.id),
  );
}

function deleteActionsInState(
  state: FutureState,
  values: Record<string, unknown>,
  actionIds: Set<string>,
) {
  if (!actionIds.size) return;
  const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
  const practiceIds = new Set(
    (state.practiceRecords ?? [])
      .filter((record) => actionIds.has(record.actionId))
      .map((record) => record.id),
  );
  deletePracticeRecordsInState(state, values, practiceIds);
  removeEventsInState(
    state,
    new Set(state.events.filter((event) => event.sourceActionId && actionIds.has(event.sourceActionId)).map((event) => event.id)),
  );
  values[K.actions] = actions.filter((action) => !actionIds.has(action.id));
  removeArchiveOrigins(state, 'action', actionIds);
}

function deleteGoalsInState(
  state: FutureState,
  values: Record<string, unknown>,
  goalIds: Set<string>,
) {
  if (!goalIds.size) return;
  const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
  deleteActionsInState(state, values, new Set(actions.filter((action) => action.goalId && goalIds.has(action.goalId)).map((action) => action.id)));

  const removedGoalFeedbackIds = new Set(
    (state.goalFeedbackRecords ?? []).filter((record) => goalIds.has(record.goalId)).map((record) => record.id),
  );
  state.goalFeedbackRecords = (state.goalFeedbackRecords ?? []).filter(
    (record) => !goalIds.has(record.goalId),
  );
  state.practiceRecords = (state.practiceRecords ?? []).map((record) => {
    if (goalIds.has(record.goalId ?? '')) {
      const { goalId: _removedGoalId, ...detached } = record;
      return {
        ...detached,
        goalId: null,
        ...(record.goalFeedbackId && removedGoalFeedbackIds.has(record.goalFeedbackId)
          ? { goalFeedbackId: undefined }
          : {}),
      };
    }
    return record.goalFeedbackId && removedGoalFeedbackIds.has(record.goalFeedbackId)
      ? { ...record, goalFeedbackId: undefined }
      : record;
  });
  removeEventsInState(
    state,
    new Set(state.events.filter((event) => goalIds.has(event.goalId)).map((event) => event.id)),
  );
  state.items = state.items.filter((item) => !goalIds.has(item.goalId));
  state.revisions = state.revisions.filter(
    (revision) => !goalIds.has(revision.before.id) && !goalIds.has(revision.after.id),
  );
  state.closures = state.closures.filter((closure) => !goalIds.has(closure.goalId));
  state.goals = state.goals.filter((goal) => !goalIds.has(goal.id));
  removeArchiveOrigins(state, 'goal', goalIds);
}

/** Delete a vision and every future plan, feedback, and outcome nested beneath it. */
export async function deleteVision(id: string, expectedRevision: number) {
  return command((state, values) => {
    const vision = state.visions.find((candidate) => candidate.id === id);
    if (!vision || vision.revision !== expectedRevision)
      throw new Error('愿景已更新，请刷新后重试');
    deleteGoalsInState(
      state,
      values,
      new Set(state.goals.filter((goal) => goal.visionId === id).map((goal) => goal.id)),
    );
    state.visions = state.visions.filter((candidate) => candidate.id !== id);
    removeArchiveOrigins(state, 'vision', new Set([id]));
  });
}

/** Delete a goal and all of its future-side dependent records. */
export async function deleteGoal(id: string, expectedRevision: number) {
  return command((state, values) => {
    const goal = state.goals.find((candidate) => candidate.id === id);
    if (!goal || goal.revision !== expectedRevision) throw new Error('目标已更新，请刷新后重试');
    deleteGoalsInState(state, values, new Set([id]));
  });
}

/** Delete an action together with its action feedback and future-side outcomes. */
export async function deleteFutureAction(id: string, expectedRevision: number) {
  return command((state, values) => {
    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    const action = actions.find((candidate) => candidate.id === id);
    if (!action || (action.revision ?? 0) !== expectedRevision)
      throw new Error('行动已更新，请刷新后重试');
    deleteActionsInState(state, values, new Set([id]));
  });
}

/** Delete several actions in one atomic transaction, including their dependent future records. */
export async function deleteFutureActions(
  candidates: Array<Pick<ActionItem, 'id' | 'revision'>>,
) {
  return command((state, values) => {
    if (!candidates.length) throw new Error('请先选择行动');
    const selected = new Map(candidates.map((candidate) => [candidate.id, candidate.revision ?? 0]));
    if (selected.size !== candidates.length) throw new Error('行动选择重复，请重试');

    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    for (const [id, revision] of selected) {
      const action = actions.find((candidate) => candidate.id === id);
      if (!action || (action.revision ?? 0) !== revision)
        throw new Error('行动已更新，请刷新后重试');
    }
    deleteActionsInState(state, values, new Set(selected.keys()));
  });
}

/** Delete one action feedback and its coupled goal review, without deleting the action. */
export async function deleteActionPractice(id: string) {
  return command((state, values) => {
    if (!(state.practiceRecords ?? []).some((record) => record.id === id))
      throw new Error('行动反馈不存在');
    deletePracticeRecordsInState(state, values, new Set([id]));
  });
}

/** Delete one goal-direction review. The goal's current state is retained until changed explicitly. */
export async function deleteGoalFeedback(id: string) {
  return command((state) => {
    if (!(state.goalFeedbackRecords ?? []).some((record) => record.id === id))
      throw new Error('目标反馈不存在');
    state.goalFeedbackRecords = (state.goalFeedbackRecords ?? []).filter((record) => record.id !== id);
    state.practiceRecords = (state.practiceRecords ?? []).map((record) =>
      record.goalFeedbackId === id ? { ...record, goalFeedbackId: undefined } : record,
    );
  });
}

/** Permanently remove one confirmed progress event and its now-unused receipt or item. */
export async function deleteProgress(id: string) {
  return command((state) => {
    if (!state.events.some((event) => event.id === id)) throw new Error('成果不存在');
    removeEventsInState(state, new Set([id]));
  });
}

/**
 * Save the outcome of an action without manufacturing a goal-progress event.
 * A goal can be connected to an action for context, but only an explicit goal
 * progress entry should change the goal's measured outcome.
 */
export async function recordActionPractice(input: ActionPracticeInput) {
  return command((state, values) => {
    validateDate(input.occurredOn);
    if (typeof input.note !== 'string') throw new Error('反馈内容无效');
    if (!['completed', 'partial', 'not_completed', 'cancelled'].includes(input.status))
      throw new Error('行动状态无效');
    if (!['continue', 'adjust', 'pause', 'end'].includes(input.nextStep))
      throw new Error('下一步无效');
    if (input.completionDestination !== undefined &&
      (input.status !== 'completed' || !['long_term', 'past'].includes(input.completionDestination)))
      throw new Error('完成后的保存方式无效');
    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    const action = actions.find((candidate) => candidate.id === input.actionId);
    if (!action || (action.revision ?? 0) !== input.expectedActionRevision)
      throw new Error('行动已更新，请刷新后重试');
    if (!['pending', 'active', 'completed'].includes(action.status) || action.archivedToPast)
      throw new Error('该行动已经结束');
    if (input.status === 'completed' && input.nextStep !== 'end')
      throw new Error('已完成行动只能结束');
    if (input.status === 'cancelled' && input.nextStep !== 'end')
      throw new Error('已取消行动只能结束');
    const nextAction = input.nextStep === 'adjust' ? input.nextAction?.trim() : undefined;
    if (input.nextStep === 'adjust') textRequired(nextAction ?? '', '调整后的行动');
    const nextStatus =
      input.status === 'completed'
        ? 'completed'
        : input.status === 'cancelled' || input.nextStep === 'end'
          ? 'abandoned'
          : 'active';
    const reviewedAt = Date.now();
    const recordId = generateSecureId('practice');
    const requestedFeedback = input.principleFeedback;
    let principleFeedback: ActionPracticeRecord['principleFeedback'];
    if (requestedFeedback) {
      if (!['helpful', 'partial', 'unhelpful', 'unrelated'].includes(requestedFeedback.outcome))
        throw new Error('原则反馈无效');
      if (requestedFeedback.principleId !== action.principleId)
        throw new Error('原则关联已更新，请重新选择');
      const principles = (values[K.principles] as Principle[] | undefined) ?? [];
      const principle = principles.find(
        (candidate) => candidate.id === requestedFeedback.principleId,
      );
      if (!principle) throw new Error('关联原则已删除，请重新选择');
      principleFeedback = {
        principleId: principle.id,
        principleText: principle.text,
        outcome: requestedFeedback.outcome,
      };
      if (requestedFeedback.outcome !== 'unrelated') {
        const updated = applyPrinciplePracticeFeedback(
          principle,
          requestedFeedback.outcome,
          reviewedAt,
          recordId,
        );
        updated.derivedFromPracticeIds = Array.from(
          new Set([...(updated.derivedFromPracticeIds ?? []), recordId]),
        );
        values[K.principles] = principles.map((candidate) =>
          candidate.id === principle.id ? updated : candidate,
        );
      }
    }
    const record: ActionPracticeRecord = {
      id: recordId,
      actionId: action.id,
      goalId: action.goalId ?? null,
      actionTitle: action.title,
      nextAction,
      status: input.status,
      note: input.note.trim(),
      nextStep: input.nextStep,
      occurredOn: input.occurredOn,
      createdAt: reviewedAt,
      principleFeedback,
    };
    if (input.status === 'completed') {
      record.completionDestination = input.completionDestination ?? 'long_term';
      if (record.completionDestination === 'past') {
        const entry: DiaryEntry = {
          id: generateSecureId('entry'),
          title: action.title,
          content: `行动：${action.title}\n\n结果：${input.note.trim() || '已完成'}`,
          createdAt: reviewedAt,
          updatedAt: reviewedAt,
          tags: [],
          isLocked: false,
        };
        record.pastEntryId = entry.id;
        const entries = (values[K.entries] as DiaryEntry[] | undefined) ?? [];
        values[K.entries] = [entry, ...entries.filter((entry) => !entry.isSample)];
      }
    }
    state.practiceRecords = [record, ...(state.practiceRecords ?? [])];
    values[K.actions] = actions.map((candidate) =>
      candidate.id === action.id
        ? {
            ...candidate,
            resultEntryId: record.pastEntryId ?? candidate.resultEntryId,
            archivedToPast: record.pastEntryId ? true : candidate.archivedToPast,
            title: nextAction ?? candidate.title,
            status: nextStatus,
            reviewedAt,
            completedAt: nextStatus === 'completed' ? reviewedAt : undefined,
            updatedAt: reviewedAt,
            revision: (candidate.revision ?? 0) + 1,
          }
        : candidate,
    );
    if (input.goalFeedback) {
      if (!action.goalId || input.goalFeedback.goalId !== action.goalId)
        throw new Error('目标关联已更新，请刷新后重试');
      const goalRecord = recordGoalFeedbackInState(state, values, {
        ...input.goalFeedback,
        occurredOn: input.occurredOn,
      });
      record.goalFeedbackId = goalRecord.id;
    }
    return record;
  });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function recordOutcome(input: OutcomeInput) {
  const fingerprint = await digest(input);
  return command((state, values) => {
    const receipt = state.receipts.find((r) => r.operationId === input.operationId);
    if (receipt) {
      if (receipt.digest !== fingerprint) throw new Error('此保存请求的内容已改变，请重新提交');
      return receipt.eventIds;
    }
    textRequired(input.operationId, '操作编号');
    validateDate(input.occurredOn);
    const targets = [input, ...(input.additionalTargets ?? [])];
    if (new Set(targets.map((target) => target.goalId)).size !== targets.length)
      throw new Error('同一目标只能计入一次');
    const entries = (values[K.entries] as DiaryEntry[] | undefined) ?? [];
    if (input.entry && input.sourceEntryId && input.entry.id !== input.sourceEntryId)
      throw new Error('经历关联不一致');
    const entryId = input.entry?.id ?? input.sourceEntryId;
    if (input.entry) {
      const entry = input.entry;
      if (
        typeof entry.id !== 'string' ||
        !entry.id.trim() ||
        typeof entry.content !== 'string' ||
        !entry.content.trim() ||
        typeof entry.title !== 'string' ||
        !Number.isFinite(entry.createdAt) ||
        entry.createdAt < 0 ||
        !Array.isArray(entry.tags) ||
        !entry.tags.every((tag) => typeof tag === 'string') ||
        entry.isSample ||
        entry.isEncrypted ||
        entry.isLocked
      )
        throw new Error('请选择可访问的真实记录');
      if (entries.some((e) => e.id === input.entry!.id && canonical(e) !== canonical(input.entry)))
        throw new Error('记录已存在');
      if (!entries.some((e) => e.id === input.entry!.id))
        values[K.entries] = [input.entry, ...entries.filter((e) => !e.isSample)];
    } else if (
      entryId &&
      !entries.some((e) => e.id === entryId && !e.isSample && !e.isEncrypted && !e.isLocked)
    )
      throw new Error('请选择可访问的真实记录');
    const eventIds = targets.map((target) => {
      const goal = state.goals.find((g) => g.id === target.goalId);
      if (!goal || goal.revision !== target.expectedRevision)
        throw new Error('目标已更新，请刷新后重试');
      if (goal.status !== 'active') throw new Error('请先重新开启目标');
      const old = target.replacesEventId
        ? state.events.find(
            (e) => e.id === target.replacesEventId && e.goalId === goal.id && e.status === 'valid',
          )
        : undefined;
      if (target.replacesEventId && !old) throw new Error('成果已被调整，请刷新后重试');
      const value = { ...target.value };
      if (value.kind !== goal.measurement.kind) throw new Error('成果与目标计量方式不一致');
      if (value.kind === 'narrative') textRequired(value.note, '进展');
      if (value.kind === 'quantity' && goal.measurement.kind === 'quantity') {
        units(value.amount, goal.measurement.precision);
        if (goal.measurement.distinctItems) {
          if (value.amount !== 1) throw new Error('每个不同对象计入一次');
          let item = state.items.find((i) => i.id === value.itemId && i.goalId === goal.id);
          if (!item) {
            textRequired(target.itemLabel ?? '', '成果名称');
            const label = target.itemLabel!.trim().normalize('NFKC');
            item = state.items.find(
              (i) =>
                i.goalId === goal.id && i.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
            );
            if (!item) {
              item = { id: generateSecureId('item'), goalId: goal.id, label };
              state.items.push(item);
            }
          }
          value.itemId = item.id;
        } else delete value.itemId;
      }
      const semanticKey = `${goal.id}:${value.kind === 'quantity' && value.itemId ? `item:${value.itemId}` : entryId ? `entry:${entryId}` : input.actionId ? `action:${input.actionId}` : input.operationId}`;
      const duplicate = state.events.find(
        (e) => e.semanticKey === semanticKey && e.status === 'valid' && e.id !== old?.id,
      );
      if (old) {
        old.status = 'revoked';
        old.revokedAt = Date.now();
      }
      const id = generateSecureId('progress');
      state.events.push({
        id,
        goalId: goal.id,
        operationId: input.operationId,
        semanticKey,
        value,
        occurredOn: input.occurredOn,
        sourceEntryId: entryId,
        sourceActionId: input.actionId,
        sourceState: entryId ? 'linked' : 'standalone',
        confirmedBy: 'user',
        status: duplicate ? 'revoked' : 'valid',
        revokedAt: duplicate ? Date.now() : undefined,
        replacesEventId: old?.id,
        goalRevision: goal.revision,
        createdAt: Date.now(),
        actionFeedback: target.actionFeedback,
      });
      return id;
    });
    if (input.actionId) {
      const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
      const action = actions.find((a) => a.id === input.actionId);
      if (!action || (action.goalId && !targets.some((target) => target.goalId === action.goalId)))
        throw new Error('行动与目标不一致');
      if ((action.revision ?? 0) !== input.expectedActionRevision)
        throw new Error('行动已更新，请刷新后重试');
      const nextStatus = input.actionStatus ?? 'completed';
      const reviewedAt = Date.now();
      values[K.actions] = actions.map((a) =>
        a.id === action.id
          ? {
              ...a,
              status: nextStatus,
              resultEntryId: entryId,
              reviewedAt,
              completedAt: nextStatus === 'completed' ? reviewedAt : undefined,
              updatedAt: reviewedAt,
              revision: (a.revision ?? 0) + 1,
            }
          : a,
      );
    }
    state.receipts.push({
      operationId: input.operationId,
      digest: fingerprint,
      eventIds,
      revision: state.revision + 1,
    });
    return eventIds;
  });
}
export function revokeProgress(id: string) {
  return command((state) => {
    const event = state.events.find((e) => e.id === id);
    if (!event) throw new Error('成果不存在');
    event.status = 'revoked';
    event.revokedAt = Date.now();
  });
}
/** Called inside the same transaction that deletes the source entries. */
export function detachFutureSources(
  values: Record<string, unknown>,
  ids: Set<string>,
  retain: boolean,
) {
  const state = stateFrom(withLegacyValue(values[K.future], K.future));
  for (const event of state.events)
    if (event.sourceEntryId && ids.has(event.sourceEntryId)) {
      delete event.sourceEntryId;
      event.sourceState = 'source-deleted';
      if (!retain) {
        event.status = 'revoked';
        event.revokedAt = Date.now();
      }
    }
  const actions = storedArray<ActionItem>(values[K.actions], K.actions) ?? [];
  values[K.actions] = actions.map((a) => {
    if (
      !(a.sourceEntryId && ids.has(a.sourceEntryId)) &&
      !(a.resultEntryId && ids.has(a.resultEntryId)) &&
      !a.evidenceEntryIds?.some((id) => ids.has(id))
    )
      return a;
    return {
      ...a,
      sourceEntryId: a.sourceEntryId && ids.has(a.sourceEntryId) ? undefined : a.sourceEntryId,
      resultEntryId: a.resultEntryId && ids.has(a.resultEntryId) ? undefined : a.resultEntryId,
      evidenceEntryIds: a.evidenceEntryIds?.filter((id) => !ids.has(id)),
      revision: (a.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
  });
  state.revision++;
  values[K.future] = state;
}

/** One idempotent write for a confirmed proposal, using the same canonical store as every view. */
export function saveArchiveDirection(input: {
  proposalId: string;
  kind: 'vision' | 'goal' | 'action';
  text: string;
  tags: string[];
  sourceRefs: AvatarMemorySourceRef[];
}) {
  return command((state, values) => {
    textRequired(input.text, '内容');
    textRequired(input.proposalId, '来源');
    if (!['vision', 'goal', 'action'].includes(input.kind)) throw new Error('请选择保存类型');
    const existing =
      state.archiveOrigins && Object.hasOwn(state.archiveOrigins, input.proposalId)
        ? state.archiveOrigins[input.proposalId]
        : undefined;
    const fingerprint = JSON.stringify([
      input.kind,
      input.text.trim(),
      input.tags,
      input.sourceRefs,
    ]);
    if (existing) {
      if (existing.fingerprint && existing.fingerprint !== fingerprint)
        throw new Error('确认内容已改变，请重新发起保存');
      return existing;
    }
    const now = Date.now();
    const id = generateSecureId(input.kind);
    if (input.kind === 'vision') {
      state.visions.push({
        id,
        text: input.text.trim(),
        status: 'active',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    } else if (input.kind === 'goal') {
      state.goals.push({
        id,
        title: input.text.trim(),
        status: 'active',
        measurement: { kind: 'narrative' },
        tags: input.tags,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
      values[K.actions] = [
        {
          id,
          title: input.text.trim(),
          status: 'pending',
          revision: 1,
          createdAt: now,
          updatedAt: now,
        },
        ...actions,
      ];
    }
    const origin = { kind: input.kind, id, sourceRefs: input.sourceRefs, fingerprint };
    state.archiveOrigins = { ...state.archiveOrigins, [input.proposalId]: origin };
    return origin;
  });
}
