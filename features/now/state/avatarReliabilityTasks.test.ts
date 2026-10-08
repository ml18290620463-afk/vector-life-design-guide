import { describe, expect, it } from 'vitest';
import { detectAvatarReliabilityTask, reliabilityReply } from './avatarReliabilityTasks';

describe('avatar reliability task detection', () => {
  it.each([
    ['帮我恢复刚才没写完的草稿', 'draft'],
    ['我想继续编辑未完成记录', 'draft'],
    ['帮我生成一份备份', 'backup'],
    ['我要从备份恢复数据', 'backup'],
    ['我的资料是否已经加密保护？', 'security'],
    ['我需要解锁资料库', 'security'],
  ] as const)('recognizes %s as %s', (input, expected) => {
    expect(detectAvatarReliabilityTask(input)).toBe(expected);
  });

  it('does not intercept ordinary reflection', () => {
    expect(detectAvatarReliabilityTask('我想理清这次拖延背后的原因')).toBeNull();
    expect(detectAvatarReliabilityTask('')).toBeNull();
  });

  it('explains each task without claiming model access to private content', () => {
    expect(reliabilityReply('draft')).toContain('未完成记录');
    expect(reliabilityReply('backup')).toContain('备份');
    expect(reliabilityReply('security')).toContain('密令不会出现在对话中');
  });
});
