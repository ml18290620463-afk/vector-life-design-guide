import { AVATAR_ONTOLOGY_KEY } from './avatarOntologyKey';
import { previewSourceDeletionImpact, validateAvatarOntology } from './avatarOntologyStore';

/** Mutates only an existing v2 graph. Never initializes or touches paused legacy data. */
export function deleteOntologySources(
  values: Record<string, unknown>,
  sourceIds: string[],
  retain: boolean,
): Set<string> {
  const graph = values[AVATAR_ONTOLOGY_KEY];
  if (graph === undefined) return new Set();
  validateAvatarOntology(graph);
  const deleted = new Set(sourceIds);
  const removedSessions = new Set(
    graph.sessions
      ?.filter(
        (session) =>
          deleted.has(session.context.entryId ?? '') ||
          session.messages.some((message) =>
            message.references?.some((reference) => deleted.has(reference.entryId)),
          ),
      )
      .map((session) => session.id),
  );
  const removedEdges = new Set(
    sourceIds.flatMap((id) =>
      previewSourceDeletionImpact(id, graph).flatMap((impact) => impact.removedEvidenceIds),
    ),
  );
  for (const edge of graph.edges) {
    if (edge.type === 'EVIDENCED_BY' && removedSessions.has(edge.sessionId ?? ''))
      removedEdges.add(edge.id);
  }
  const affected = new Set(
    graph.edges.filter((edge) => removedEdges.has(edge.id)).map((edge) => edge.fromId),
  );
  graph.sessions = graph.sessions?.filter((session) => !removedSessions.has(session.id));
  graph.objects = graph.objects.flatMap((object) => {
    if (!affected.has(object.id)) return [object];
    if (!retain) return [];
    return [
      {
        ...object,
        status: 'retained_after_source_delete' as const,
        privacy: { ...object.privacy, aiVisible: false, traceabilityDegraded: true },
        updatedAt: new Date().toISOString(),
      },
    ];
  });
  const objects = new Map(graph.objects.map((object) => [object.id, object]));
  graph.edges = graph.edges.filter((edge) => {
    if (!objects.has(edge.fromId) || removedEdges.has(edge.id)) return false;
    if (edge.type === 'SUPERSEDES') return objects.get(edge.toId)?.status === 'superseded';
    if (edge.type === 'TENSION_WITH' && edge.targetKind === 'cognitive_object')
      return objects.has(edge.toId);
    if (edge.type === 'SCOPED_IN' && edge.bindingSource === 'inherited_from_evidence')
      return !affected.has(edge.fromId);
    return true;
  });
  // A revision may survive a deleted trigger, but must not retain that source identifier.
  graph.edges = graph.edges.map((edge) => {
    if (edge.type !== 'SUPERSEDES' || !deleted.has(edge.triggerRecordId ?? '')) return edge;
    const { triggerRecordId: _triggerRecordId, ...remaining } = edge;
    return remaining;
  });
  graph.revision += 1;
  validateAvatarOntology(graph);
  return retain ? new Set() : affected;
}
