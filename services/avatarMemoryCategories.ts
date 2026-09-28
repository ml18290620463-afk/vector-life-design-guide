import type { AvatarAtomicMemory, AvatarMemoryCategory } from '../features/avatar/types';

export const MEMORY_CATEGORIES: Record<AvatarMemoryCategory, { label: string }> = {
  profile: { label: '基础事实' },
  experience: { label: '事件经历' },
  judgment: { label: '认知观点' },
  habits: { label: '行为习惯' },
  goals: { label: '目标计划' },
  recent_state: { label: '状态偏好' },
  relationship: { label: '关系任务' },
  expression: { label: '表达风格' },
};
export const isMemoryCategory = (value: unknown): value is AvatarMemoryCategory =>
  typeof value === 'string' && Object.hasOwn(MEMORY_CATEGORIES, value);

export function normalizeMemoryCategory(value: unknown): AvatarMemoryCategory | undefined {
  if (isMemoryCategory(value)) return value;
  if (value === 'values') return 'judgment';
  if (value === 'skills') return 'profile';
  if (value === 'plans') return 'goals';
  return undefined;
}

/** Legacy display fallback; evidence and memory nature remain unchanged. */
export function categoryForMemory(
  memory: Pick<AvatarAtomicMemory, 'category' | 'nature' | 'facets' | 'statement'>,
): AvatarMemoryCategory {
  const category = normalizeMemoryCategory(memory.category);
  if (category) return category;
  if (memory.nature === 'state') return 'recent_state';
  if (memory.nature === 'commitment') return 'goals';
  if (memory.nature === 'experience') return 'experience';
  if (/措辞|语气|表达风格|语言风格|简短.*语句|直接.*表达/.test(memory.statement))
    return 'expression';
  if (memory.facets.some((facet) => ['habit', 'behavioral_pattern'].includes(facet)))
    return 'habits';
  if (memory.facets.includes('aspirational_self')) return 'goals';
  if (memory.facets.some((facet) => ['relational_pattern', 'relationship_view'].includes(facet)))
    return 'relationship';
  if (memory.facets.some((facet) => ['value', 'boundary', 'cognitive_pattern'].includes(facet)))
    return 'judgment';
  if (
    memory.facets.some((facet) =>
      ['preference', 'aversion', 'emotional_pattern', 'emotional_trigger'].includes(facet),
    )
  )
    return 'recent_state';
  if (memory.nature === 'inferred') return 'judgment';
  return 'profile';
}
