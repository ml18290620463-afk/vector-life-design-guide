import type { DiaryEntry, ExperienceEdge, ExperienceFeedbackOutcome } from '../types';

const POSITIVE_OUTCOMES = new Set<ExperienceFeedbackOutcome>(['helpful', 'partial']);

const confirmedRelationKind = (
  source: Pick<DiaryEntry, 'principleFeedback'>,
  candidate: DiaryEntry,
): ExperienceEdge['kind'] | null => {
  for (const sourceFeedback of source.principleFeedback ?? []) {
    const candidateFeedback = candidate.principleFeedback?.find(
      (feedback) => feedback.principleId === sourceFeedback.principleId,
    );
    if (!candidateFeedback) continue;
    const sourcePositive = POSITIVE_OUTCOMES.has(sourceFeedback.outcome);
    const candidatePositive = POSITIVE_OUTCOMES.has(candidateFeedback.outcome);
    if (sourcePositive && candidatePositive) return 'supports';
    if (
      (sourcePositive && candidateFeedback.outcome === 'unhelpful') ||
      (candidatePositive && sourceFeedback.outcome === 'unhelpful')
    ) return 'contradicts';
  }
  return null;
};

export const buildExperienceEdges = (
  source: Pick<DiaryEntry, 'principleFeedback'> & Partial<Pick<DiaryEntry, 'id'>>,
  candidates: DiaryEntry[],
  now = Date.now(),
): ExperienceEdge[] =>
  [...new Map(candidates.filter((entry) => !source.id || entry.id !== source.id).map((entry) => [entry.id, entry])).values()].map(
    (candidate) => {
      const kind = confirmedRelationKind(source, candidate);
      return {
        targetEntryId: candidate.id,
        kind: kind ?? 'sameTheme',
        confidence: kind ? 1 : 0.7,
        createdAt: now,
        source: kind ? 'user-confirmed' : 'local-semantic',
      };
    },
  );

export const updateRelatedEntryIds = (
  entries: DiaryEntry[],
  entryId: string,
  relatedEntryIds: string[],
  now = Date.now(),
): DiaryEntry[] => {
  const normalizedIds = [...new Set(relatedEntryIds.filter((id) => id && id !== entryId))];
  const sourceEntry = entries.find((entry) => entry.id === entryId);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const relatedEntries = normalizedIds.flatMap((id) => {
    const entry = entriesById.get(id);
    return entry ? [entry] : [];
  });
  const confirmedEdges = new Map(
    (sourceEntry?.experienceEdges ?? [])
      .filter((edge) => edge.source === 'user-confirmed')
      .map((edge) => [edge.targetEntryId, edge]),
  );
  return entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          relatedEntryIds: normalizedIds.length > 0 ? normalizedIds : undefined,
          experienceEdges:
            sourceEntry && relatedEntries.length > 0
              ? buildExperienceEdges(sourceEntry, relatedEntries, now).map(
                  (edge) => confirmedEdges.get(edge.targetEntryId) ?? edge,
                )
              : undefined,
          updatedAt: now,
        }
      : entry,
  );
};

export const confirmExperienceEdge = (
  entry: DiaryEntry,
  targetEntryId: string,
  kind: Extract<ExperienceEdge['kind'], 'supports' | 'contradicts'>,
  now = Date.now(),
): DiaryEntry => {
  if (!targetEntryId || targetEntryId === entry.id) return entry;
  const currentEdges = entry.experienceEdges ?? [];
  const confirmedEdge: ExperienceEdge = {
    targetEntryId,
    kind,
    confidence: 1,
    createdAt: now,
    source: 'user-confirmed',
  };
  const hasTarget = currentEdges.some((edge) => edge.targetEntryId === targetEntryId);
  return {
    ...entry,
    relatedEntryIds: [...new Set([...(entry.relatedEntryIds ?? []), targetEntryId])],
    experienceEdges: hasTarget
      ? currentEdges.map((edge) => (edge.targetEntryId === targetEntryId ? confirmedEdge : edge))
      : [...currentEdges, confirmedEdge],
    updatedAt: now,
  };
};

export const resetExperienceEdge = (
  entry: DiaryEntry,
  targetEntryId: string,
  now = Date.now(),
): DiaryEntry => {
  if (!targetEntryId || targetEntryId === entry.id) return entry;
  const currentEdges = entry.experienceEdges ?? [];
  if (!currentEdges.some((edge) => edge.targetEntryId === targetEntryId)) return entry;
  const semanticEdge: ExperienceEdge = {
    targetEntryId,
    kind: 'sameTheme',
    confidence: 0.7,
    createdAt: now,
    source: 'local-semantic',
  };
  return {
    ...entry,
    relatedEntryIds: [...new Set([...(entry.relatedEntryIds ?? []), targetEntryId])],
    experienceEdges: currentEdges.map((edge) =>
      edge.targetEntryId === targetEntryId ? semanticEdge : edge,
    ),
    updatedAt: now,
  };
};
