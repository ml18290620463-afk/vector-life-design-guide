import type { CognitiveObject, EvidencedByEdge } from '../features/avatar/types';
import type { ActionItem, DiaryEntry, Principle } from '../types';
import type { FutureState } from '../types/future';
import { ontologyPrivacyToken } from './aiPrivacy';
import { readExperienceCandidateReceipt } from './avatarExperienceReceipt';
import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { avatarOntologyTransaction } from './avatarOntologyTransaction';
import { validateAvatarOntology } from './avatarOntologyValidation';
import { computeOntologyEvidenceGate, resolveOntologyEvidence } from './avatarSourceEvidence';
import { DiaryStorageKeys as K } from './diaryStorage';

/** Existing Past extraction stages proposals only; confirmation belongs to the review UI. */
export async function stageExperienceCandidates(
  candidates: object[], expectedRevision: number, assertCurrent: () => void,
) {
  const receipts = candidates.map(readExperienceCandidateReceipt);
  if (!receipts.length) return;
  await avatarOntologyTransaction(
    [AVATAR_ONTOLOGY_KEY, K.entries, K.future, K.actions, K.principles],
    (values) => {
      assertCurrent();
      const graph = values[AVATAR_ONTOLOGY_KEY];
      validateAvatarOntology(graph);
      if (graph.revision !== expectedRevision) throw new Error('认知资料已更新，请重新提炼');
      const entries = (values[K.entries] ?? []) as DiaryEntry[];
      const token = ontologyPrivacyToken(graph, entries, values[K.future] as FutureState | undefined,
        (values[K.actions] ?? []) as ActionItem[], (values[K.principles] ?? []) as Principle[]);
      const next = structuredClone(graph);
      for (const { candidate, token: requestToken } of receipts) {
        if (requestToken !== token) throw new Error('来源或权限已变化，请重新提炼');
        if (candidate.status !== 'candidate' || ['experience', 'commitment', 'state'].includes(candidate.nature) ||
          candidate.facets.includes('aspirational_self')) continue;
        const inferred = candidate.nature === 'inferred';
        const preference = candidate.facets.some((f) => ['preference', 'boundary', 'aversion'].includes(f));
        const domain = inferred ? 'my_understanding' : 'about_me';
        const category: CognitiveObject['category'] = inferred
          ? candidate.facets.some((f) => ['behavioral_pattern', 'relational_pattern', 'relationship_view'].includes(f))
            ? 'actions_relationships' : 'understanding_judgment'
          : preference ? 'preferences_boundaries'
            : candidate.facets.some((f) => ['value', 'motivation'].includes(f)) ? 'values_motivation'
              : candidate.facets.some((f) => ['skill', 'constraint'].includes(f)) ? 'capabilities_conditions'
                : 'foundation_situation';
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const refs = candidate.sourceRefs.filter((ref) => ref.excerpt?.trim());
        const edges: EvidencedByEdge[] = refs.map((ref) => ({
          id: crypto.randomUUID(), schemaVersion: 2, type: 'EVIDENCED_BY', fromId: id,
          toId: ref.id, createdAt: now, sourceKind: 'past_experience',
          verbatimQuote: ref.excerpt!, quoteVerifiedByServer: true,
          sourceOccurredAt: new Date(entries.find((e) => e.id === ref.id)?.createdAt ?? 0).toISOString(),
          lastKnownSourceState: 'accessible',
        }));
        if (!edges.length || resolveOntologyEvidence(edges, entries, [], Date.now(), token).length !== edges.length)
          throw new Error('原始经历引文不可访问，请重新提炼');
        // Reprocessing the same evidence cannot multiply a candidate or its support.
        if (next.objects.some((object) => object.statement === candidate.statement && object.domain === domain &&
          next.edges.some((edge) => edge.type === 'EVIDENCED_BY' && edge.fromId === object.id &&
            edges.some((fresh) => fresh.toId === edge.toId && fresh.verbatimQuote === edge.verbatimQuote)))) continue;
        const object: CognitiveObject = {
          id, schemaVersion: 2, domain, category, statement: candidate.statement, status: 'candidate',
          validity: { mode: 'long_term', validFrom: now },
          privacy: { sensitivity: candidate.sensitivity === 'private' ? 'high' : candidate.sensitivity, aiVisible: false, traceabilityDegraded: false },
          evidenceGate: computeOntologyEvidenceGate({ id, domain }, edges, entries, [], Date.now(), token),
          confidenceScore: 0, reinforcementCount: 0, version: 1, lineageId: id,
          origin: 'distilled_from_record', createdAt: now, updatedAt: now,
        };
        next.objects.push(object); next.edges.push(...edges);
      }
      if (next.objects.length !== graph.objects.length) {
        next.revision++;
        validateAvatarOntology(next);
        assertCurrent(); values[AVATAR_ONTOLOGY_KEY] = next;
      }
    }, false, undefined, assertCurrent,
  );
}
