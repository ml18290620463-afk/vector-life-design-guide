import type {
  AvatarExtractionCandidate,
  AvatarMemoryFacet,
  AvatarMemoryNature,
  AvatarMemorySensitivity,
} from '../features/avatar/types';
import type {
  AvatarExtractionFacet,
  AvatarGrowthContext,
  AvatarMemoryCandidate,
  AvatarStructuredExtraction,
} from './avatarIntelligence';

const stableId = (prefix: string, parts: Array<string | number | undefined>): string => {
  const input = parts.filter((part) => part !== undefined && part !== '').join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
};

const facetToAtomicFacet = (facet: AvatarExtractionFacet): AvatarMemoryFacet => {
  switch (facet) {
    case 'preference':
      return 'preference';
    case 'boundary':
      return 'boundary';
    case 'goal':
      return 'aspirational_self';
    case 'commitment':
      return 'motivation';
    case 'thought':
      return 'cognitive_pattern';
    case 'emotion':
      return 'emotional_trigger';
    case 'action':
      return 'behavioral_pattern';
    case 'person':
      return 'relationship_view';
    case 'result':
      return 'constraint';
    case 'event':
    default:
      return 'domain_background';
  }
};

const facetToNature = (facet: AvatarExtractionFacet): AvatarMemoryNature => {
  if (facet === 'commitment') return 'commitment';
  if (facet === 'emotion') return 'state';
  if (facet === 'event' || facet === 'result' || facet === 'action') return 'experience';
  if (facet === 'preference' || facet === 'boundary' || facet === 'goal') return 'explicit';
  return 'inferred';
};

const facetToSensitivity = (facet: AvatarExtractionFacet): AvatarMemorySensitivity =>
  facet === 'boundary' || facet === 'emotion' || facet === 'person' ? 'sensitive' : 'normal';

const recurringPatternFacets = new Set<AvatarMemoryFacet>([
  'cognitive_pattern',
  'behavioral_pattern',
  'emotional_pattern',
  'relational_pattern',
]);

const isRecurringPatternCandidate = (candidate: AvatarExtractionCandidate) =>
  candidate.facets.some((facet) => recurringPatternFacets.has(facet));

export const withoutRecurringPatternFacets = (
  candidate: AvatarExtractionCandidate,
): AvatarExtractionCandidate | null => {
  const facets = candidate.facets.filter((facet) => !recurringPatternFacets.has(facet));
  return facets.length ? { ...candidate, facets } : null;
};

const hasIndependentEntryEvidence = (candidate: AvatarExtractionCandidate) =>
  new Set(
    candidate.sourceRefs
      .filter((reference) => reference.source === 'entry')
      .map((reference) => reference.id),
  ).size >= 2;

export const buildAtomicMemoryCandidates = (
  extraction: AvatarStructuredExtraction,
  memoryCandidates: AvatarMemoryCandidate[],
  evidenceSources: AvatarGrowthContext['evidenceSources'] = [],
): AvatarExtractionCandidate[] => {
  const durable = new Set(memoryCandidates.map((candidate) => candidate.statement));
  const baseRefs = extraction.sourceEntryId
    ? [
        {
          source: 'entry' as const,
          id: extraction.sourceEntryId,
          createdAt: extraction.occurredAt,
          supplementId: extraction.sourceSupplementId,
        },
      ]
    : [];
  const candidates: AvatarExtractionCandidate[] = extraction.signals
    .filter((signal) => durable.has(signal.text) && signal.facet !== 'emotion')
    .map((signal) => ({
      id: stableId('atomic', [
        signal.facet,
        signal.text,
        extraction.sourceEntryId,
        extraction.sourceSupplementId,
      ]),
      statement: signal.text,
      nature: facetToNature(signal.facet),
      facets: [facetToAtomicFacet(signal.facet)],
      tags: extraction.eventTags,
      contexts: extraction.eventTags,
      sourceRefs: [
        ...baseRefs,
        ...signal.evidence.map((evidence) => {
          const sourceIndex =
            evidence.source === 'message' ? Number(evidence.id.replace(/^message-/, '')) - 1 : -1;
          const mappedSource = Number.isInteger(sourceIndex)
            ? evidenceSources[sourceIndex]
            : undefined;
          return {
            source: mappedSource
              ? ('entry' as const)
              : evidence.source === 'understanding'
                ? ('pattern' as const)
                : evidence.source,
            id: mappedSource?.entryId ?? evidence.id,
            excerpt: evidence.excerpt,
            ...(typeof mappedSource?.createdAt === 'number'
              ? { createdAt: mappedSource.createdAt }
              : typeof evidence.createdAt === 'number'
                ? { createdAt: evidence.createdAt }
                : {}),
            ...(mappedSource?.supplementId ? { supplementId: mappedSource.supplementId } : {}),
          };
        }),
      ],
      confidence: signal.confidence,
      status: 'candidate' as const,
      sensitivity: facetToSensitivity(signal.facet),
      validFrom: extraction.occurredAt,
      createdAt: extraction.occurredAt,
    }));
  // Multiple facets describe one statement from the same extraction, not separate memories.
  // Never deduplicate historical records or similar statements from independent sources.
  const grouped = new Map<string, AvatarExtractionCandidate>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.statement);
    if (!existing) {
      grouped.set(candidate.statement, candidate);
      continue;
    }
    existing.facets = [...new Set([...existing.facets, ...candidate.facets])];
    existing.sourceRefs.push(
      ...candidate.sourceRefs.filter(
        (ref) =>
          !existing.sourceRefs.some(
            (saved) =>
              saved.source === ref.source && saved.id === ref.id && saved.excerpt === ref.excerpt,
          ),
      ),
    );
    if (existing.nature !== candidate.nature) existing.nature = 'inferred';
    existing.confidence = Math.min(existing.confidence, candidate.confidence);
    if (candidate.sensitivity === 'sensitive') existing.sensitivity = 'sensitive';
  }
  // A single experience can support a fact or an explicit preference, but it cannot
  // establish a recurring pattern about the person. Keep the original evidence for
  // later comparison and wait for a second independent experience.
  return [...grouped.values()].flatMap((candidate) => {
    if (!isRecurringPatternCandidate(candidate) || hasIndependentEntryEvidence(candidate)) {
      return [candidate];
    }
    const factualCandidate = withoutRecurringPatternFacets(candidate);
    return factualCandidate ? [factualCandidate] : [];
  });
};
