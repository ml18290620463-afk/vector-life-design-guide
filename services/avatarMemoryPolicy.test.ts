import { describe, expect, it } from 'vitest';
import type { AvatarAtomicMemory } from '../features/avatar/types';
import {
  isCurrentAvatarMemory,
  readAvatarNameStatement,
  suggestMemoryNature,
} from './avatarMemoryPolicy';

const memory: AvatarAtomicMemory = {
  id: 'test',
  statement: '喜欢散步',
  nature: 'explicit',
  facets: ['preference'],
  tags: [],
  contexts: [],
  sourceRefs: [],
  confidence: 0.7,
  status: 'confirmed',
  sensitivity: 'normal',
  createdAt: 1,
};

describe('avatar memory policy', () => {
  it('suggests conservative natures without promoting ambiguous summaries to facts', () => {
    expect(suggestMemoryNature('我喜欢散步')).toBe('explicit');
    expect(suggestMemoryNature('计划去登山')).toBe('commitment');
    expect(suggestMemoryNature('现在很焦虑')).toBe('state');
    expect(suggestMemoryNature('昨天参加了聚会')).toBe('experience');
    expect(suggestMemoryNature('昨天很焦虑，计划去登山')).toBe('inferred');
    expect(suggestMemoryNature('可能喜欢散步')).toBe('inferred');
    expect(suggestMemoryNature('未能分类的内容')).toBe('inferred');
  });
  it('recognizes only complete canonical identity statements', () => {
    expect(readAvatarNameStatement('用户为分身取名为「小树」')).toBe('小树');
    expect(readAvatarNameStatement('朋友说用户为分身取名为「小树」')).toBeNull();
    expect(readAvatarNameStatement('用户为分身取名为「小树」但尚未确定')).toBeNull();
  });
  it('enforces review status and inclusive start / exclusive end', () => {
    expect(isCurrentAvatarMemory({ ...memory, validFrom: 100, validTo: 200 }, 100)).toBe(true);
    expect(isCurrentAvatarMemory({ ...memory, validFrom: 100 }, 99)).toBe(false);
    expect(isCurrentAvatarMemory({ ...memory, validTo: 200 }, 200)).toBe(false);
    expect(isCurrentAvatarMemory(memory, 100)).toBe(true);
    for (const status of ['candidate', 'rejected', 'superseded'] as const)
      expect(isCurrentAvatarMemory({ ...memory, status }, 100)).toBe(false);
    expect(isCurrentAvatarMemory({ ...memory, status: 'retained' }, 100)).toBe(true);
  });
});
