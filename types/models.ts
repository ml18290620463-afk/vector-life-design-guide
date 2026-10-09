export type Language = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'es' | 'de';

export type Theme = 'dark' | 'light';

export type GroupingMode = 'none' | 'year' | 'month' | 'day';

export type ExperienceFeedbackOutcome = 'helpful' | 'partial' | 'unhelpful' | 'unrelated';

export interface ExperienceFeedback {
  principleId: string;
  outcome: ExperienceFeedbackOutcome;
  createdAt: number;
}

export type ExperienceEdgeKind = 'supports' | 'contradicts' | 'sameTheme';
export type ExperienceEdgeSource = 'local-semantic' | 'user-confirmed';

export interface ExperienceEdge {
  targetEntryId: string;
  kind: ExperienceEdgeKind;
  confidence: number;
  createdAt: number;
  source: ExperienceEdgeSource;
}

export interface PrincipleApplication {
  /** Situation in which this principle should be recalled. */
  trigger: string;
  /** Small, observable behaviour to try when the trigger occurs. */
  action: string;
}

export type PrincipleRevisionKind = 'correction' | 'evolution';

export interface Principle {
  id: string;
  text: string;
  /** User-authored labels used to organise principles without changing their meaning. */
  tags?: string[];
  year: number;
  date?: string; // New: Optional full date for entry-derived principles
  createdAt: number;
  showOnHome: boolean; // New: Whether to display on the landing page
  containerId?: string; // New: Link to a storage container
  /** Entry evidence explicitly confirmed when this principle was distilled. */
  derivedFromEntryIds?: string[];
  /** Stable practice records explicitly confirmed when this principle was distilled. */
  derivedFromPracticeIds?: string[];
  /** Confirmed patterns this user-authored principle responds to. */
  sourcePatternIds?: string[];
  /** Optional P4 trigger-to-action structure, confirmed with the principle. */
  application?: PrincipleApplication;
  /** The prior principle this record replaces. The original record remains immutable. */
  supersedesPrincipleId?: string;
  /** Whether this replacement corrects the record or records a later real-world change. */
  revisionKind?: PrincipleRevisionKind;
  /** When this correction or change actually became known. */
  revisedAt?: number;
  /** 0–1 internal ranking heuristic; NOT a calibrated probability. Missing legacy values are interpreted as 0.5. */
  confidence?: number;
  recallCount?: number;
  appliedFeedbackEntryIds?: string[];
  /** Practice records whose explicit outcome was used to update this principle. */
  appliedFeedbackPracticeIds?: string[];
  helpfulCount?: number;
  partialCount?: number;
  unhelpfulCount?: number;
  lastFeedbackAt?: number;
}

export type PatternPrincipleRelation = 'continue' | 'adjust' | 'replace' | 'balance';
export type PatternPrincipleLinkStatus = 'suggested' | 'confirmed' | 'validated' | 'inactive';
export type PatternPrincipleLinkCreator = 'user' | 'ai-suggested';

export interface PatternPrincipleLink {
  id: string;
  patternId: string;
  principleId: string;
  relation: PatternPrincipleRelation;
  status: PatternPrincipleLinkStatus;
  contexts?: string[];
  triggerIds?: string[];
  reason?: string;
  createdBy: PatternPrincipleLinkCreator;
  createdAt: number;
  updatedAt: number;
}

export type ActionItemStatus = 'pending' | 'active' | 'completed' | 'abandoned';

/**
 * P0 schema reservation for the Future decision loop. Persistence and UI are
 * intentionally deferred until the principle feedback loop has been validated.
 */
export interface ActionItem {
  goalId?: string;
  scheduledOn?: string;
  resultIntent?: 'preparation' | 'outcome';
  revision?: number;
  id: string;
  title: string;
  status: ActionItemStatus;
  question?: string;
  rationale?: string;
  principleId?: string;
  sourceEntryId?: string;
  evidenceEntryIds?: string[];
  resultEntryId?: string;
  createdAt: number;
  updatedAt?: number;
  dueAt?: number;
  completedAt?: number;
  reviewedAt?: number;
}

export interface Container {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: number;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'pdf' | 'other';
  data: string; // Base64 or Blob URL (Base64 for persistence)
  name: string;
  mimeType: string;
}

export interface EntryMaterial {
  id: string;
  type: 'image' | 'video' | 'link' | 'audio';
  url: string;
  local_path?: string;
  meta?: {
    width?: number;
    height?: number;
    duration_ms?: number;
    mime_type?: string;
    title?: string;
  };
  sort_order: number;
  /** Optional explanation written by the person who added this material. */
  description?: string;
}

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt?: number; // New: Last modified timestamp for sync resolution
  tags: string[];
  isLocked: boolean;
  isEncrypted?: boolean; // New: Whether the content is encrypted with a master password
  isArchived?: boolean; // New field for Bio-Vault
  migrated?: boolean; // Added for space separation
  archivedToShip?: boolean; // Added for space separation
  unlockAt?: number; // New: Time when the entry becomes accessible
  reflection?: string; // New: User reflection on the entry
  attachment?: Attachment; // New: Media attachment
  nowMaterials?: EntryMaterial[];
  containerId?: string; // New: The storage package this entry belongs to
  /** Locally derived semantic neighbours. This stores ids, never vector payloads. */
  relatedEntryIds?: string[];
  /** Directed local relationships; vector payloads remain outside diary data. */
  experienceEdges?: ExperienceEdge[];
  /** Explicit Future actions whose result is recorded by this entry. */
  relatedActionIds?: string[];
  /** Principles that this experience may validate or challenge. */
  relatedPrincipleIds?: string[];
  /** User-confirmed outcomes collected in the context of this entry. */
  principleFeedback?: ExperienceFeedback[];
  /**
   * Phase 4 §4.a-1 — sample reflection seeded by `services/sampleEntries.ts`
   * after onboarding completes. Sample entries:
   *   - render with a special "示例" badge in `EntryGrid` / `ArchiveEntryCard`
   *   - are auto-removed by `useDiaryData.addEntry` once the user writes
   *     their first real entry (lifecycle option C from the §4.a-1 brief)
   *   - serve only as activation hooks; they never count toward stats /
   *     filters / backups in a way that pollutes user data
   * Optional + additive so older backups (missing the field) round-trip
   * cleanly through `dashboardImport.ts` and `sanitizeEntry`.
   */
  isSample?: boolean;
}

export enum AppState {
  COVER = 'COVER', // New Landing Page (Includes Fragments)
  ONBOARDING = 'ONBOARDING', // Initial Setup
  LOGIN = 'LOGIN', // Returning-user password gate
  VIEWER = 'VIEWER',
  PAST = 'PAST', // Mobile repository hub (timeline / principles / archive)
  FUTURE = 'FUTURE', // Mobile future analysis (placeholder)
  NOW = 'NOW',
  NOW_TAGS = 'NOW_TAGS',
  NOW_AVATAR_CHAT = 'NOW_AVATAR_CHAT',
}
