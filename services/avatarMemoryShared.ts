import type {
  AvatarLaunchContext,
  AvatarMode,
  AvatarAtomicMemory,
  AvatarMemoryFacet,
  AvatarMemoryNature,
  AvatarMemoryRelationKind,
  AvatarMemorySensitivity,
  AvatarMemorySourceKind,
  AvatarMemorySourceRef,
  AvatarMemoryStatus,
  AvatarMemoryTag,
  AvatarMemoryTagStatus,
  AvatarSourceReference,
  PastPatternDomain,
  AvatarUnderstandingStatus,
  AvatarUnderstandingVersion,
} from '../features/avatar/types';
import type { ChatMessage } from '../features/now/types/now';
import { getStoredJson, setStoredJson } from './browserStorage';

export { getStoredJson, setStoredJson };

const SESSION_KEY = 'vector:avatar:sessions:v1';
const UNDERSTANDING_KEY = 'vector:avatar:understandings:v1';
const ATOMIC_MEMORY_KEY = 'vector:avatar:atomic-memories:v1';
const MEMORY_RELATION_KEY = 'vector:avatar:memory-relations:v1';
const MEMORY_TAG_KEY = 'vector:avatar:memory-tags:v1';
const MAX_SESSIONS = 18;
const MAX_MESSAGES = 120;
const MAX_ATOMIC_MEMORIES = 400;
const MAX_MEMORY_RELATIONS = 800;

const MODES = new Set<AvatarMode>(['capture', 'distill', 'recall', 'decide', 'review', 'general']);
const SOURCES = new Set<AvatarLaunchContext['source']>([
  'now',
  'past-detail',
  'past-search',
  'future',
  'action-review',
  'global',
]);
const UNDERSTANDING_STATUSES = new Set<AvatarUnderstandingStatus>([
  'pending',
  'confirmed',
  'rejected',
  'superseded',
]);
const PAST_PATTERN_DOMAINS = new Set<PastPatternDomain>([
  'cognitive',
  'behavioral',
  'emotional',
  'relational',
  'coping',
  'motivational',
]);
const MEMORY_NATURES = new Set<AvatarMemoryNature>([
  'experience',
  'explicit',
  'inferred',
  'commitment',
  'state',
]);
const MEMORY_FACETS = new Set<AvatarMemoryFacet>([
  'domain_background',
  'preference',
  'aversion',
  'habit',
  'cognitive_pattern',
  'behavioral_pattern',
  'emotional_pattern',
  'relational_pattern',
  'value',
  'boundary',
  'motivation',
  'relationship_view',
  'emotional_trigger',
  'recovery_resource',
  'skill',
  'constraint',
  'aspirational_self',
]);
const MEMORY_STATUSES = new Set<AvatarMemoryStatus>([
  'candidate',
  'confirmed',
  'superseded',
  'rejected',
  'retained',
]);
const MEMORY_SENSITIVITIES = new Set<AvatarMemorySensitivity>(['normal', 'sensitive', 'private']);
const MEMORY_SOURCE_KINDS = new Set<AvatarMemorySourceKind>([
  'entry',
  'message',
  'future',
  'principle',
  'pattern',
  'action',
]);
const MEMORY_TAG_STATUSES = new Set<AvatarMemoryTagStatus>(['active', 'archived']);

const MEMORY_RELATION_KINDS = new Set<AvatarMemoryRelationKind>([
  'supports',
  'contradicts',
  'updates',
  'derived_from',
  'constrains',
  'serves',
  'validated_by',
  'same_context',
]);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const sanitizeMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.content !== 'string') return null;
  if (!['user', 'assistant', 'system'].includes(String(value.role))) return null;
  if (!['text', 'audio', 'record_preview'].includes(String(value.type))) return null;
  if (typeof value.created_at !== 'string') return null;
  return value as unknown as ChatMessage;
};

export const sanitizeContext = (value: unknown): AvatarLaunchContext | null => {
  if (!isRecord(value) || !MODES.has(value.mode as AvatarMode)) return null;
  if (!SOURCES.has(value.source as AvatarLaunchContext['source'])) return null;
  return {
    mode: value.mode as AvatarMode,
    source: value.source as AvatarLaunchContext['source'],
    ...(typeof value.entryId === 'string' ? { entryId: value.entryId } : {}),
    ...(typeof value.query === 'string' ? { query: value.query } : {}),
    ...(typeof value.actionId === 'string' ? { actionId: value.actionId } : {}),
    ...(typeof value.prompt === 'string' ? { prompt: value.prompt } : {}),
  };
};

export const sanitizeReference = (value: unknown): AvatarSourceReference | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.entryId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.date !== 'number' ||
    typeof value.excerpt !== 'string' ||
    typeof value.reason !== 'string'
  ) {
    return null;
  }
  return value as unknown as AvatarSourceReference;
};

export const clampConfidence = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
};

export const sanitizeMemoryTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 16),
        ),
      ]
    : [];

export const sanitizeTagName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 32) : '';

export const sanitizeAvatarMemoryTags = (value: unknown): AvatarMemoryTag[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = sanitizeTagName(item.name);
    if (!name || typeof item.createdAt !== 'number' || typeof item.updatedAt !== 'number') {
      return [];
    }
    const status = MEMORY_TAG_STATUSES.has(item.status as AvatarMemoryTagStatus)
      ? (item.status as AvatarMemoryTagStatus)
      : 'active';
    return [
      {
        name,
        status,
        aliases: sanitizeMemoryTags(item.aliases),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(status === 'archived' && typeof item.archivedAt === 'number'
          ? { archivedAt: item.archivedAt }
          : {}),
      },
    ];
  });
};

export const sanitizeMemorySourceRef = (value: unknown): AvatarMemorySourceRef | null => {
  if (!isRecord(value)) return null;
  if (
    !MEMORY_SOURCE_KINDS.has(value.source as AvatarMemorySourceKind) ||
    typeof value.id !== 'string'
  ) {
    return null;
  }
  return {
    source: value.source as AvatarMemorySourceKind,
    id: value.id,
    ...(typeof value.excerpt === 'string' ? { excerpt: value.excerpt } : {}),
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
    ...(typeof value.sessionId === 'string' && value.sessionId.trim()
      ? { sessionId: value.sessionId.trim().slice(0, 128) }
      : {}),
  };
};

export const stableAvatarId = (prefix: string, parts: Array<string | number | undefined>): string => {
  const input = parts.filter((part) => part !== undefined && part !== '').join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
};

/** Ignore formatting-only edits when deciding whether an understanding changed. */
export const hasMeaningfulStatementChange = (before: string, after: string) =>
  before
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLocaleLowerCase('zh-CN') !==
  after
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLocaleLowerCase('zh-CN');

const memoryFacetFromPatternDomain = (domain?: PastPatternDomain): AvatarMemoryFacet => {
  switch (domain) {
    case 'behavioral':
      return 'behavioral_pattern';
    case 'emotional':
      return 'emotional_pattern';
    case 'relational':
      return 'relational_pattern';
    case 'motivational':
      return 'motivation';
    case 'coping':
      return 'recovery_resource';
    case 'cognitive':
    default:
      return 'cognitive_pattern';
  }
};

export const atomicMemoryFromUnderstanding = (
  understanding: AvatarUnderstandingVersion,
): AvatarAtomicMemory => ({
  id: stableAvatarId('atomic_pattern', [understanding.id, understanding.statement]),
  statement: understanding.statement,
  nature: 'inferred',
  facets: [memoryFacetFromPatternDomain(understanding.patternDomain)],
  tags: [understanding.patternLabel, understanding.patternDomain]
    .filter((value): value is string => Boolean(value))
    .slice(0, 4),
  contexts: [understanding.patternLabel, understanding.trigger].filter((value): value is string =>
    Boolean(value),
  ),
  sourceRefs: [
    {
      source: 'pattern',
      id: understanding.id,
      excerpt: understanding.patternLabel ?? understanding.statement,
    },
    ...understanding.sourceEntryIds.map((id) => ({ source: 'entry' as const, id })),
  ],
  confidence: understanding.status === 'confirmed' ? 0.82 : 0.58,
  status: understanding.status === 'confirmed' ? 'confirmed' : 'candidate',
  sensitivity:
    understanding.patternDomain === 'relational' || understanding.patternDomain === 'emotional'
      ? 'sensitive'
      : 'normal',
  createdAt: understanding.confirmedAt ?? understanding.createdAt,
  ...(understanding.updatedAt ? { updatedAt: understanding.updatedAt } : {}),
  ...(understanding.confirmedAt
    ? { confirmedAt: understanding.confirmedAt, confirmedBy: 'user' as const }
    : {}),
  ...(understanding.retainedAfterSourceDeletion ? { retainedAfterSourceDeletion: true } : {}),
});
