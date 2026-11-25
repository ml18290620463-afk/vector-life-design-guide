import type { CognitiveObject, EvidencedByEdge } from '../features/avatar/types';
import type { DiaryEntry } from '../types';
import type { AvatarOntologySnapshot } from './avatarOntologyStore';
import { computeOntologyEvidenceGate, resolveOntologyEvidence } from './avatarSourceEvidence';

export interface OntologyRetrievalDiagnostics {
  privacyCount: number;
  expiryCount: number;
}

/** Read-only eligibility, recomputed from originals rather than persisted gate counters. */
export function selectAvatarOntologyContext(
  graph: AvatarOntologySnapshot,
  entries: DiaryEntry[],
  privacyToken: string,
  now = Date.now(),
  includeExpiredHistory = false,
  diagnostics?: OntologyRetrievalDiagnostics,
): Array<{ object: CognitiveObject; evidence: EvidencedByEdge[] }> {
  const edges = graph.edges.filter((edge): edge is EvidencedByEdge => edge.type === 'EVIDENCED_BY');
  return graph.objects.flatMap((object) => {
    const from = Date.parse(object.validity.validFrom);
    const until =
      object.validity.validUntil == null ? undefined : Date.parse(object.validity.validUntil);
    if (!object.privacy.aiVisible || object.privacy.traceabilityDegraded) {
      if (diagnostics) diagnostics.privacyCount++;
      return [];
    }
    if (
      object.validity.mode === 'staged' &&
      until !== undefined &&
      now >= until &&
      !includeExpiredHistory
    ) {
      if (diagnostics) diagnostics.expiryCount++;
    }
    if (
      (object.status !== 'confirmed' &&
        !(includeExpiredHistory && object.status === 'archived_expired')) ||
      !object.privacy.aiVisible ||
      object.privacy.traceabilityDegraded ||
      !Number.isFinite(from) ||
      from > now ||
      (object.validity.mode === 'staged' && until === undefined) ||
      (until !== undefined &&
        (!Number.isFinite(until) ||
          (now >= until && !(includeExpiredHistory && object.status === 'archived_expired'))))
    )
      return [];
    const owned = edges.filter((edge) => edge.fromId === object.id);
    const evidence = resolveOntologyEvidence(
      owned,
      entries,
      graph.sessions ?? [],
      now,
      privacyToken,
    );
    // One revoked source invalidates the whole cognition, even if remaining evidence meets quota.
    if (!owned.length || evidence.length !== owned.length) {
      if (diagnostics) diagnostics.privacyCount++;
      return [];
    }
    const gate = computeOntologyEvidenceGate(
      object,
      evidence,
      entries,
      graph.sessions ?? [],
      now,
      privacyToken,
    );
    return gate.isReadyForConfirmation ? [{ object, evidence }] : [];
  });
}
