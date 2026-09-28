import type { AvatarAtomicMemory, AvatarMemoryFacet, AvatarMemoryNature, AvatarMemorySensitivity, AvatarMemoryStatus, AvatarMemoryTag, AvatarMemoryTagOverviewItem, AvatarMemoryTagStatus } from '../features/avatar/types';
import { normalizeMemoryCategory } from './avatarMemoryCategories';
import { generateSecureId } from './idGenerator';
import { getStoredJson, setStoredJson, clampConfidence, hasMeaningfulStatementChange, isRecord, sanitizeMemorySourceRef, sanitizeMemoryTags, sanitizeTagName, stableAvatarId, sanitizeAvatarMemoryTags } from './avatarMemoryShared';

const ATOMIC_MEMORY_KEY = 'vector:avatar:atomic-memories:v1';
const MEMORY_TAG_KEY = 'vector:avatar:memory-tags:v1';
const MAX_ATOMIC_MEMORIES = 400;
const MEMORY_NATURES = new Set<AvatarMemoryNature>(['experience', 'explicit', 'inferred', 'commitment', 'state']);
const MEMORY_FACETS = new Set<AvatarMemoryFacet>(['domain_background', 'preference', 'aversion', 'habit', 'cognitive_pattern', 'behavioral_pattern', 'emotional_pattern', 'relational_pattern', 'value', 'boundary', 'motivation', 'relationship_view', 'emotional_trigger', 'recovery_resource', 'skill', 'constraint', 'aspirational_self']);
const MEMORY_STATUSES = new Set<AvatarMemoryStatus>(['candidate', 'confirmed', 'superseded', 'rejected', 'retained']);
const MEMORY_SENSITIVITIES = new Set<AvatarMemorySensitivity>(['normal', 'sensitive', 'private']);
const MEMORY_TAG_STATUSES = new Set<AvatarMemoryTagStatus>(['active', 'archived']);

const sanitizePatternKey = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const key = value.trim();
  return key.length >= 2 && key.length <= 32 && !/[\r\n]/.test(key) ? key : undefined;
};

export const sanitizeAvatarAtomicMemories = (value: unknown): AvatarAtomicMemory[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.id !== 'string' ||
      typeof item.statement !== 'string' ||
      !MEMORY_NATURES.has(item.nature as AvatarMemoryNature) ||
      !MEMORY_STATUSES.has(item.status as AvatarMemoryStatus) ||
      !MEMORY_SENSITIVITIES.has(item.sensitivity as AvatarMemorySensitivity) ||
      typeof item.createdAt !== 'number'
    ) {
      return [];
    }
    const facets = Array.isArray(item.facets)
      ? item.facets.filter((facet): facet is AvatarMemoryFacet =>
          MEMORY_FACETS.has(facet as AvatarMemoryFacet),
        )
      : [];
    if (!facets.length) return [];
    return [
      {
        id: item.id,
        ...(typeof item.previousVersionId === 'string'
          ? { previousVersionId: item.previousVersionId }
          : {}),
        statement: item.statement,
        nature: item.nature as AvatarMemoryNature,
        ...(normalizeMemoryCategory(item.category)
          ? { category: normalizeMemoryCategory(item.category) }
          : {}),
        facets,
        ...(sanitizePatternKey(item.patternKey) ? { patternKey: sanitizePatternKey(item.patternKey) } : {}),
        tags: sanitizeMemoryTags(item.tags),
        contexts: Array.isArray(item.contexts)
          ? item.contexts.filter((context): context is string => typeof context === 'string')
          : [],
        sourceRefs: Array.isArray(item.sourceRefs)
          ? item.sourceRefs.flatMap((source) => sanitizeMemorySourceRef(source) ?? [])
          : [],
        confidence: clampConfidence(item.confidence),
        status: item.status as AvatarMemoryStatus,
        sensitivity: item.sensitivity as AvatarMemorySensitivity,
        ...(typeof item.validFrom === 'number' ? { validFrom: item.validFrom } : {}),
        ...(typeof item.validTo === 'number' ? { validTo: item.validTo } : {}),
        createdAt: item.createdAt,
        ...(typeof item.updatedAt === 'number' ? { updatedAt: item.updatedAt } : {}),
        ...(typeof item.confirmedAt === 'number' ? { confirmedAt: item.confirmedAt } : {}),
        ...(item.confirmedBy === 'user' ? { confirmedBy: item.confirmedBy } : {}),
        ...(item.retainedAfterSourceDeletion === true ? { retainedAfterSourceDeletion: true } : {}),
      },
    ];
  });
};

export const readAvatarAtomicMemories = (): AvatarAtomicMemory[] =>
  sanitizeAvatarAtomicMemories(getStoredJson<unknown>(ATOMIC_MEMORY_KEY)).sort((a, b) => {
    const rank = (memory: AvatarAtomicMemory) =>
      memory.status === 'confirmed' || memory.status === 'retained' ? 1 : 0;
    return rank(b) - rank(a) || (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
  });

/**
 * A conversational pattern is deliberately held to a higher evidence bar than
 * an explicit fact.  We only surface it for review after separate expressions
 * support it over time or in independent conversations. Message ids are used
 * rather than excerpts so repeated saves of the same turn cannot inflate the
 * evidence count.
 */
export const isPatternMemoryReadyForConfirmation = (memory: AvatarAtomicMemory): boolean => {
  if (!memory.facets.includes('cognitive_pattern') || memory.status !== 'candidate') return false;
  const sources = memory.sourceRefs.filter((source) => source.source === 'message');
  const uniqueMessages = new Set(sources.map((source) => source.id));
  const dates = new Set(
    sources
      .map((source) => source.createdAt)
      .filter((createdAt): createdAt is number => typeof createdAt === 'number')
      .map((createdAt) => new Date(createdAt).toISOString().slice(0, 10)),
  );
  const sessions = new Set(
    sources
      .map((source) => source.sessionId?.trim())
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  );
  return uniqueMessages.size >= 3 && (dates.size >= 2 || sessions.size >= 2);
};

export const readAvatarMemoryTags = (): AvatarMemoryTag[] =>
  sanitizeAvatarMemoryTags(getStoredJson<unknown>(MEMORY_TAG_KEY)).sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );

const writeAvatarMemoryTags = (tags: AvatarMemoryTag[]): boolean =>
  setStoredJson(MEMORY_TAG_KEY, sanitizeAvatarMemoryTags(tags));

const upsertTagCatalogEntries = (tagNames: string[], now = Date.now()): AvatarMemoryTag[] => {
  const byName = new Map(readAvatarMemoryTags().map((tag) => [tag.name, tag]));
  for (const name of sanitizeMemoryTags(tagNames)) {
    const previous = byName.get(name);
    byName.set(
      name,
      previous
        ? { ...previous, status: previous.status ?? 'active', updatedAt: now }
        : { name, status: 'active', aliases: [], createdAt: now, updatedAt: now },
    );
  }
  return Array.from(byName.values());
};

const replaceMemoryTags = (transform: (tags: string[]) => string[]): AvatarAtomicMemory[] => {
  const now = Date.now();
  return readAvatarAtomicMemories().map((memory) => {
    const nextTags = sanitizeMemoryTags(transform(memory.tags));
    const changed =
      nextTags.length !== memory.tags.length ||
      nextTags.some((tag, index) => tag !== memory.tags[index]);
    return changed ? { ...memory, tags: nextTags, updatedAt: now } : memory;
  });
};

export const buildAvatarMemoryTagOverview = (
  memories = readAvatarAtomicMemories(),
  catalog = readAvatarMemoryTags(),
): AvatarMemoryTagOverviewItem[] => {
  const now = Date.now();
  const byName = new Map<string, AvatarMemoryTagOverviewItem>();
  for (const tag of catalog) {
    byName.set(tag.name, { ...tag, memoryCount: 0 });
  }
  for (const memory of memories) {
    for (const name of sanitizeMemoryTags(memory.tags)) {
      const previous = byName.get(name);
      const latest = memory.updatedAt ?? memory.createdAt;
      byName.set(name, {
        name,
        status: previous?.status ?? 'active',
        aliases: previous?.aliases ?? [],
        createdAt: previous?.createdAt ?? latest ?? now,
        updatedAt: previous?.updatedAt ?? latest ?? now,
        ...(previous?.archivedAt ? { archivedAt: previous.archivedAt } : {}),
        memoryCount: (previous?.memoryCount ?? 0) + 1,
        latestMemoryAt: Math.max(previous?.latestMemoryAt ?? 0, latest),
      });
    }
  }
  return Array.from(byName.values()).sort(
    (a, b) =>
      Number(a.status === 'archived') - Number(b.status === 'archived') ||
      b.memoryCount - a.memoryCount ||
      (b.latestMemoryAt ?? b.updatedAt) - (a.latestMemoryAt ?? a.updatedAt) ||
      a.name.localeCompare(b.name),
  );
};

export const updateAvatarMemoryTags = (
  memoryId: string,
  tags: string[],
): AvatarAtomicMemory | null => {
  const current = readAvatarAtomicMemories();
  const target = current.find((memory) => memory.id === memoryId);
  if (!target) return null;
  const now = Date.now();
  const nextTags = sanitizeMemoryTags(tags);
  const updated: AvatarAtomicMemory = { ...target, tags: nextTags, updatedAt: now };
  const savedMemories = setStoredJson(
    ATOMIC_MEMORY_KEY,
    current.map((memory) => (memory.id === memoryId ? updated : memory)),
  );
  if (!savedMemories) return null;
  writeAvatarMemoryTags(upsertTagCatalogEntries(nextTags, now));
  return updated;
};

export const renameAvatarMemoryTag = (from: string, to: string): boolean => {
  const fromName = sanitizeTagName(from);
  const toName = sanitizeTagName(to);
  if (!fromName || !toName || fromName === toName) return false;
  const now = Date.now();
  const updatedMemories = replaceMemoryTags((tags) =>
    tags.map((tag) => (tag === fromName ? toName : tag)),
  );
  if (!setStoredJson(ATOMIC_MEMORY_KEY, updatedMemories)) return false;
  const byName = new Map(readAvatarMemoryTags().map((tag) => [tag.name, tag]));
  const source = byName.get(fromName);
  const target = byName.get(toName);
  byName.delete(fromName);
  byName.set(toName, {
    name: toName,
    status: target?.status ?? source?.status ?? 'active',
    aliases: sanitizeMemoryTags([...(target?.aliases ?? []), ...(source?.aliases ?? []), fromName]),
    createdAt: target?.createdAt ?? source?.createdAt ?? now,
    updatedAt: now,
    ...(target?.archivedAt ? { archivedAt: target.archivedAt } : {}),
  });
  return writeAvatarMemoryTags(Array.from(byName.values()));
};

export const mergeAvatarMemoryTags = (fromTags: string[], to: string): boolean => {
  const sourceNames = sanitizeMemoryTags(fromTags);
  const toName = sanitizeTagName(to);
  if (!sourceNames.length || !toName) return false;
  const sourceSet = new Set(sourceNames.filter((name) => name !== toName));
  if (!sourceSet.size) return false;
  const now = Date.now();
  const updatedMemories = replaceMemoryTags((tags) =>
    tags.map((tag) => (sourceSet.has(tag) ? toName : tag)),
  );
  if (!setStoredJson(ATOMIC_MEMORY_KEY, updatedMemories)) return false;
  const byName = new Map(readAvatarMemoryTags().map((tag) => [tag.name, tag]));
  const target = byName.get(toName);
  const sourceAliases = Array.from(sourceSet).flatMap((name) => [
    name,
    ...(byName.get(name)?.aliases ?? []),
  ]);
  for (const name of sourceSet) {
    const source = byName.get(name);
    byName.set(name, {
      name,
      status: 'archived',
      aliases: source?.aliases ?? [],
      createdAt: source?.createdAt ?? now,
      updatedAt: now,
      archivedAt: now,
    });
  }
  byName.set(toName, {
    name: toName,
    status: target?.status ?? 'active',
    aliases: sanitizeMemoryTags([...(target?.aliases ?? []), ...sourceAliases]),
    createdAt: target?.createdAt ?? now,
    updatedAt: now,
    ...(target?.archivedAt ? { archivedAt: target.archivedAt } : {}),
  });
  return writeAvatarMemoryTags(Array.from(byName.values()));
};

export const archiveAvatarMemoryTag = (name: string): boolean => {
  const tagName = sanitizeTagName(name);
  if (!tagName) return false;
  const now = Date.now();
  const byName = new Map(readAvatarMemoryTags().map((tag) => [tag.name, tag]));
  const previous = byName.get(tagName);
  byName.set(tagName, {
    name: tagName,
    status: 'archived',
    aliases: previous?.aliases ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    archivedAt: now,
  });
  return writeAvatarMemoryTags(Array.from(byName.values()));
};

export const restoreAvatarMemoryTag = (name: string): boolean => {
  const tagName = sanitizeTagName(name);
  if (!tagName) return false;
  const now = Date.now();
  const byName = new Map(readAvatarMemoryTags().map((tag) => [tag.name, tag]));
  const previous = byName.get(tagName);
  byName.set(tagName, {
    name: tagName,
    status: 'active',
    aliases: previous?.aliases ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  });
  return writeAvatarMemoryTags(Array.from(byName.values()));
};

/**
 * A memory can be extracted from more than one surface (an entry, a principle, or a
 * conversation).  Treat only text that is identical after harmless typography
 * normalization as one fact.  Similar wording remains separate: silently merging
 * it would turn a product convenience into an unreviewable inference.
 */
const memoryStatementKey = (statement: string) =>
  statement
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：、“”‘’,.!?;:"'()（）]/g, '')
    .toLocaleLowerCase();

const unique = <T>(values: T[], key: (value: T) => string) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const valueKey = key(value);
    if (seen.has(valueKey)) return false;
    seen.add(valueKey);
    return true;
  });
};

const memoryStatusRank: Record<AvatarMemoryStatus, number> = {
  confirmed: 5,
  retained: 4,
  candidate: 3,
  rejected: 2,
  superseded: 1,
};

const sensitivityRank: Record<AvatarMemorySensitivity, number> = {
  normal: 1,
  sensitive: 2,
  private: 3,
};

const mergeSameStatementMemory = (
  existing: AvatarAtomicMemory,
  incoming: AvatarAtomicMemory,
): AvatarAtomicMemory => {
  const preferred =
    memoryStatusRank[existing.status] >= memoryStatusRank[incoming.status] ? existing : incoming;
  const other = preferred === existing ? incoming : existing;
  const sensitivity =
    sensitivityRank[existing.sensitivity] >= sensitivityRank[incoming.sensitivity]
      ? existing.sensitivity
      : incoming.sensitivity;
  return {
    ...preferred,
    // Keep the established identifier so existing relations and user actions stay valid.
    facets: unique([...existing.facets, ...incoming.facets], (facet) => facet),
    tags: unique([...existing.tags, ...incoming.tags], (tag) => tag),
    contexts: unique([...existing.contexts, ...incoming.contexts], (context) => context),
    sourceRefs: unique(
      [...existing.sourceRefs, ...incoming.sourceRefs],
      (source) => `${source.source}:${source.id}:${source.excerpt ?? ''}`,
    ),
    confidence: Math.max(existing.confidence, incoming.confidence),
    sensitivity,
    createdAt: Math.min(existing.createdAt, incoming.createdAt),
    updatedAt: Math.max(
      existing.updatedAt ?? existing.createdAt,
      incoming.updatedAt ?? incoming.createdAt,
    ),
    ...(preferred.confirmedAt || other.confirmedAt
      ? { confirmedAt: preferred.confirmedAt ?? other.confirmedAt }
      : {}),
    ...(preferred.confirmedBy || other.confirmedBy
      ? { confirmedBy: preferred.confirmedBy ?? other.confirmedBy }
      : {}),
    ...(existing.retainedAfterSourceDeletion || incoming.retainedAfterSourceDeletion
      ? { retainedAfterSourceDeletion: true }
      : {}),
  };
};

/** Preserve the old version; a fresh extraction must never overwrite a reviewed memory. */
const mergeAtomicMemories = (current: AvatarAtomicMemory[], incoming: AvatarAtomicMemory[]) => {
  const byId = new Map(current.map((memory) => [memory.id, memory]));
  for (const memory of incoming) {
    const matchingMemory = Array.from(byId.values()).find((candidate) => {
      if (candidate.id === memory.id) return false;
      const sameStatement =
        memoryStatementKey(candidate.statement) === memoryStatementKey(memory.statement);
      const samePatternKey =
        candidate.status === 'candidate' &&
        memory.status === 'candidate' &&
        candidate.facets.includes('cognitive_pattern') &&
        memory.facets.includes('cognitive_pattern') &&
        !!candidate.patternKey &&
        candidate.patternKey === memory.patternKey;
      return sameStatement || samePatternKey;
    });
    if (matchingMemory) {
      byId.set(matchingMemory.id, mergeSameStatementMemory(matchingMemory, memory));
      continue;
    }
    const previous = byId.get(memory.id);
    if (previous && memory.status === 'candidate' && previous.status !== 'candidate') continue;
    if (previous && previous.statement !== memory.statement) {
      const historyId = stableAvatarId('atomic_history', [
        previous.id,
        previous.statement,
        previous.createdAt,
      ]);
      memory.previousVersionId = historyId;
      byId.set(historyId, {
        ...previous,
        id: historyId,
        status: 'superseded',
        validTo: memory.updatedAt ?? memory.createdAt,
      });
    }
    byId.set(memory.id, memory);
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, MAX_ATOMIC_MEMORIES);
};

export const writeAvatarAtomicMemory = (memory: AvatarAtomicMemory): boolean => {
  const [sanitized] = sanitizeAvatarAtomicMemories([memory]);
  if (!sanitized) return false;
  const saved = setStoredJson(
    ATOMIC_MEMORY_KEY,
    mergeAtomicMemories(readAvatarAtomicMemories(), [sanitized]),
  );
  if (saved) writeAvatarMemoryTags(upsertTagCatalogEntries(sanitized.tags));
  return saved;
};

export const upsertAvatarAtomicMemories = (memories: AvatarAtomicMemory[]): boolean => {
  const sanitized = sanitizeAvatarAtomicMemories(memories);
  if (!sanitized.length) return true;
  const saved = setStoredJson(
    ATOMIC_MEMORY_KEY,
    mergeAtomicMemories(readAvatarAtomicMemories(), sanitized),
  );
  if (saved)
    writeAvatarMemoryTags(upsertTagCatalogEntries(sanitized.flatMap((memory) => memory.tags)));
  return saved;
};

export const updateAvatarAtomicMemoryStatus = (
  id: string,
  status: AvatarMemoryStatus,
): AvatarAtomicMemory | null => {
  const current = readAvatarAtomicMemories();
  const target = current.find((item) => item.id === id);
  if (!target) return null;
  const now = Date.now();
  const updated: AvatarAtomicMemory =
    status === 'confirmed'
      ? {
          ...target,
          status,
          updatedAt: now,
          confirmedAt: target.confirmedAt ?? now,
          confirmedBy: target.confirmedBy ?? ('user' as const),
        }
      : { ...target, status, updatedAt: now };
  const saved = setStoredJson(
    ATOMIC_MEMORY_KEY,
    current.map((item) => (item.id === id ? updated : item)),
  );
  return saved ? updated : null;
};

/**
 * Replacing a confirmed memory preserves the earlier wording as history.  This
 * is deliberately one persistence operation: a failed save must not leave the
 * live statement hidden without its replacement.
 */
export const supersedeAvatarAtomicMemory = (
  id: string,
  statement: string,
): AvatarAtomicMemory | null => {
  const text = statement.trim();
  const current = readAvatarAtomicMemories();
  const target = current.find((memory) => memory.id === id);
  if (!target || !text || target.status !== 'confirmed') return null;
  // Do not make “我的变化” noisy when the user only adjusted punctuation or
  // spacing. The current wording is already sufficient in that case.
  if (!hasMeaningfulStatementChange(target.statement, text)) return target;
  const now = Date.now();
  const next: AvatarAtomicMemory = {
    ...target,
    id: generateSecureId('avatar-memory'),
    previousVersionId: target.id,
    statement: text,
    status: 'confirmed',
    validFrom: now,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    confirmedBy: 'user',
  };
  const previous: AvatarAtomicMemory = {
    ...target,
    status: 'superseded',
    validTo: now,
    updatedAt: now,
  };
  const saved = setStoredJson(
    ATOMIC_MEMORY_KEY,
    current.map((memory) => (memory.id === id ? previous : memory)).concat(next),
  );
  if (!saved) return null;
  writeAvatarMemoryTags(upsertTagCatalogEntries(next.tags, now));
  return next;
};

export interface PruneAvatarAtomicMemoriesResult {
  removedMemoryIds: string[];
  memories: AvatarAtomicMemory[];
}

export const pruneAvatarAtomicMemoriesBySourceIds = (
  sourceIds: Iterable<string>,
  retainOrphans = false,
  persist = true,
): PruneAvatarAtomicMemoriesResult => {
  const idsToDelete = new Set(sourceIds);
  const current = readAvatarAtomicMemories();
  if (!idsToDelete.size) return { removedMemoryIds: [], memories: current };
  const removedMemoryIds: string[] = [];
  const now = Date.now();
  const memories = current.flatMap((memory) => {
    if (!memory.sourceRefs.length) return [memory];
    const remainingRefs = memory.sourceRefs.filter((ref) => !idsToDelete.has(ref.id));
    if (remainingRefs.length === memory.sourceRefs.length) return [memory];
    if (!remainingRefs.length) {
      if (retainOrphans) {
        return [
          {
            ...memory,
            sourceRefs: [],
            status: memory.status === 'confirmed' ? ('retained' as const) : memory.status,
            retainedAfterSourceDeletion: true,
            updatedAt: now,
          },
        ];
      }
      removedMemoryIds.push(memory.id);
      return [];
    }
    return [{ ...memory, sourceRefs: remainingRefs, updatedAt: now }];
  });
  if (persist && !setStoredJson(ATOMIC_MEMORY_KEY, memories))
    throw new Error('分身记忆关联保存失败，请重试');
  return { removedMemoryIds, memories };
};
