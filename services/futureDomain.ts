import type { FutureState, Goal, Measurement } from '../types/future';

export const emptyFutureState = (): FutureState => ({
  schemaVersion: 1,
  revision: 0,
  visions: [],
  goals: [],
  items: [],
  events: [],
  practiceRecords: [],
  revisions: [],
  closures: [],
  receipts: [],
});
export const LONG_TERM_ACTION_TAG = '系统:长期行动';
export const LONG_TERM_ACTION_TARGET = 1000000;
export const hasLongTermActionTag = (value: { tags?: string[] }) =>
  value.tags?.includes(LONG_TERM_ACTION_TAG) ?? false;
export const isLongTermAction = (goal: Goal) => hasLongTermActionTag(goal);
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validateDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error('请选择有效日期');
}
export function textRequired(value: string, label: string) {
  if (!value?.trim()) throw new Error(`请填写${label}`);
}
export function units(amount: number, precision: number) {
  const scaled = amount * 10 ** precision;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(scaled)) ||
    Math.abs(scaled - Math.round(scaled)) > 1e-7
  )
    throw new Error('数量须为符合精度的正数');
  return Math.round(scaled);
}
export function validateMeasurement(m: Measurement) {
  if (m.kind === 'narrative') return;
  if (
    m.kind !== 'quantity' ||
    typeof m.distinctItems !== 'boolean' ||
    !Number.isInteger(m.precision) ||
    m.precision < 0 ||
    m.precision > 6
  )
    throw new Error('计量方式无效');
  textRequired(m.unit, '单位');
  units(m.target, m.precision);
  if (m.distinctItems && (m.precision !== 0 || !Number.isInteger(m.target)))
    throw new Error('不重复计数只支持整数对象');
}
export function goalProgress(state: FutureState, goal: Goal) {
  const events = state.events.filter(
    (e) =>
      e.goalId === goal.id &&
      e.status === 'valid' &&
      (!e.actionFeedback || e.actionFeedback.status === 'completed'),
  );
  const m = goal.measurement;
  if (m.kind === 'narrative')
    return {
      total: null,
      latest: [...events]
        .sort((a, b) => b.createdAt - a.createdAt)
        .find((e) => e.value.kind === 'narrative')?.value,
      reached: false,
    };
  const total = m.distinctItems
    ? new Set(
        events.flatMap((e) =>
          e.value.kind === 'quantity' && e.value.itemId ? [e.value.itemId] : [],
        ),
      ).size
    : events.reduce(
        (sum, e) => sum + (e.value.kind === 'quantity' ? units(e.value.amount, m.precision) : 0),
        0,
      ) /
      10 ** m.precision;
  return { total, latest: undefined, reached: total >= m.target };
}
export function stateFrom(value: unknown): FutureState {
  if (value === undefined) return emptyFutureState();
  const state = value as FutureState;
  const invalid = () => {
    throw new Error('未来数据结构或关联无效，请检查备份');
  };
  if (
    !state ||
    state.schemaVersion !== 1 ||
    !Number.isInteger(state.revision) ||
    state.revision < 0 ||
    !['visions', 'goals', 'events', 'items', 'revisions', 'closures', 'receipts'].every((k) =>
      Array.isArray(state[k as keyof FutureState]),
    )
  )
    return invalid();
  const nonempty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const practiceRecords = state.practiceRecords ?? [];
  if (!Array.isArray(practiceRecords)) return invalid();
  if (state.archiveOrigins !== undefined) {
    if (
      !state.archiveOrigins ||
      typeof state.archiveOrigins !== 'object' ||
      Array.isArray(state.archiveOrigins)
    )
      return invalid();
    for (const [proposalId, origin] of Object.entries(state.archiveOrigins)) {
      if (
        !nonempty(proposalId) ||
        !origin ||
        !['vision', 'goal', 'action'].includes(origin.kind) ||
        !nonempty(origin.id) ||
        (origin.fingerprint !== undefined && typeof origin.fingerprint !== 'string') ||
        !Array.isArray(origin.sourceRefs) ||
        origin.sourceRefs.some(
          (ref) =>
            !ref ||
            !['entry', 'message', 'future', 'principle', 'pattern', 'action'].includes(
              ref.source,
            ) ||
            !nonempty(ref.id) ||
            (ref.excerpt !== undefined && typeof ref.excerpt !== 'string') ||
            (ref.createdAt !== undefined &&
              (typeof ref.createdAt !== 'number' ||
                !Number.isFinite(ref.createdAt) ||
                ref.createdAt < 0)),
        )
      )
        return invalid();
    }
  }
  const timestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  for (const rows of [
    state.visions,
    state.goals,
    state.items,
    state.events,
    state.revisions,
    state.closures,
  ]) {
    if (
      rows.some((r) => !r || !nonempty(r.id)) ||
      new Set(rows.map((r) => r.id)).size !== rows.length
    )
      invalid();
  }
  const goalIds = new Set(state.goals.map((g) => g.id));
  const visionIds = new Set(state.visions.map((v) => v.id));
  const validateGoal = (g: Goal) => {
    if (
      !g ||
      !nonempty(g.title) ||
      !['active', 'paused', 'completed', 'ended'].includes(g.status) ||
      !Number.isInteger(g.revision) ||
      g.revision < 1 ||
      !timestamp(g.createdAt) ||
      !timestamp(g.updatedAt) ||
      !Array.isArray(g.tags) ||
      !g.tags.every(nonempty) ||
      (g.visionId && !visionIds.has(g.visionId))
    )
      invalid();
    validateMeasurement(g.measurement);
    if (g.startDate) validateDate(g.startDate);
    if (g.dueDate) validateDate(g.dueDate);
    if (g.startDate && g.dueDate && g.startDate > g.dueDate) invalid();
  };
  for (const v of state.visions)
    if (
      !nonempty(v.text) ||
      !['active', 'paused', 'archived'].includes(v.status) ||
      !Number.isInteger(v.revision) ||
      v.revision < 1 ||
      !timestamp(v.createdAt) ||
      !timestamp(v.updatedAt)
    )
      invalid();
  state.goals.forEach(validateGoal);
  for (const i of state.items) if (!goalIds.has(i.goalId) || !nonempty(i.label)) invalid();
  const validKeys = new Set<string>();
  for (const e of state.events) {
    const g = state.goals.find((g) => g.id === e.goalId);
    if (
      !g ||
      !nonempty(e.operationId) ||
      !nonempty(e.semanticKey) ||
      !timestamp(e.createdAt) ||
      !['valid', 'revoked'].includes(e.status) ||
      !['linked', 'standalone', 'source-deleted'].includes(e.sourceState) ||
      e.confirmedBy !== 'user' ||
      !Number.isInteger(e.goalRevision) ||
      e.goalRevision < 1 ||
      e.goalRevision > g.revision ||
      e.value?.kind !== g.measurement.kind
    )
      invalid();
    validateDate(e.occurredOn);
    if (
      e.actionFeedback &&
      (!['completed', 'partial', 'not_completed', 'cancelled'].includes(e.actionFeedback.status) ||
        !['continue', 'adjust', 'pause', 'end'].includes(e.actionFeedback.nextStep) ||
        !nonempty(e.actionFeedback.note))
    )
      invalid();
    if (e.sourceState === 'linked' && !nonempty(e.sourceEntryId)) invalid();
    if (e.status === 'valid') {
      if (validKeys.has(e.semanticKey)) invalid();
      validKeys.add(e.semanticKey);
    }
    if (e.value.kind === 'quantity' && g!.measurement.kind === 'quantity') {
      units(e.value.amount, g!.measurement.precision);
      if (
        g!.measurement.distinctItems &&
        (e.value.amount !== 1 ||
          !state.items.some(
            (i) => i.id === (e.value as { itemId?: string }).itemId && i.goalId === e.goalId,
          ))
      )
        invalid();
    } else if (e.value.kind === 'narrative' && !nonempty(e.value.note)) invalid();
    if (
      e.replacesEventId &&
      !state.events.some(
        (old) =>
          old.id === e.replacesEventId && old.goalId === e.goalId && old.status === 'revoked',
      )
    )
      invalid();
  }
  for (const r of state.revisions) {
    validateGoal(r.before);
    validateGoal(r.after);
    if (
      r.before.id !== r.after.id ||
      !goalIds.has(r.after.id) ||
      r.after.revision !== r.before.revision + 1 ||
      !timestamp(r.createdAt)
    )
      invalid();
  }
  for (const c of state.closures) {
    validateGoal(c.snapshot);
    if (
      c.goalId !== c.snapshot.id ||
      !goalIds.has(c.goalId) ||
      !['completed', 'ended'].includes(c.snapshot.status) ||
      !timestamp(c.createdAt) ||
      !Array.isArray(c.progressEventIds) ||
      !c.progressEventIds.every((id) =>
        state.events.some((e) => e.id === id && e.goalId === c.goalId),
      ) ||
      (c.total !== null && (!Number.isFinite(c.total) || c.total < 0))
    )
      invalid();
  }
  const practiceIds = new Set<string>();
  for (const record of practiceRecords) {
    if (
      !record ||
      !nonempty(record.id) ||
      practiceIds.has(record.id) ||
      !nonempty(record.actionId) ||
      !['completed', 'partial', 'not_completed', 'cancelled'].includes(record.status) ||
      !['continue', 'adjust', 'pause', 'end'].includes(record.nextStep) ||
      !nonempty(record.note) ||
      !timestamp(record.createdAt)
    )
      invalid();
    validateDate(record.occurredOn);
    practiceIds.add(record.id);
  }
  if (new Set(state.receipts.map((r) => r.operationId)).size !== state.receipts.length) invalid();
  for (const r of state.receipts)
    if (
      !nonempty(r.operationId) ||
      !nonempty(r.digest) ||
      !Number.isInteger(r.revision) ||
      r.revision < 1 ||
      r.revision > state.revision ||
      !Array.isArray(r.eventIds) ||
      !r.eventIds.every((id) =>
        state.events.some((e) => e.id === id && e.operationId === r.operationId),
      )
    )
      invalid();
  return state;
}
