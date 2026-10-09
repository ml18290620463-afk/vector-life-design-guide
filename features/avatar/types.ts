import type { ChatMessage } from '../now/types/now';

export type AvatarMode = 'capture' | 'distill' | 'recall' | 'decide' | 'review' | 'general';

export type AvatarLaunchSource =
  | 'now'
  | 'past-detail'
  | 'past-search'
  | 'future'
  | 'action-review'
  | 'global';

export interface AvatarLaunchContext {
  mode: AvatarMode;
  source: AvatarLaunchSource;
  entryId?: string;
  query?: string;
  actionId?: string;
  prompt?: string;
}

export interface AvatarSourceReference {
  entryId: string;
  title: string;
  date: number;
  excerpt: string;
  reason: string;
}

export interface AvatarSession {
  id: string;
  mode: AvatarMode;
  context: AvatarLaunchContext;
  messages: ChatMessage[];
  references: AvatarSourceReference[];
  createdAt: number;
  updatedAt: number;
}

export type AvatarUnderstandingStatus = 'pending' | 'confirmed' | 'rejected' | 'superseded';
export type AvatarUnderstandingConfirmedBy = 'user';
export type AvatarUnderstandingSummaryKind = 'past-pattern';

/** Broad observation dimensions, used for organizing rather than diagnosing the user. */
export type PastPatternDomain =
  | 'cognitive'
  | 'behavioral'
  | 'emotional'
  | 'relational'
  | 'coping'
  | 'motivational';

export interface AvatarUnderstandingVersion {
  id: string;
  statement: string;
  status: AvatarUnderstandingStatus;
  sourceEntryIds: string[];
  createdAt: number;
  updatedAt?: number;
  confirmedAt?: number;
  confirmedBy?: AvatarUnderstandingConfirmedBy;
  summaryKind?: AvatarUnderstandingSummaryKind;
  previousVersionId?: string;
  /** A broad, non-clinical observation dimension. */
  patternDomain?: PastPatternDomain;
  /** A concrete short label such as “风险预演” or “冲突中延后表达”. */
  patternLabel?: string;
  /** The recurring situation in which the response appears. */
  trigger?: string;
  /** The user's recurring thought, action, emotion, or relational response. */
  response?: string;
  /** A neutral, evidence-grounded consequence; never a value judgement. */
  outcome?: string;
  /** User chose to keep this pattern after deleting its source records. */
  retainedAfterSourceDeletion?: boolean;
}

export type AvatarMemoryNature = 'experience' | 'explicit' | 'inferred' | 'commitment' | 'state';

export type AvatarMemoryCategory =
  | 'profile'
  | 'experience'
  | 'judgment'
  | 'habits'
  | 'goals'
  | 'recent_state'
  | 'relationship'
  | 'expression';

export type AvatarMemoryFacet =
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

export type AvatarMemoryStatus = 'candidate' | 'confirmed' | 'superseded' | 'rejected' | 'retained';
export type AvatarMemorySensitivity = 'normal' | 'sensitive' | 'private';
export type AvatarMemorySourceKind =
  | 'entry'
  | 'message'
  | 'future'
  | 'principle'
  | 'pattern'
  | 'action'
  | 'practice';

export interface AvatarMemorySourceRef {
  source: AvatarMemorySourceKind;
  id: string;
  excerpt?: string;
  createdAt?: number;
  /** Identifies the independent chat in which this message was expressed. */
  sessionId?: string;
}

export type AvatarMemoryTagStatus = 'active' | 'archived';

export interface AvatarMemoryTag {
  name: string;
  status: AvatarMemoryTagStatus;
  aliases: string[];
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

export interface AvatarMemoryTagOverviewItem extends AvatarMemoryTag {
  memoryCount: number;
  latestMemoryAt?: number;
}

export interface AvatarAtomicMemory {
  /** Explicit link to the previous reviewed version. */
  previousVersionId?: string;
  id: string;
  statement: string;
  nature: AvatarMemoryNature;
  category?: AvatarMemoryCategory;
  facets: AvatarMemoryFacet[];
  /** Conservative key for merging unconfirmed recurring observations; never shown as a personality label. */
  patternKey?: string;
  /** User-facing organization labels used to browse, group, and connect memories. */
  tags: string[];
  contexts: string[];
  sourceRefs: AvatarMemorySourceRef[];
  confidence: number;
  status: AvatarMemoryStatus;
  sensitivity: AvatarMemorySensitivity;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt?: number;
  confirmedAt?: number;
  confirmedBy?: AvatarUnderstandingConfirmedBy;
  retainedAfterSourceDeletion?: boolean;
}

export type AvatarMemoryRelationKind =
  | 'supports'
  | 'contradicts'
  | 'updates'
  | 'derived_from'
  | 'constrains'
  | 'serves'
  | 'validated_by'
  | 'same_context';

export interface AvatarMemoryRelation {
  id: string;
  fromId: string;
  toId: string;
  kind: AvatarMemoryRelationKind;
  confidence: number;
  reason?: string;
  sourceRefs?: AvatarMemorySourceRef[];
  createdAt: number;
  updatedAt?: number;
}

export const DEFAULT_AVATAR_CONTEXT: AvatarLaunchContext = {
  mode: 'general',
  source: 'global',
};
