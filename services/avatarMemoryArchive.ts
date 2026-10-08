import type { AvatarAtomicMemory, AvatarUnderstandingVersion } from '../features/avatar/types';
import { isCanonicalAvatarProjection } from './avatarKnowledgeProjection';
import {
  readAvatarAtomicMemories,
  supersedeAvatarUnderstanding,
  updateAvatarUnderstandingStatus,
  writeAvatarAtomicMemory,
  supersedeAvatarAtomicMemory,
} from './avatarMemory';
import { categoryForMemory } from './avatarMemoryCategories';
import { hasMeaningfulStatementChange } from './avatarMemoryShared';

/** Canonical plans/principles are managed through their original repositories, not text copies. */
export const isArchiveMemory = (memory: AvatarAtomicMemory) => !isCanonicalAvatarProjection(memory);

/** A proposed commitment can be handed to the future module after user confirmation. */
export const isDirectionCandidate = (
  memory: Pick<AvatarAtomicMemory, 'nature' | 'category' | 'facets'>,
) =>
  memory.nature === 'commitment' ||
  memory.category === 'goals' ||
  memory.facets.includes('aspirational_self');

export function saveArchiveMemory(
  memory: AvatarAtomicMemory,
  statement: string,
  status: 'confirmed' | 'rejected',
): boolean {
  const text = statement.trim();
  if (!text || (!isArchiveMemory(memory) && !memory.id.startsWith('atomic_pattern_'))) return false;
  if (memory.id.startsWith('atomic_pattern_')) {
    const owner = memory.sourceRefs.find((ref) => ref.source === 'pattern');
    return !!owner && !!updateAvatarUnderstandingStatus(owner.id, status, text);
  }
  const current = readAvatarAtomicMemories().find((item) => item.id === memory.id);
  if (!current) return false;
  const now = Date.now();
  return writeAvatarAtomicMemory({
    ...current,
    statement: text,
    category:
      text === current.statement
        ? current.category
        : categoryForMemory({ ...current, statement: text, category: undefined }),
    status,
    updatedAt: now,
    ...(status === 'confirmed' ? { confirmedAt: now, confirmedBy: 'user' as const } : {}),
  });
}

/** Keep the previous user-confirmed statement visible in “我的变化” when it changes. */
export function supersedeArchiveMemory(memory: AvatarAtomicMemory, statement: string): boolean {
  if (memory.id.startsWith('atomic_pattern_')) {
    const owner = memory.sourceRefs.find((ref) => ref.source === 'pattern');
    return !!owner && !!supersedeAvatarUnderstanding(owner.id, statement);
  }
  if (!isArchiveMemory(memory)) return false;
  return !!supersedeAvatarAtomicMemory(memory.id, statement);
}

/** State and temporary conditions benefit from a lightweight validity check. */
export const isTimeSensitiveMemory = (memory: Pick<AvatarAtomicMemory, 'category' | 'nature'>) =>
  memory.category === 'recent_state' || memory.nature === 'state';

export const SELF_CATEGORIES = [
  { id: 'profile', label: '基础信息' },
  { id: 'preference_boundary', label: '偏好与边界' },
  { id: 'value_motivation', label: '价值与动力' },
  { id: 'ability_condition', label: '能力与条件' },
] as const;
export type SelfCategory = (typeof SELF_CATEGORIES)[number]['id'];

/** Display index only: one memory may match several facets without being copied. */
export function selfCategoriesForMemory(
  memory: Pick<AvatarAtomicMemory, 'facets'>,
): SelfCategory[] {
  const categories: SelfCategory[] = [];
  if (memory.facets.some((facet) => ['domain_background'].includes(facet)))
    categories.push('profile');
  if (memory.facets.some((facet) => ['preference', 'aversion', 'boundary'].includes(facet)))
    categories.push('preference_boundary');
  if (memory.facets.some((facet) => ['value', 'motivation'].includes(facet)))
    categories.push('value_motivation');
  if (memory.facets.some((facet) => ['skill', 'constraint', 'recovery_resource'].includes(facet)))
    categories.push('ability_condition');
  return categories.length ? categories : ['profile'];
}

/** Ownership comes from canonical identity, never from a secondary evidence reference. */
export function archiveScopeForMemory(memory: AvatarAtomicMemory): 'self' | 'pattern' | null {
  if (memory.id.startsWith('atomic_pattern_')) return 'pattern';
  if (
    isCanonicalAvatarProjection(memory) ||
    isDirectionCandidate(memory) ||
    memory.nature === 'experience'
  )
    return null;
  if (
    memory.facets.some((facet) =>
      [
        'habit',
        'cognitive_pattern',
        'behavioral_pattern',
        'emotional_pattern',
        'relational_pattern',
        'emotional_trigger',
      ].includes(facet),
    )
  )
    return 'pattern';
  return 'self';
}

export interface ArchiveChange {
  id: string;
  before: string;
  after: string;
  at: number;
}

/** Only explicit, user-reviewed version links qualify. Edits describe updated understanding, not proven growth. */
export function archiveChanges(
  memories: AvatarAtomicMemory[],
  patterns: AvatarUnderstandingVersion[],
): ArchiveChange[] {
  const changes: ArchiveChange[] = [];
  const live = (m: AvatarAtomicMemory) => ['confirmed', 'retained'].includes(m.status);
  for (const current of memories.filter(live)) {
    if (!archiveScopeForMemory(current)) continue;
    const before = memories.find(
      (m) => m.id === current.previousVersionId && m.status === 'superseded' && !!m.confirmedAt,
    );
    if (before && hasMeaningfulStatementChange(before.statement, current.statement))
      changes.push({
        id: current.id,
        before: before.statement,
        after: current.statement,
        at: current.updatedAt ?? current.createdAt,
      });
  }
  for (const current of patterns.filter((p) => p.status === 'confirmed')) {
    const before = patterns.find(
      (p) => p.id === current.previousVersionId && p.status === 'superseded' && !!p.confirmedAt,
    );
    if (before && hasMeaningfulStatementChange(before.statement, current.statement))
      changes.push({
        id: `pattern:${current.id}`,
        before: before.statement,
        after: current.statement,
        at: current.updatedAt ?? current.createdAt,
      });
  }
  return changes.sort((a, b) => b.at - a.at);
}
