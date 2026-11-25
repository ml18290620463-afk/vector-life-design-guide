import type { EvidencedByEdge } from '../features/avatar/types';
import type { DiaryEntry } from '../types';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { computeOntologyEvidenceGate, resolveOntologyEvidence } from './avatarSourceEvidence';

export interface CognitiveRevision {
  previousObjectId: string;
  reason?: string;
  triggerRecordId?: string;
}
const fail = (message: string): never => {
  throw new Error(`认知资料校验失败：${message}`);
};

/** Mutates only the transaction's private clone. The caller owns authorization,
 * revision checking and atomic persistence; this function never writes storage. */
export function applyCognitiveConfirmation(
  next: AvatarOntologySnapshot,
  objectId: string,
  entries: DiaryEntry[],
  privacyToken: string,
  revision?: CognitiveRevision,
  now = Date.now(),
): void {
  const object = next.objects.find((item) => item.id === objectId);
  if (!object || object.status !== 'candidate') fail('仅可确认待审核候选');
  const candidate = object!;
  const evidence = next.edges.filter(
    (edge): edge is EvidencedByEdge => edge.type === 'EVIDENCED_BY' && edge.fromId === objectId,
  );
  const sessions = next.sessions ?? [];
  const live = resolveOntologyEvidence(evidence, entries, sessions, now, privacyToken);
  const gate = computeOntologyEvidenceGate(
    candidate,
    evidence,
    entries,
    sessions,
    now,
    privacyToken,
  );
  if (!live.length || live.length !== evidence.length || !gate.isReadyForConfirmation)
    fail('原始证据不可访问或未达到确认门槛');
  candidate.evidenceGate = gate;
  candidate.status = 'confirmed';
  candidate.confirmedAt = new Date(now).toISOString();
  candidate.updatedAt = candidate.confirmedAt;
  candidate.validity.lastVerifiedAt = candidate.confirmedAt;
  // A confirmed preference or tradeoff can be offered as an optional decision
  // guardrail. Keep it disabled until the user explicitly enables it.
  if (
    !candidate.guardrail &&
    (candidate.category === 'preferences_boundaries' || candidate.category === 'choices_tradeoffs')
  ) {
    const tags = next.edges
      .filter((edge) => edge.type === 'SCOPED_IN' && edge.fromId === candidate.id)
      .map((edge) => edge.type === 'SCOPED_IN' ? edge.tagLabel : '');
    candidate.guardrail = {
      enabled: false,
      triggerTags: [...new Set(tags)],
      conditionSummary: candidate.statement,
      reminderDirective: '对照这条已确认的个人取舍，核对当前条件与过去结果；仅作提醒，不替用户决定。',
    };
  }
  if (revision) {
    if (
      revision.triggerRecordId &&
      !evidence.some(
        (edge) => edge.sourceKind !== 'chat_user_message' && edge.toId === revision.triggerRecordId,
      )
    )
      fail('修订触发记录必须来自已核验的原始证据');
    const previous = next.objects.find((item) => item.id === revision.previousObjectId);
    if (
      !previous ||
      previous.id === candidate.id ||
      previous.status !== 'confirmed' ||
      !previous.confirmedAt ||
      previous.domain !== candidate.domain ||
      previous.category !== candidate.category ||
      previous.statement.trim() === candidate.statement.trim() ||
      next.edges.some((edge) => edge.type === 'SUPERSEDES' && edge.toId === previous.id)
    )
      fail('修订必须指向当前已确认的同类观点');
    const predecessor = previous!;
    // Both status changes and the edge commit together after the new evidence is verified.
    candidate.lineageId = predecessor.lineageId;
    candidate.version = predecessor.version + 1;
    predecessor.status = 'superseded';
    predecessor.updatedAt = candidate.confirmedAt;
    next.edges.push({
      id: crypto.randomUUID(),
      schemaVersion: 2,
      type: 'SUPERSEDES',
      fromId: candidate.id,
      toId: predecessor.id,
      createdAt: candidate.confirmedAt,
      confirmedByUserAt: candidate.confirmedAt,
      revisionReason: revision.reason,
      triggerRecordId: revision.triggerRecordId,
    });
  }
}
