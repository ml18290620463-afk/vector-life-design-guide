import type { CognitiveObject } from '../../features/avatar/types';
import type { DiaryEntry } from '../../types';
import type { AvatarOntologySnapshot } from '../../services/avatarOntologyStore';

export function cognition(overrides: Partial<CognitiveObject> = {}): CognitiveObject {
  return {
    id: 'p',
    schemaVersion: 2,
    domain: 'my_understanding',
    category: 'understanding_judgment',
    statement: '行动前会准备',
    status: 'confirmed',
    validity: { mode: 'long_term', validFrom: new Date(0).toISOString() },
    privacy: { sensitivity: 'normal', aiVisible: true, traceabilityDegraded: false },
    evidenceGate: {
      requiresMultiSourceGate: true,
      independentExperienceCount: 0,
      distinctUserMessageCount: 0,
      distinctDateCount: 0,
      distinctSessionCount: 0,
      isReadyForConfirmation: false,
    },
    confidenceScore: 1,
    reinforcementCount: 0,
    version: 1,
    lineageId: 'p',
    origin: 'distilled_from_record',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    confirmedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

export function evidenceGraph(
  objects: CognitiveObject[],
  entries: DiaryEntry[],
): AvatarOntologySnapshot {
  return {
    ontologySchemaVersion: 2,
    revision: 0,
    objects,
    edges: objects.flatMap((object) =>
      entries.map((entry) => ({
        id: `${object.id}:${entry.id}`,
        schemaVersion: 2 as const,
        type: 'EVIDENCED_BY' as const,
        fromId: object.id,
        toId: entry.id,
        createdAt: new Date(entry.createdAt).toISOString(),
        sourceKind: 'past_experience' as const,
        verbatimQuote: entry.content,
        quoteVerifiedByServer: true,
        sourceOccurredAt: new Date(entry.createdAt).toISOString(),
        lastKnownSourceState: 'accessible' as const,
      })),
    ),
  };
}
