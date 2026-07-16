import { get } from 'idb-keyval';
import type {
  ActionItem,
  ActionItemStatus,
  DiaryEntry,
  ExperienceFeedback,
  ExperienceFeedbackOutcome,
  Principle,
} from '../types';
import { generateSecureId } from './idGenerator';
import { asLegacyEntry } from './entryCompat';
import { readDiaryJson, readDiaryString } from './diaryStorage';
import { DEFAULT_PRINCIPLE_CONFIDENCE } from './experienceFeedback';

const FEEDBACK_OUTCOMES = new Set<ExperienceFeedbackOutcome>([
  'helpful',
  'partial',
  'unhelpful',
  'unrelated',
]);
const ACTION_STATUSES = new Set<ActionItemStatus>(['pending', 'active', 'completed', 'abandoned']);

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return strings.length > 0 ? [...new Set(strings)] : undefined;
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
        : now,
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
  derivedFromEntryIds: sanitizeStringArray(principle.derivedFromEntryIds),
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
  const idbValue = await get(key).catch(() => undefined);
  if (Array.isArray(idbValue)) return idbValue as T[];
  const localValue = readDiaryJson<T[]>(key);
  return Array.isArray(localValue) ? localValue : [];
};

export const readStoredOptionalArray = async <T>(key: string): Promise<T[] | undefined> => {
  const idbValue = await get(key).catch(() => undefined);
  if (Array.isArray(idbValue)) return idbValue as T[];
  const localValue = readDiaryJson<T[]>(key);
  return Array.isArray(localValue) ? localValue : undefined;
};

export const readStoredScalar = async (key: string): Promise<string | null> => {
  const idbValue = await get(key).catch(() => undefined);
  if (typeof idbValue === 'string') return idbValue;
  return readDiaryString(key) || null;
};
