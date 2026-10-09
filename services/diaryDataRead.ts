import { get } from 'idb-keyval';
import type {
  ActionItem,
  ActionItemStatus,
  DiaryEntry,
  ExperienceFeedback,
  ExperienceFeedbackOutcome,
  ExperienceEdge,
  PatternPrincipleLink,
  PatternPrincipleLinkCreator,
  PatternPrincipleLinkStatus,
  PatternPrincipleRelation,
  Principle,
} from '../types';
import { generateSecureId } from './idGenerator';
import { asLegacyEntry } from './entryCompat';
import { readDiaryString } from './diaryStorage';
import { storedArray } from './vaultLegacyRead';
import { DEFAULT_PRINCIPLE_CONFIDENCE } from './experienceFeedback';
import { vaultTransaction } from './vaultTransaction';

const FEEDBACK_OUTCOMES = new Set<ExperienceFeedbackOutcome>([
  'helpful',
  'partial',
  'unhelpful',
  'unrelated',
]);
const ACTION_STATUSES = new Set<ActionItemStatus>(['pending', 'active', 'completed', 'abandoned']);
const EDGE_KINDS = new Set<ExperienceEdge['kind']>(['supports', 'contradicts', 'sameTheme']);
const EDGE_SOURCES = new Set<ExperienceEdge['source']>(['local-semantic', 'user-confirmed']);
const PATTERN_PRINCIPLE_RELATIONS = new Set<PatternPrincipleRelation>([
  'continue',
  'adjust',
  'replace',
  'balance',
]);
const PATTERN_PRINCIPLE_LINK_STATUSES = new Set<PatternPrincipleLinkStatus>([
  'suggested',
  'confirmed',
  'validated',
  'inactive',
]);
const PATTERN_PRINCIPLE_LINK_CREATORS = new Set<PatternPrincipleLinkCreator>([
  'user',
  'ai-suggested',
]);

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return strings.length > 0 ? [...new Set(strings)] : undefined;
};

const sanitizeExperienceEdges = (
  value: unknown,
  sourceEntryId: string,
): ExperienceEdge[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const edges = new Map<string, ExperienceEdge>();
  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const edge = item as Partial<ExperienceEdge>;
    if (
      typeof edge.targetEntryId !== 'string' ||
      !edge.targetEntryId ||
      edge.targetEntryId === sourceEntryId ||
      !edge.kind ||
      !EDGE_KINDS.has(edge.kind) ||
      typeof edge.confidence !== 'number' ||
      !Number.isFinite(edge.confidence) ||
      typeof edge.createdAt !== 'number' ||
      !Number.isFinite(edge.createdAt) ||
      !edge.source ||
      !EDGE_SOURCES.has(edge.source)
    )
      return;
    if (!edges.has(edge.targetEntryId)) {
      edges.set(edge.targetEntryId, {
        ...(edge as ExperienceEdge),
        confidence: Math.min(1, Math.max(0, edge.confidence)),
      });
    }
  });
  return edges.size > 0 ? [...edges.values()] : undefined;
};

const sanitizeExperienceFeedback = (value: unknown): ExperienceFeedback[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const feedback = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<ExperienceFeedback>;
    if (
      typeof candidate.principleId !== 'string' ||
      !candidate.principleId ||
      !candidate.outcome ||
      !FEEDBACK_OUTCOMES.has(candidate.outcome)
    ) {
      return [];
    }
    return [
      {
        principleId: candidate.principleId,
        outcome: candidate.outcome,
        createdAt:
          typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
            ? candidate.createdAt
            : Date.now(),
      },
    ];
  });
  return feedback.length > 0 ? feedback : undefined;
};

export const sanitizeDiaryEntry = (entry: unknown): DiaryEntry => {
  const safeEntry = asLegacyEntry(entry);
  const now = Date.now();
  return {
    id: safeEntry.id || generateSecureId('rec'),
    title: safeEntry.title || safeEntry.name || 'Trace Record',
    content: safeEntry.content || safeEntry.text || safeEntry.body || '',
    createdAt:
      typeof safeEntry.createdAt === 'number' && !Number.isNaN(safeEntry.createdAt)
        ? safeEntry.createdAt
        : now,
    updatedAt:
      typeof safeEntry.updatedAt === 'number' && !Number.isNaN(safeEntry.updatedAt)
        ? safeEntry.updatedAt
        : typeof safeEntry.createdAt === 'number'
          ? safeEntry.createdAt
          : 0,
    tags: Array.isArray(safeEntry.tags) ? safeEntry.tags : [],
    isLocked: Boolean(safeEntry.isLocked),
    isEncrypted: Boolean(safeEntry.isEncrypted),
    isArchived: Boolean(safeEntry.isArchived),
    migrated: Boolean(safeEntry.migrated),
    archivedToShip: Boolean(safeEntry.archivedToShip),
    containerId: safeEntry.containerId || undefined,
    attachment: safeEntry.attachment || undefined,
    nowMaterials: Array.isArray(safeEntry.nowMaterials) ? safeEntry.nowMaterials : undefined,
    relatedEntryIds: sanitizeStringArray(safeEntry.relatedEntryIds),
    experienceEdges: sanitizeExperienceEdges(safeEntry.experienceEdges, safeEntry.id),
    relatedActionIds: sanitizeStringArray(safeEntry.relatedActionIds),
    relatedPrincipleIds: sanitizeStringArray(safeEntry.relatedPrincipleIds),
    principleFeedback: sanitizeExperienceFeedback(safeEntry.principleFeedback),
    unlockAt:
      typeof safeEntry.unlockAt === 'number' && !Number.isNaN(safeEntry.unlockAt)
        ? safeEntry.unlockAt
        : undefined,
    isSample: Boolean(safeEntry.isSample),
  };
};

export const sanitizePrinciple = (principle: Principle): Principle => ({
  ...principle,
  tags: sanitizeStringArray(principle.tags),
  supersedesPrincipleId:
    typeof principle.supersedesPrincipleId === 'string' && principle.supersedesPrincipleId.trim()
      ? principle.supersedesPrincipleId.trim()
      : undefined,
  revisionKind:
    principle.revisionKind === 'correction' || principle.revisionKind === 'evolution'
      ? principle.revisionKind
      : undefined,
  revisedAt:
    typeof principle.revisedAt === 'number' &&
    Number.isFinite(principle.revisedAt) &&
    principle.revisedAt >= 0
      ? principle.revisedAt
      : undefined,
  application:
    principle.application &&
    typeof principle.application.trigger === 'string' &&
    principle.application.trigger.trim() &&
    typeof principle.application.action === 'string' &&
    principle.application.action.trim()
      ? {
          trigger: principle.application.trigger.trim().slice(0, 120),
          action: principle.application.action.trim().slice(0, 160),
        }
      : undefined,
  derivedFromEntryIds: sanitizeStringArray(principle.derivedFromEntryIds),
  derivedFromPracticeIds: sanitizeStringArray(principle.derivedFromPracticeIds),
  sourcePatternIds: sanitizeStringArray(principle.sourcePatternIds),
  appliedFeedbackEntryIds: sanitizeStringArray(principle.appliedFeedbackEntryIds),
  appliedFeedbackPracticeIds: sanitizeStringArray(principle.appliedFeedbackPracticeIds),
  confidence:
    typeof principle.confidence === 'number' && Number.isFinite(principle.confidence)
      ? Math.min(1, Math.max(0, principle.confidence))
      : DEFAULT_PRINCIPLE_CONFIDENCE,
  recallCount:
    typeof principle.recallCount === 'number' && principle.recallCount >= 0
      ? Math.floor(principle.recallCount)
      : 0,
  helpfulCount:
    typeof principle.helpfulCount === 'number' && principle.helpfulCount >= 0
      ? Math.floor(principle.helpfulCount)
      : 0,
  partialCount:
    typeof principle.partialCount === 'number' && principle.partialCount >= 0
      ? Math.floor(principle.partialCount)
      : 0,
  unhelpfulCount:
    typeof principle.unhelpfulCount === 'number' && principle.unhelpfulCount >= 0
      ? Math.floor(principle.unhelpfulCount)
      : 0,
});

export const sanitizePatternPrincipleLink = (value: unknown): PatternPrincipleLink | null => {
  if (!value || typeof value !== 'object') return null;
  const link = value as Partial<PatternPrincipleLink>;
  if (
    typeof link.patternId !== 'string' ||
    !link.patternId.trim() ||
    typeof link.principleId !== 'string' ||
    !link.principleId.trim()
  ) {
    return null;
  }
  const now = Date.now();
  const reason =
    typeof link.reason === 'string' && link.reason.trim().length > 0
      ? link.reason.trim().slice(0, 240)
      : undefined;

  return {
    id:
      typeof link.id === 'string' && link.id.trim()
        ? link.id
        : generateSecureId('pattern-principle-link'),
    patternId: link.patternId.trim(),
    principleId: link.principleId.trim(),
    relation:
      link.relation && PATTERN_PRINCIPLE_RELATIONS.has(link.relation) ? link.relation : 'adjust',
    status:
      link.status && PATTERN_PRINCIPLE_LINK_STATUSES.has(link.status) ? link.status : 'confirmed',
    contexts: sanitizeStringArray(link.contexts),
    triggerIds: sanitizeStringArray(link.triggerIds),
    reason,
    createdBy:
      link.createdBy && PATTERN_PRINCIPLE_LINK_CREATORS.has(link.createdBy)
        ? link.createdBy
        : 'user',
    createdAt:
      typeof link.createdAt === 'number' && Number.isFinite(link.createdAt) ? link.createdAt : now,
    updatedAt:
      typeof link.updatedAt === 'number' && Number.isFinite(link.updatedAt) ? link.updatedAt : now,
  };
};

export const sanitizeActionItem = (value: unknown): ActionItem | null => {
  if (!value || typeof value !== 'object') return null;
  const action = value as Partial<ActionItem>;
  if (
    typeof action.id !== 'string' ||
    !action.id ||
    typeof action.title !== 'string' ||
    !action.title.trim() ||
    !action.status ||
    !ACTION_STATUSES.has(action.status) ||
    typeof action.createdAt !== 'number' ||
    !Number.isFinite(action.createdAt)
  ) {
    return null;
  }

  return {
    id: action.id,
    title: action.title.trim(),
    goalId: typeof action.goalId === 'string' ? action.goalId : undefined,
    scheduledOn:
      typeof action.scheduledOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(action.scheduledOn)
        ? action.scheduledOn
        : typeof action.dueAt === 'number' && Number.isFinite(action.dueAt)
          ? `${new Date(action.dueAt).getFullYear()}-${String(new Date(action.dueAt).getMonth() + 1).padStart(2, '0')}-${String(new Date(action.dueAt).getDate()).padStart(2, '0')}`
          : undefined,
    resultIntent: action.resultIntent === 'outcome' ? 'outcome' : 'preparation',
    revision: Number.isInteger(action.revision) ? action.revision : 0,
    status: action.status,
    createdAt: action.createdAt,
    question: typeof action.question === 'string' ? action.question.trim() || undefined : undefined,
    rationale:
      typeof action.rationale === 'string' ? action.rationale.trim() || undefined : undefined,
    principleId: typeof action.principleId === 'string' ? action.principleId : undefined,
    sourceEntryId: typeof action.sourceEntryId === 'string' ? action.sourceEntryId : undefined,
    evidenceEntryIds: sanitizeStringArray(action.evidenceEntryIds),
    resultEntryId: typeof action.resultEntryId === 'string' ? action.resultEntryId : undefined,
    updatedAt:
      typeof action.updatedAt === 'number' && Number.isFinite(action.updatedAt)
        ? action.updatedAt
        : undefined,
    dueAt:
      typeof action.dueAt === 'number' && Number.isFinite(action.dueAt) ? action.dueAt : undefined,
    completedAt:
      typeof action.completedAt === 'number' && Number.isFinite(action.completedAt)
        ? action.completedAt
        : undefined,
    reviewedAt:
      typeof action.reviewedAt === 'number' && Number.isFinite(action.reviewedAt)
        ? action.reviewedAt
        : undefined,
  };
};

export const readStoredArray = async <T>(key: string): Promise<T[]> => {
  return vaultTransaction([key], (v) => storedArray<T>(v[key], key) ?? [], true);
};

export const readStoredOptionalArray = async <T>(key: string): Promise<T[] | undefined> => {
  return vaultTransaction([key], (v) => storedArray<T>(v[key], key), true);
};

export const readStoredScalar = async (key: string): Promise<string | null> => {
  const idbValue = await get(key);
  if (typeof idbValue === 'string') return idbValue;
  if (idbValue !== undefined && idbValue !== null) throw new Error('资料库保护信息无效');
  return readDiaryString(key) || null;
};
