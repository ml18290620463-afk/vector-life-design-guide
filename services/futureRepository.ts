import type { AvatarMemorySourceRef } from '../features/avatar/types';
import type { ActionItem, DiaryEntry } from '../types';
import type { ActionPracticeInput, FutureState, Goal, OutcomeInput, Vision } from '../types/future';
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
import { sanitizeActionItem } from './diaryDataRead';
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

const keys = [K.future, K.actions, K.entries, K.backup, K.passwordHash];
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
    if (!['active', 'paused', 'completed', 'ended'].includes(status))
      throw new Error('目标状态无效');
    const goal = state.goals.find((g) => g.id === id);
    if (!goal || goal.revision !== expectedRevision) throw new Error('目标已更新，请刷新后重试');
    if (goal.status === status)
      return { goal, vision: state.visions.find((vision) => vision.id === goal.visionId) };
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
          .filter((e) => e.goalId === id && e.status === 'valid')
          .map((e) => e.id),
        total: goalProgress(state, goal).total,
        createdAt: Date.now(),
      });
    return { goal, vision: state.visions.find((vision) => vision.id === goal.visionId) };
  });
  return result;
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

/** Remove a draft plan only when it has not produced dependent records. */
export async function deleteVision(id: string, expectedRevision: number) {
  return command((state) => {
    const vision = state.visions.find((candidate) => candidate.id === id);
    if (!vision || vision.revision !== expectedRevision)
      throw new Error('愿景已更新，请刷新后重试');
    if (state.goals.some((goal) => goal.visionId === id))
      throw new Error('愿景已有关联目标，不能删除');
    state.visions = state.visions.filter((candidate) => candidate.id !== id);
  });
}

/** Remove an unstarted goal. Goals with actions or any history remain auditable. */
export async function deleteGoal(id: string, expectedRevision: number) {
  return command((state, values) => {
    const goal = state.goals.find((candidate) => candidate.id === id);
    if (!goal || goal.revision !== expectedRevision) throw new Error('目标已更新，请刷新后重试');
    if ((values[K.actions] as ActionItem[] | undefined)?.some((action) => action.goalId === id))
      throw new Error('目标已有关联行动，不能删除');
    if (
      state.events.some((event) => event.goalId === id) ||
      state.revisions.some((revision) => revision.before.id === id || revision.after.id === id) ||
      state.closures.some((closure) => closure.goalId === id)
    )
      throw new Error('目标已有历史记录，不能删除');
    state.goals = state.goals.filter((candidate) => candidate.id !== id);
  });
}

/** Remove an action draft before any practice or measured outcome exists. */
export async function deleteFutureAction(id: string, expectedRevision: number) {
  return command((state, values) => {
    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    const action = actions.find((candidate) => candidate.id === id);
    if (!action || (action.revision ?? 0) !== expectedRevision)
      throw new Error('行动已更新，请刷新后重试');
    if (
      (state.practiceRecords ?? []).some((record) => record.actionId === id) ||
      state.events.some((event) => event.sourceActionId === id)
    )
      throw new Error('行动已有践行或成果记录，不能删除');
    values[K.actions] = actions.filter((candidate) => candidate.id !== id);
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
    if (typeof input.note !== 'string') throw new Error('实际情况无效');
    if (!['completed', 'partial', 'not_completed', 'cancelled'].includes(input.status))
      throw new Error('行动状态无效');
    if (!['continue', 'adjust', 'pause', 'end'].includes(input.nextStep))
      throw new Error('下一步无效');
    const actions = (values[K.actions] as ActionItem[] | undefined) ?? [];
    const action = actions.find((candidate) => candidate.id === input.actionId);
    if (!action || (action.revision ?? 0) !== input.expectedActionRevision)
      throw new Error('行动已更新，请刷新后重试');
    if (!['pending', 'active'].includes(action.status)) throw new Error('该行动已经结束');
    if (input.status === 'completed' && input.nextStep !== 'end')
      throw new Error('已完成行动只能结束');
    if (input.status === 'cancelled' && input.nextStep !== 'end')
      throw new Error('已取消行动只能结束');
    const nextStatus =
      input.status === 'completed'
        ? 'completed'
        : input.status === 'cancelled' || input.nextStep === 'end'
          ? 'abandoned'
          : 'active';
    const reviewedAt = Date.now();
    const record = {
      id: generateSecureId('practice'),
      actionId: action.id,
      status: input.status,
      note: input.note.trim(),
      nextStep: input.nextStep,
      occurredOn: input.occurredOn,
      createdAt: reviewedAt,
    };
    state.practiceRecords = [record, ...(state.practiceRecords ?? [])];
    values[K.actions] = actions.map((candidate) =>
      candidate.id === action.id
        ? {
            ...candidate,
            status: nextStatus,
            reviewedAt,
            completedAt: nextStatus === 'completed' ? reviewedAt : undefined,
            updatedAt: reviewedAt,
            revision: (candidate.revision ?? 0) + 1,
          }
        : candidate,
    );
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
