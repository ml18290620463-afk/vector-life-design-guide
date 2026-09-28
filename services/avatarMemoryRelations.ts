import type { AvatarMemoryRelation, AvatarMemoryRelationKind } from '../features/avatar/types';
import { getStoredJson, setStoredJson, clampConfidence, isRecord, sanitizeMemorySourceRef } from './avatarMemoryShared';
import { readAvatarUnderstandings } from './avatarMemoryUnderstandings';
import { readAvatarAtomicMemories } from './avatarMemoryAtoms';

const UNDERSTANDING_KEY = 'vector:avatar:understandings:v1';
const ATOMIC_MEMORY_KEY = 'vector:avatar:atomic-memories:v1';
const MEMORY_RELATION_KEY = 'vector:avatar:memory-relations:v1';
const MAX_MEMORY_RELATIONS = 800;
const MEMORY_RELATION_KINDS = new Set<AvatarMemoryRelationKind>(['supports', 'contradicts', 'updates', 'derived_from', 'constrains', 'serves', 'validated_by', 'same_context']);

export const sanitizeAvatarMemoryRelations = (value: unknown): AvatarMemoryRelation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.id !== 'string' ||
      typeof item.fromId !== 'string' ||
      typeof item.toId !== 'string' ||
      !MEMORY_RELATION_KINDS.has(item.kind as AvatarMemoryRelationKind) ||
      typeof item.createdAt !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        fromId: item.fromId,
        toId: item.toId,
        kind: item.kind as AvatarMemoryRelationKind,
        confidence: clampConfidence(item.confidence),
        ...(typeof item.reason === 'string' ? { reason: item.reason } : {}),
        sourceRefs: Array.isArray(item.sourceRefs)
          ? item.sourceRefs.flatMap((source) => sanitizeMemorySourceRef(source) ?? [])
          : [],
        createdAt: item.createdAt,
        ...(typeof item.updatedAt === 'number' ? { updatedAt: item.updatedAt } : {}),
      },
    ];
  });
};

export const readAvatarMemoryRelations = (): AvatarMemoryRelation[] =>
  sanitizeAvatarMemoryRelations(getStoredJson<unknown>(MEMORY_RELATION_KEY)).sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );

export const upsertAvatarMemoryRelations = (relations: AvatarMemoryRelation[]): boolean => {
  const sanitized = sanitizeAvatarMemoryRelations(relations);
  if (!sanitized.length) return true;
  const byId = new Map(readAvatarMemoryRelations().map((relation) => [relation.id, relation]));
  sanitized.forEach((relation) => byId.set(relation.id, relation));
  return setStoredJson(
    MEMORY_RELATION_KEY,
    Array.from(byId.values())
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .slice(0, MAX_MEMORY_RELATIONS),
  );
};

export const pruneAvatarMemoryRelationsByMemoryIds = (
  memoryIds: Iterable<string>,
  persist = true,
): AvatarMemoryRelation[] => {
  const ids = new Set(memoryIds);
  if (!ids.size) return readAvatarMemoryRelations();
  const next = readAvatarMemoryRelations().filter(
    (relation) => !ids.has(relation.fromId) && !ids.has(relation.toId),
  );
  if (persist && !setStoredJson(MEMORY_RELATION_KEY, next))
    throw new Error('分身关系保存失败，请重试');
  return next;
};

/** Editing evidence invalidates derived interpretations, not principles or action history. */
export function invalidateAvatarEvidence(entryId: string): void {
  const now = Date.now();
  const patternsSaved = setStoredJson(
    UNDERSTANDING_KEY,
    readAvatarUnderstandings().map((pattern) =>
      pattern.status === 'confirmed' && pattern.sourceEntryIds.includes(entryId)
        ? {
            ...pattern,
            status: 'pending',
            updatedAt: now,
            confirmedAt: undefined,
            confirmedBy: undefined,
          }
        : pattern,
    ),
  );
  const memoriesSaved = setStoredJson(
    ATOMIC_MEMORY_KEY,
    readAvatarAtomicMemories().map((memory) =>
      memory.nature === 'inferred' &&
      memory.status === 'confirmed' &&
      memory.sourceRefs.some((ref) => ref.source === 'entry' && ref.id === entryId)
        ? {
            ...memory,
            status: 'candidate',
            updatedAt: now,
            confirmedAt: undefined,
            confirmedBy: undefined,
          }
        : memory,
    ),
  );
  if (!patternsSaved || !memoriesSaved) throw new Error('关联记忆更新失败，请重试');
}
