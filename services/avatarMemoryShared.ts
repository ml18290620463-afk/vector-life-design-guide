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
    ...(typeof value.supplementId === 'string' ? { supplementId: value.supplementId } : {}),
    id: value.id,
    ...(typeof value.excerpt === 'string' ? { excerpt: value.excerpt } : {}),
    ...(typeof value.createdAt === 'number' ? { createdAt: value.createdAt } : {}),
    ...(typeof value.sessionId === 'string' && value.sessionId.trim()
      ? { sessionId: value.sessionId.trim().slice(0, 128) }
      : {}),
  };
};

export const stableAvatarId = (
  prefix: string,
  parts: Array<string | number | undefined>,
): string => {
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

/** Typography-only equality; never infer semantic agreement from a topic key. */
export const memoryStatementKey = (statement: string) =>
  statement
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：、“”‘’,.!?;:"'()（）]/g, '')
    .toLocaleLowerCase();

/**
 * A deliberately narrow key for durable self-statements.
 *
 * It is only used for preferences and boundaries.  Unlike a semantic embedding,
 * this will not decide that two nearby ideas are the same.  It merely removes the
 * grammatical wrappers that cause the same assertion to be re-proposed, such as
 * “用户偏好…” and “我喜欢…”.  Conditions and objects remain part of the key.
 */
const durableAssertionBody = (statement: string, kind: 'preference' | 'boundary') => {
  let value = memoryStatementKey(statement);
  value = value
    .replace(/^(用户|我|本人|自己)/u, '')
    .replace(/^(偏好|喜欢|更喜欢|更想要|希望|倾向于|倾向|想要)/u, '');
  if (kind === 'boundary') {
    value = value.replace(/^(我的)?(边界|底线)(是|为)?/u, '');
    value = value.replace(/^(不想(?:再|一直)?|不再|不能接受|拒绝|不希望|不愿意)/u, '不');
  }
  // These are wording variants of the same *form* of expression, not a broad
  // semantic judgement.  The surrounding object/context is intentionally kept.
  return value
    .replace(/(简短|精炼|少一些解释|少些解释|少解释)/gu, '简洁表达')
    // Keep this deliberately limited to a paired wording variant.  It avoids
    // treating neighbouring preferences as equal while covering the common
    // "简洁直接" / "直接、简洁" rewrite produced by different models.
    .replace(/(?:简洁直接|直接简洁)/gu, '简洁直接')
    .replace(/(回答|说明|解释)/gu, '表达')
    .replace(/(别人|他人)/gu, '他人')
    .replace(/(一直承担|承担着|承担)/gu, '承担')
    .replace(/的/gu, '')
    .trim();
};

/**
 * Returns a key only when both statements belong to the same narrow durable
 * facet.  Callers must not use it as a general “similarity” test.
 */
export const durableMemoryAssertionKey = (
  statement: string,
  facets: readonly string[],
): string | null => {
  const kind = facets.includes('boundary')
    ? 'boundary'
    : facets.includes('preference')
      ? 'preference'
      : null;
  if (!kind) return null;
  const body = durableAssertionBody(statement, kind);
  return body.length >= 2 ? `${kind}:${body}` : null;
};

/** Capture labels describe provenance, not the scope of a preference. */
export const memoryScopeKey = (contexts: readonly string[] = []) =>
  [
    ...new Set(
      contexts
        .map(memoryStatementKey)
        .filter(
          (context) => !['来自聊天自述', '手动添加', '对话记忆', '待验证模式'].includes(context),
        ),
    ),
  ]
    .sort()
    .join('|');

type ComparableMemory = {
  statement: string;
  facets: readonly string[];
  contexts?: readonly string[];
  nature?: string;
};

/** Same durable assertion only within the same known scope and kind of claim. */
export const isSameDurableMemoryAssertion = (left: ComparableMemory, right: ComparableMemory) => {
  if (left.nature && right.nature && left.nature !== right.nature) return false;
  if (memoryScopeKey(left.contexts) !== memoryScopeKey(right.contexts)) return false;
  const leftKey = durableMemoryAssertionKey(left.statement, left.facets);
  return leftKey !== null && leftKey === durableMemoryAssertionKey(right.statement, right.facets);
};

export const sameMemoryScope = (left: AvatarAtomicMemory, right: AvatarAtomicMemory) => {
  if (
    left.nature !== right.nature ||
    memoryScopeKey(left.contexts) !== memoryScopeKey(right.contexts)
  )
    return false;
  // Identical feelings or plans on different occasions are separate observations.
  if (['state', 'experience', 'commitment'].includes(left.nature))
    return (
      left.validFrom === right.validFrom &&
      left.validTo === right.validTo &&
      left.createdAt === right.createdAt
    );
  return left.validTo === right.validTo;
};
