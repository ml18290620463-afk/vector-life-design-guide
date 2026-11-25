import type { CognitiveObject, EvidencedByEdge, ScopedInEdge } from '../features/avatar/types';
import type { ActionItem, DiaryEntry, Principle } from '../types';
import type { FutureState } from '../types/future';
import { ontologyPrivacyToken } from './aiPrivacy';
import { readAvatarExtractionReceipt } from './avatarExtractionReceipt';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { withAvatarSession } from './avatarOntologySessionGuard';
import { validateAvatarOntology } from './avatarOntologyValidation';
import { computeOntologyEvidenceGate, resolveOntologyEvidence } from './avatarSourceEvidence';
import { DiaryStorageKeys as K } from './diaryStorage';
import { applyCognitiveConfirmation, type CognitiveRevision } from './avatarOntologyConfirmation';
import { avatarOntologyTransaction } from './avatarOntologyTransaction';
import { durableMemoryAssertionKey, memoryStatementKey } from './avatarStatementComparison';
import { isAccessibleDiaryEntry } from './avatarQueryPlan';

function inheritEvidenceTags(
  graph: { sessions?: import('../features/avatar/types').AvatarSession[]; edges: import('../features/avatar/types').OntologyEdge[] },
  objectId: string,
  evidence: EvidencedByEdge[],
  entries: DiaryEntry[],
  now: string,
) {
  const counts = new Map<string, number>();
  for (const edge of evidence) {
    const session = graph.sessions?.find((item) => item.id === edge.sessionId);
    const sourceIds = edge.sourceKind === 'chat_user_message'
      ? [session?.context.entryId, ...(session?.messages[edge.userMessageIndex ?? -1]?.references ?? []).map((ref) => ref.entryId)]
      : [edge.toId];
    for (const sourceId of new Set(sourceIds.filter((id): id is string => !!id))) {
      const entry = entries.find((item) => item.id === sourceId);
      if (!entry || !isAccessibleDiaryEntry(entry)) continue;
      for (const tag of new Set(entry.tags.map((value) => value.trim()).filter(Boolean)))
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  for (const [tagLabel, evidenceWeight] of counts) {
    const existing = graph.edges.find((edge): edge is ScopedInEdge =>
      edge.type === 'SCOPED_IN' && edge.fromId === objectId && edge.tagLabel === tagLabel &&
      edge.bindingSource === 'inherited_from_evidence');
    if (existing) existing.evidenceWeight += evidenceWeight;
    else graph.edges.push({ id: crypto.randomUUID(), schemaVersion: 2, type: 'SCOPED_IN',
      fromId: objectId, toId: tagLabel, createdAt: now, tagLabel,
      bindingSource: 'inherited_from_evidence', evidenceWeight });
  }
}

function inheritedScope(graph: { edges: import('../features/avatar/types').OntologyEdge[] }, objectId: string) {
  return graph.edges.filter((edge): edge is ScopedInEdge =>
    edge.type === 'SCOPED_IN' && edge.fromId === objectId)
    .map((edge) => edge.tagLabel).sort().join('|');
}

function sameAssertion(left: CognitiveObject, right: { statement: string; category: CognitiveObject['category'] }) {
  if (memoryStatementKey(left.statement) === memoryStatementKey(right.statement)) return true;
  if (left.category !== 'preferences_boundaries' || right.category !== left.category) return false;
  const facets = ['preference'];
  const a = durableMemoryAssertionKey(left.statement, facets);
  return a !== null && a === durableMemoryAssertionKey(right.statement, facets);
}

export interface AvatarCognitionSelection {
  extraction: object;
  sessionId: string;
  domain: CognitiveObject['domain'];
  category: CognitiveObject['category'];
  aiVisible: boolean;
}

/** Invoked only for the candidates explicitly selected by a review action.
 * Validate every receipt against the same pre-write graph, then commit all or none.
 * Staging stays candidate-only; an explicit review applies the live evidence gate
 * and commits confirmation or revision in this same transaction. */
async function persistSelectedCognitions(args: {
  expectedRevision: number;
  selections: readonly AvatarCognitionSelection[];
  review?: { statement: string; revision?: CognitiveRevision; replacesCandidateId?: string };
}) {
  if (args.selections.length < 1 || args.selections.length > 3)
    throw new Error('一次只能保存一至三条已选择的候选');
  if (new Set(args.selections.map((item) => item.extraction)).size !== args.selections.length)
    throw new Error('不得重复保存同一抽取候选');
  const expectedRevision = args.expectedRevision;
  const review = args.review ? structuredClone(args.review) : undefined;
  if (review?.revision && review.replacesCandidateId)
    throw new Error('候选编辑不能同时修订已确认观点');
  if (review && args.selections.length !== 1) throw new Error('一次只能确认一条已审核的认知');
  const selections = args.selections.map((selection) => {
    const input = { ...selection };
    const receipt = readAvatarExtractionReceipt(input.extraction);
    if (receipt.kind === 'goal')
      throw new Error('目标与经历必须通过各自的显式保存流程');
    if (review && review.statement.trim() !== receipt.statement.trim())
      throw new Error('审核内容已修改，请重新核验用户原话');
    if (receipt.action === 'propose_supersede' && review?.revision?.previousObjectId !== receipt.targetObjectId)
      throw new Error('修订目标已变化，请重新提炼');
    if (receipt.action === 'propose_supersede' && review?.revision?.reason !== receipt.revisionReason)
      throw new Error('修订理由已变化，请重新提炼');
    if (receipt.action === 'reinforce_existing' && review?.revision)
      throw new Error('证据强化不能同时修订观点');
    const domain = receipt.kind === 'pattern_candidate' ? 'my_understanding' : 'about_me';
    if (input.domain !== domain) throw new Error('候选分类与原始抽取不一致，请重新提炼');
    return { input, receipt };
  });
  return withAvatarSession((assertCurrent) =>
    avatarOntologyTransaction(
      [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
      (values) => {
        assertCurrent();
        const stored = values[AVATAR_ONTOLOGY_KEY];
        validateAvatarOntology(stored);
        if (stored.revision !== expectedRevision) throw new Error('认知资料已更新，请刷新后重试');
        const entries = (values[K.entries] ?? []) as DiaryEntry[];
        const token = ontologyPrivacyToken(
          stored,
          entries,
          values[K.future] as FutureState | undefined,
          (values[K.actions] ?? []) as ActionItem[],
          (values[K.principles] ?? []) as Principle[],
        );
        const next = structuredClone(stored);
        const objectIds: string[] = [];
        for (const { input, receipt } of selections) {
          if (receipt.aiPrivacyToken !== token) throw new Error('来源或权限已变化，请重新提炼');
          if (!receipt.evidenceAnchors.length || receipt.evidenceAnchors.length > 3)
            throw new Error('抽取证据数量无效');
          const now = new Date().toISOString();
          const replacedCandidate = review?.replacesCandidateId
            ? next.objects.find((item) => item.id === review.replacesCandidateId) : undefined;
          if (review?.replacesCandidateId && (!replacedCandidate || replacedCandidate.status !== 'candidate' ||
              replacedCandidate.domain !== input.domain || replacedCandidate.category !== input.category))
            throw new Error('待审核认知已变化，请重新审核');
          const id = replacedCandidate?.id ?? crypto.randomUUID();
          const edges: EvidencedByEdge[] = receipt.evidenceAnchors.map((anchor) => ({
            id: crypto.randomUUID(),
            schemaVersion: 2,
            type: 'EVIDENCED_BY',
            fromId: id,
            toId: anchor.sourceId,
            createdAt: now,
            sourceKind: 'chat_user_message',
            sessionId: input.sessionId,
            userMessageIndex: anchor.userMessageIndex,
            verbatimQuote: anchor.verbatimQuote,
            quoteVerifiedByServer: true,
            sourceOccurredAt: anchor.sourceOccurredAt,
            lastKnownSourceState: 'accessible',
          }));
          if (
            new Set(edges.map((edge) => edge.userMessageIndex)).size !== edges.length ||
            resolveOntologyEvidence(edges, entries, stored.sessions ?? [], Date.now(), token)
              .length !== edges.length
          )
            throw new Error('原始用户引文不可访问或已变化，请重新提炼');
          // Only a same-category, same-validity assertion can strengthen an existing
          // object. An explicit revision always creates a new lineage version.
          const candidateScope = (() => {
            const tagged = { edges: [...next.edges] };
            inheritEvidenceTags(tagged, id, edges, entries, now);
            return inheritedScope(tagged, id);
          })();
          const existing = !review?.revision && !replacedCandidate
            ? next.objects.find((item) =>
                item.domain === input.domain && item.category === input.category &&
                item.validity.mode === 'long_term' &&
                ['candidate', 'confirmed'].includes(item.status) &&
                inheritedScope(next, item.id) === candidateScope &&
                sameAssertion(item, { statement: receipt.statement, category: input.category }))
            : undefined;
          if (receipt.action === 'reinforce_existing' && existing?.id !== receipt.targetObjectId)
            throw new Error('同义目标已变化，请重新提炼');
          if (receipt.action === 'reinforce_existing' && existing?.status !== 'confirmed')
            throw new Error('证据强化仅可指向已确认认知');
          if (receipt.action === 'propose_supersede') {
            const target = next.objects.find((item) => item.id === receipt.targetObjectId);
            if (!target || target.status !== 'confirmed' || target.domain !== input.domain ||
                target.category !== input.category || target.validity.mode !== 'long_term' ||
                memoryStatementKey(target.statement) === memoryStatementKey(receipt.statement))
              throw new Error('修订目标已变化，请重新提炼');
            const priorScope = inheritedScope(next, target.id).split('|').filter(Boolean);
            const currentScope = candidateScope.split('|').filter(Boolean);
            if (priorScope.length && currentScope.length &&
                !currentScope.some((tag) => priorScope.includes(tag)))
              throw new Error('不同场域的观点不能直接替代，请保留为并存候选');
          }
          const tensionTarget = receipt.action === 'create_new' && receipt.replacesReferenceId
            ? next.objects.find((item) => item.id === receipt.replacesReferenceId)
            : undefined;
          if (receipt.replacesReferenceId && receipt.action === 'create_new') {
            if (!tensionTarget || tensionTarget.status !== 'confirmed' ||
                tensionTarget.domain !== input.domain || tensionTarget.category !== input.category ||
                memoryStatementKey(tensionTarget.statement) === memoryStatementKey(receipt.statement))
              throw new Error('张力目标已变化，请重新提炼');
            const priorScope = inheritedScope(next, tensionTarget.id);
            if (priorScope === candidateScope && tensionTarget.validity.mode === 'long_term')
              throw new Error('同场域同有效期的观点变化须走显式修订');
          }
          if (existing) {
            const fresh = edges.filter((edge) => !next.edges.some((old) =>
              old.type === 'EVIDENCED_BY' && old.fromId === existing.id &&
              old.toId === edge.toId && old.verbatimQuote === edge.verbatimQuote));
            if (fresh.length) {
              next.edges.push(...fresh.map((edge) => ({ ...edge, fromId: existing.id })));
              inheritEvidenceTags(next, existing.id, fresh, entries, now);
              existing.reinforcementCount += fresh.length;
              existing.updatedAt = now;
              existing.evidenceGate = computeOntologyEvidenceGate(
                existing,
                next.edges.filter((edge): edge is EvidencedByEdge =>
                  edge.type === 'EVIDENCED_BY' && edge.fromId === existing.id),
                entries, stored.sessions ?? [], Date.now(), token,
              );
            }
            objectIds.push(existing.id);
            if (review && existing.status === 'candidate' && existing.evidenceGate.isReadyForConfirmation)
              applyCognitiveConfirmation(next, existing.id, entries, token);
            continue;
          }
          const object: CognitiveObject = {
            id,
            schemaVersion: 2,
            domain: input.domain,
            category: input.category,
            statement: receipt.statement,
            status: 'candidate',
            validity: { mode: 'long_term', validFrom: now },
            privacy: {
              sensitivity: 'normal',
              aiVisible: input.aiVisible,
              traceabilityDegraded: false,
            },
            evidenceGate: computeOntologyEvidenceGate(
              { id, domain: input.domain },
              edges,
              entries,
              stored.sessions ?? [],
              Date.now(),
              token,
            ),
            confidenceScore: 0,
            reinforcementCount: 0,
            version: replacedCandidate?.version ?? 1,
            lineageId: replacedCandidate?.lineageId ?? id,
            origin: 'extracted_from_chat',
            ...(receipt.action === 'propose_supersede' ? {
              pendingRevision: { previousObjectId: receipt.targetObjectId!, reason: receipt.revisionReason! },
            } : {}),
            createdAt: replacedCandidate?.createdAt ?? now,
            updatedAt: now,
          };
          if (replacedCandidate) {
            next.objects = next.objects.filter((item) => item.id !== id);
            // An edited candidate is not a confirmed viewpoint revision. Replace
            // its evidence only after validating the freshly attested user edit.
            next.edges = next.edges.filter((edge) => edge.fromId !== id || edge.type !== 'EVIDENCED_BY');
          }
          next.objects.push(object);
          next.edges.push(...edges);
          inheritEvidenceTags(next, id, edges, entries, now);
          if (tensionTarget) {
            next.edges.push({ id: crypto.randomUUID(), schemaVersion: 2,
              type: 'TENSION_WITH', fromId: id, toId: tensionTarget.id, createdAt: now,
              targetKind: 'cognitive_object', status: 'active',
              tensionSummary: '不同场域或时效的表达并存，等待用户核验',
            });
          }
          objectIds.push(id);
          if (review) {
            if (object.evidenceGate.isReadyForConfirmation) {
              applyCognitiveConfirmation(next, id, entries, token, review.revision);
              delete object.pendingRevision;
            } else if (review.revision) {
              throw new Error('修订证据尚未达到确认门槛');
            }
          }
        }
        next.revision++;
        validateAvatarOntology(next);
        assertCurrent();
        values[AVATAR_ONTOLOGY_KEY] = next;
        return { graph: structuredClone(next), objectIds };
      },
      false,
      undefined,
      assertCurrent,
    ),
  );
}

/** Explicitly retain selected candidates without confirming them. */
export function stageAvatarCognitions(args: {
  expectedRevision: number;
  selections: readonly AvatarCognitionSelection[];
}) {
  return persistSelectedCognitions(args);
}

/** Called only by the explicit review button. A ready expression is confirmed in
 * the same transaction; an insufficient pattern remains a candidate. No other
 * extraction from the response is persisted. */
export async function saveReviewedAvatarCognition(
  args: AvatarCognitionSelection & {
    expectedRevision: number;
    statement: string;
    revision?: CognitiveRevision;
    replacesCandidateId?: string;
  },
) {
  const result = await persistSelectedCognitions({
    expectedRevision: args.expectedRevision,
    selections: [args],
    review: { statement: args.statement, revision: args.revision, replacesCandidateId: args.replacesCandidateId },
  });
  return { graph: result.graph, objectId: result.objectIds[0] };
}

/** The existing single-candidate explicit action uses the same atomic boundary. */
export async function stageAvatarCognition(
  args: AvatarCognitionSelection & {
    expectedRevision: number;
  },
) {
  const result = await stageAvatarCognitions({
    expectedRevision: args.expectedRevision,
    selections: [args],
  });
  return { graph: result.graph, objectId: result.objectIds[0] };
}
