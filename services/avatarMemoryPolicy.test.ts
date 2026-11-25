import { describe, expect, it } from 'vitest';
import { readAvatarNameStatement, suggestMemoryNature } from './avatarMemoryPolicy';

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
});
