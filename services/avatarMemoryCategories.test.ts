import { describe, expect, it } from 'vitest';
import {
  categoryForMemory,
  MEMORY_CATEGORIES,
  normalizeMemoryCategory,
} from './avatarMemoryCategories';
import { sanitizeAvatarAtomicMemories } from './avatarMemory';

describe('memory categories', () => {
  it('provides the eight requested categories in order', () => {
    expect(Object.values(MEMORY_CATEGORIES).map((value) => value.label)).toEqual([
      '基础事实',
      '事件经历',
      '认知观点',
      '行为习惯',
      '目标计划',
      '状态偏好',
      '关系任务',
      '表达风格',
    ]);
  });
  it('keeps temporary feelings as state and retains evidence when categorizing', () => {
    const memory = {
      id: 'state',
      statement: '今天紧张',
      nature: 'state',
      facets: ['emotional_pattern'],
      tags: [],
      contexts: [],
      category: 'recent_state',
      sourceRefs: [{ source: 'message', id: 'source-1', excerpt: '今天紧张' }],
      confidence: 0.5,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 100,
      confirmedAt: 110,
      confirmedBy: 'user',
    };
    const [stored] = sanitizeAvatarAtomicMemories([memory]);
    expect(stored).toMatchObject(memory);
    expect(categoryForMemory(stored)).toBe('recent_state');
  });
  it('maps old category names without dropping their grouping', () => {
    expect(normalizeMemoryCategory('values')).toBe('judgment');
    expect(normalizeMemoryCategory('plans')).toBe('goals');
    expect(normalizeMemoryCategory('skills')).toBe('profile');
    expect(normalizeMemoryCategory('unknown')).toBeUndefined();
  });
  it('uses nature before generic facets for legacy memories', () => {
    expect(
      categoryForMemory({ nature: 'experience', statement: '一次复盘', facets: ['habit'] }),
    ).toBe('experience');
    expect(categoryForMemory({ nature: 'state', statement: '今天的感受', facets: ['value'] })).toBe(
      'recent_state',
    );
    expect(
      categoryForMemory({ nature: 'explicit', statement: '偏好短句', facets: ['preference'] }),
    ).toBe('recent_state');
  });
});
