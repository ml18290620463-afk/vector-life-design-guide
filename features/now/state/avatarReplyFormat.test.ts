import { describe, expect, it } from 'vitest';
import { formatAvatarReply } from './avatarReplyFormat';

describe('avatar reply display', () => {
  it('removes leaked heading and bold syntax without removing content', () => {
    expect(formatAvatarReply('## 当前选择\n**先休息**，再决定。\n---\n1. 看看条件'))
      .toBe('当前选择\n先休息，再决定。\n\n1. 看看条件');
  });
  it('preserves code, evidence quotes, arithmetic and ordinary lists', () => {
    const text = '「**原文**」 “**引用**” "**literal**"\n> **引用行**\n`a ** b`\n```js\nconst x = 2 ** 3;\n```\n2 * 3 = 6\n- 项目\nhttps://example.com';
    expect(formatAvatarReply(text)).toBe(text);
  });
  it('preserves incomplete streamed code fences and unmatched markers', () => {
    expect(formatAvatarReply('```js\n**literal**')).toBe('```js\n**literal**');
    expect(formatAvatarReply('未闭合 **文字')).toBe('未闭合 **文字');
  });
});
