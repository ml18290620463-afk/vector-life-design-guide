import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import type { CognitiveObject } from '../features/avatar/types';

const categories = {
  about_me: [
    'foundation_situation',
    'values_motivation',
    'preferences_boundaries',
    'capabilities_conditions',
  ],
  my_understanding: ['understanding_judgment', 'choices_tradeoffs', 'actions_relationships'],
};
const statuses = [
  'candidate',
  'confirmed',
  'superseded',
  'rejected',
  'retained_after_source_delete',
  'archived_expired',
];
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const fail = (message: string): never => {
  throw new Error(`认知资料校验失败：${message}`);
};

/** Reject corrupt backups atomically rather than silently dropping unknown rows. */
export function validateAvatarOntology(value: unknown): asserts value is AvatarOntologySnapshot {
  if (
    !record(value) ||
    value.ontologySchemaVersion !== 2 ||
    !count(value.revision) ||
    !Array.isArray(value.objects) ||
    !Array.isArray(value.edges)
  )
    fail('版本或集合');
  const snapshot = value as unknown as AvatarOntologySnapshot;
  if (
    snapshot.migrationCheckpointRequired !== undefined &&
    snapshot.migrationCheckpointRequired !== true
  )
    fail('迁移快照标记');
  if (snapshot.sessions !== undefined) {
    if (!Array.isArray(snapshot.sessions) || snapshot.sessions.length > 18) fail('会话集合');
    const sessionIds = new Set<string>();
    for (const session of snapshot.sessions) {
      if (
        !record(session) ||
        !text(session.id) ||
        sessionIds.has(session.id) ||
        !record(session.context) ||
        !['capture', 'distill', 'recall', 'decide', 'review', 'general'].includes(session.mode) ||
        session.context.mode !== session.mode ||
        !['now', 'past-detail', 'past-search', 'future', 'action-review', 'global'].includes(
          session.context.source,
        ) ||
        ![session.createdAt, session.updatedAt].every(
          (timestamp) => typeof timestamp === 'number' && Number.isFinite(timestamp),
        ) ||
        session.updatedAt < session.createdAt ||
        !Array.isArray(session.references) ||
        !session.references.every(
          (reference) =>
            record(reference) &&
            text(reference.entryId) &&
            typeof reference.title === 'string' &&
            typeof reference.excerpt === 'string' &&
            typeof reference.reason === 'string' &&
            typeof reference.date === 'number' &&
            Number.isFinite(reference.date),
        ) ||
        !Array.isArray(session.messages) ||
        session.messages.length > 600
      )
        fail('会话来源');
      sessionIds.add(session.id);
      const messageIds = new Set<string>();
      for (const message of session.messages) {
        if (
          !record(message) ||
          !text(message.id) ||
          messageIds.has(message.id) ||
          !['user', 'assistant', 'system'].includes(message.role) ||
          !['text', 'audio', 'record_preview'].includes(message.type) ||
          typeof message.content !== 'string' ||
          !date(message.created_at)
        )
          fail('会话消息');
        messageIds.add(message.id);
      }
    }
  }
  const objects = new Map<string, CognitiveObject>();
  for (const raw of snapshot.objects) {
    if (!record(raw)) fail('认知对象');
    const o = raw as unknown as CognitiveObject;
    if (
      !text(o.id) ||
      objects.has(o.id) ||
      o.schemaVersion !== 2 ||
      !text(o.statement) ||
      !text(o.lineageId) ||
      !count(o.version) ||
      o.version < 1 ||
      !date(o.createdAt) ||
      !date(o.updatedAt) ||
      Date.parse(o.updatedAt) < Date.parse(o.createdAt)
    )
      fail('认知标识或时间');
    if (
      !Object.hasOwn(categories, o.domain) ||
      !categories[o.domain].includes(o.category) ||
      !statuses.includes(o.status) ||
      !['extracted_from_chat', 'distilled_from_record', 'user_manual'].includes(o.origin) ||
      !unit(o.confidenceScore) ||
      !count(o.reinforcementCount)
    )
      fail('认知分类');
    if (o.pendingRevision &&
        (o.status !== 'candidate' || !text(o.pendingRevision.previousObjectId) ||
         !text(o.pendingRevision.reason))) fail('待审核修订');
    const v = o.validity;
    if (
      !record(v) ||
      !['long_term', 'staged'].includes(v.mode) ||
      !date(v.validFrom) ||
      (v.mode === 'staged' &&
        (!date(v.validUntil) || Date.parse(v.validUntil) <= Date.parse(v.validFrom))) ||
      (v.lastVerifiedAt != null && !date(v.lastVerifiedAt))
    )
      fail('有效期');
    const p = o.privacy;
    if (
      !record(p) ||
      !['normal', 'sensitive', 'high'].includes(p.sensitivity) ||
      typeof p.aiVisible !== 'boolean' ||
      typeof p.traceabilityDegraded !== 'boolean' ||
      p.traceabilityDegraded !== (o.status === 'retained_after_source_delete')
    )
      fail('隐私状态');
    const g = o.evidenceGate;
    if (
      !record(g) ||
      typeof g.requiresMultiSourceGate !== 'boolean' ||
      g.requiresMultiSourceGate !== (o.domain === 'my_understanding') ||
      typeof g.isReadyForConfirmation !== 'boolean' ||
      ![
        g.independentExperienceCount,
        g.distinctUserMessageCount,
        g.distinctDateCount,
        g.distinctSessionCount,
      ].every(count)
    )
      fail('证据门槛');
    const ready = g.requiresMultiSourceGate
      ? (g.independentExperienceCount >= 2 || g.distinctUserMessageCount >= 3) &&
        (g.distinctDateCount >= 2 || g.distinctSessionCount >= 2)
      : g.independentExperienceCount + g.distinctUserMessageCount > 0;
    if (
      ready !== g.isReadyForConfirmation ||
      (o.status === 'confirmed' && (!ready || !date(o.confirmedAt)))
    )
      fail('确认门槛');
    if (o.confirmedAt != null && !date(o.confirmedAt)) fail('确认时间');
    if (
      o.guardrail &&
      (typeof o.guardrail.enabled !== 'boolean' ||
        !Array.isArray(o.guardrail.triggerTags) ||
        !o.guardrail.triggerTags.every(text) ||
        !text(o.guardrail.conditionSummary) ||
        !text(o.guardrail.reminderDirective))
    )
      fail('提醒规则');
    objects.set(o.id, o);
  }
  const ids = new Set<string>();
  const successors = new Set<string>();
  const predecessors = new Set<string>();
  for (const e of snapshot.edges) {
    if (
      !record(e) ||
      !text(e.id) ||
      ids.has(e.id) ||
      e.schemaVersion !== 2 ||
      !date(e.createdAt) ||
      !objects.has(e.fromId) ||
      !text(e.toId)
    )
      fail('关系标识或端点');
    ids.add(e.id);
    switch (e.type) {
      case 'EVIDENCED_BY':
        if (
          !['now_entry', 'past_experience', 'action_review', 'chat_user_message'].includes(
            e.sourceKind,
          ) ||
          !text(e.verbatimQuote) ||
          typeof e.quoteVerifiedByServer !== 'boolean' ||
          !date(e.sourceOccurredAt) ||
          !['accessible', 'restricted_or_revoked', 'deleted'].includes(e.lastKnownSourceState)
        )
          fail('证据关系');
        if (
          e.sourceKind === 'chat_user_message' &&
          (!text(e.sessionId) || !count(e.userMessageIndex))
        )
          fail('用户消息索引');
        break;
      case 'SCOPED_IN':
        if (
          !text(e.tagLabel) ||
          !['inherited_from_evidence', 'user_assigned'].includes(e.bindingSource) ||
          !count(e.evidenceWeight)
        )
          fail('标签关系');
        break;
      case 'TENSION_WITH':
        if (
          !['cognitive_object', 'future_goal', 'action_item'].includes(e.targetKind) ||
          !['active', 'resolved', 'dismissed'].includes(e.status) ||
          !text(e.tensionSummary) ||
          (e.targetKind === 'cognitive_object' && (!objects.has(e.toId) || e.toId === e.fromId))
        )
          fail('张力关系');
        break;
      case 'SUPERSEDES': {
        const previous = objects.get(e.toId);
        const current = objects.get(e.fromId)!;
        if (
          !previous ||
          previous.id === current.id ||
          previous.status !== 'superseded' ||
          previous.domain !== current.domain ||
          previous.category !== current.category ||
          previous.lineageId !== current.lineageId ||
          previous.version + 1 !== current.version ||
          !date(e.confirmedByUserAt) ||
          successors.has(e.toId) ||
          predecessors.has(e.fromId)
        )
          fail('修订谱系');
        successors.add(e.toId);
        predecessors.add(e.fromId);
        break;
      }
      default:
        fail('不支持的关系');
    }
  }
  const lineageVersions = new Set<string>();
  for (const object of objects.values()) {
    const key = JSON.stringify([object.lineageId, object.version]);
    if (lineageVersions.has(key)) fail('重复的谱系版本');
    lineageVersions.add(key);
    if (object.version > 1 && !predecessors.has(object.id)) fail('修订版本缺少前序关系');
  }
  // Versions increase strictly along each edge, so a cycle cannot pass validation.
}

export function getCognitiveLineage(
  snapshot: AvatarOntologySnapshot,
  lineageId: string,
): CognitiveObject[] {
  validateAvatarOntology(snapshot);
  return structuredClone(
    snapshot.objects.filter((o) => o.lineageId === lineageId).sort((a, b) => a.version - b.version),
  );
}
