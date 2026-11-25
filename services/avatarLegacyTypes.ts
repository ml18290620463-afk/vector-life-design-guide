import type { CognitiveCategory, CognitiveObject, OntologyEdge } from '../features/avatar/types';
/** Frozen v1 schema. Migration only; never import into the live memory runtime. */
export type LegacyAvatarUnderstandingStatus = 'pending' | 'confirmed' | 'rejected' | 'superseded';
export type LegacyAvatarUnderstandingConfirmedBy = 'user';
export type LegacyAvatarUnderstandingSummaryKind = 'past-pattern';

/** Broad observation dimensions, used for organizing rather than diagnosing the user. */
export type LegacyPastPatternDomain =
  | 'cognitive'
  | 'behavioral'
  | 'emotional'
  | 'relational'
  | 'coping'
  | 'motivational';

export interface LegacyAvatarUnderstandingVersion {
  readonly id: string;
  readonly aiVisibility?: 'private' | 'allowed';
  readonly aiConsentAt?: number;
  readonly statement: string;
  readonly status: LegacyAvatarUnderstandingStatus;
  readonly sourceEntryIds: readonly string[];
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly confirmedAt?: number;
  readonly confirmedBy?: LegacyAvatarUnderstandingConfirmedBy;
  readonly summaryKind?: LegacyAvatarUnderstandingSummaryKind;
  readonly previousVersionId?: string;
  /** A broad, non-clinical observation dimension. */
  readonly patternDomain?: LegacyPastPatternDomain;
  /** A concrete short label such as “风险预演” or “冲突中延后表达”. */
  readonly patternLabel?: string;
  /** The recurring situation in which the response appears. */
  readonly trigger?: string;
  /** The user's recurring thought, action, emotion, or relational response. */
  readonly response?: string;
  /** A neutral, evidence-grounded consequence; never a value judgement. */
  readonly outcome?: string;
  /** User chose to keep this pattern after deleting its source records. */
  readonly retainedAfterSourceDeletion?: boolean;
  /** Candidate lifetime starts when generated, independently of the experience date. */
  readonly proposedAt?: number;
}

export type LegacyAvatarMemoryNature =
  | 'experience'
  | 'explicit'
  | 'inferred'
  | 'commitment'
  | 'state';

export type LegacyAvatarMemoryCategory =
  | 'profile'
  | 'experience'
  | 'judgment'
  | 'habits'
  | 'goals'
  | 'recent_state'
  | 'relationship'
  | 'expression';

export type LegacyAvatarMemoryFacet =
  | 'domain_background'
  | 'preference'
  | 'aversion'
  | 'habit'
  | 'cognitive_pattern'
  | 'behavioral_pattern'
  | 'emotional_pattern'
  | 'relational_pattern'
  | 'value'
  | 'boundary'
  | 'motivation'
  | 'relationship_view'
  | 'emotional_trigger'
  | 'recovery_resource'
  | 'skill'
  | 'constraint'
  | 'aspirational_self';

export type LegacyAvatarMemoryStatus =
  | 'candidate'
  | 'confirmed'
  | 'superseded'
  | 'rejected'
  | 'retained';
export type LegacyAvatarMemorySensitivity = 'normal' | 'sensitive' | 'private';
export type LegacyAvatarMemorySourceKind =
  | 'entry'
  | 'message'
  | 'future'
  | 'principle'
  | 'pattern'
  | 'action'
  | 'practice';

export interface LegacyAvatarMemorySourceRef {
  readonly supplementId?: string;
  readonly source: LegacyAvatarMemorySourceKind;
  readonly id: string;
  readonly excerpt?: string;
  readonly createdAt?: number;
  /** Identifies the independent chat in which this message was expressed. */
  readonly sessionId?: string;
}

export type LegacyAvatarMemoryTagStatus = 'active' | 'archived';

export interface LegacyAvatarMemoryTag {
  readonly name: string;
  readonly status: LegacyAvatarMemoryTagStatus;
  readonly aliases: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly archivedAt?: number;
}

export interface LegacyAvatarMemoryTagOverviewItem extends LegacyAvatarMemoryTag {
  readonly memoryCount: number;
  readonly latestMemoryAt?: number;
}

export interface LegacyAvatarAtomicMemory {
  readonly aiVisibility?: 'private' | 'allowed';
  readonly aiConsentAt?: number;
  /** Explicit link to the previous reviewed version. */
  readonly previousVersionId?: string;
  readonly id: string;
  readonly statement: string;
  readonly nature: LegacyAvatarMemoryNature;
  readonly category?: LegacyAvatarMemoryCategory;
  readonly facets: readonly LegacyAvatarMemoryFacet[];
  /** Conservative key for merging unconfirmed recurring observations; never shown as a personality label. */
  readonly patternKey?: string;
  /** User-facing organization labels used to browse, group, and connect memories. */
  readonly tags: readonly string[];
  readonly contexts: readonly string[];
  readonly sourceRefs: readonly LegacyAvatarMemorySourceRef[];
  readonly confidence: number;
  readonly status: LegacyAvatarMemoryStatus;
  readonly sensitivity: LegacyAvatarMemorySensitivity;
  readonly validFrom?: number;
  readonly validTo?: number;
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly confirmedAt?: number;
  readonly confirmedBy?: LegacyAvatarUnderstandingConfirmedBy;
  readonly retainedAfterSourceDeletion?: boolean;
  /** Candidate lifetime starts when generated, independently of the experience date. */
  readonly proposedAt?: number;
}

export type LegacyAvatarMemoryRelationKind =
  | 'supports'
  | 'contradicts'
  | 'updates'
  | 'derived_from'
  | 'constrains'
  | 'serves'
  | 'validated_by'
  | 'same_context';

export interface LegacyAvatarMemoryRelation {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly kind: LegacyAvatarMemoryRelationKind;
  readonly confidence: number;
  readonly reason?: string;
  readonly sourceRefs?: readonly LegacyAvatarMemorySourceRef[];
  readonly createdAt: number;
  readonly updatedAt?: number;
}

export const AVATAR_V1_KEYS = {
  sessions: 'vector:avatar:sessions:v1',
  understandings: 'vector:avatar:understandings:v1',
  atoms: 'vector:avatar:atomic-memories:v1',
  relations: 'vector:avatar:memory-relations:v1',
  tags: 'vector:avatar:memory-tags:v1',
} as const;
export type RawStore = Record<keyof typeof AVATAR_V1_KEYS, string | null>;
export interface MigrationDiagnostic {
  collection: keyof RawStore;
  index: number;
  code: string;
}
export interface AvatarMigrationResult {
  ontologySchemaVersion: 2;
  objects: CognitiveObject[];
  edges: OntologyEdge[];
  archive: { readOnly: true; sourceNotExtractable: true; value: unknown }[];
  diagnostics: MigrationDiagnostic[];
}
export interface Snapshot {
  version: 1;
  accountId: string | null;
  capturedAt: string;
  raw: RawStore;
}

export const LEGACY_INFERRED_CATEGORIES: Readonly<Record<string, CognitiveCategory>> = {
  cognitive: 'understanding_judgment',
  cognitive_pattern: 'understanding_judgment',
  behavioral: 'actions_relationships',
  emotional: 'actions_relationships',
  relational: 'actions_relationships',
  behavioral_pattern: 'actions_relationships',
  emotional_pattern: 'actions_relationships',
  relational_pattern: 'actions_relationships',
};
export const LEGACY_EXPLICIT_CATEGORIES: Readonly<Record<string, CognitiveCategory>> = {
  domain_background: 'foundation_situation',
  value: 'values_motivation',
  motivation: 'values_motivation',
  preference: 'preferences_boundaries',
  aversion: 'preferences_boundaries',
  boundary: 'preferences_boundaries',
  skill: 'capabilities_conditions',
  constraint: 'capabilities_conditions',
  recovery_resource: 'capabilities_conditions',
};
