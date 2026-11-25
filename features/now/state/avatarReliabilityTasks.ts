export type AvatarReliabilityTask = 'draft' | 'security' | 'backup';

/**
 * Keep operational requests out of the model path. These commands work even
 * when an AI provider is unavailable, and never expose private record content.
 */
export function detectAvatarReliabilityTask(input: string): AvatarReliabilityTask | null {
  const value = input.trim();
  if (!value) return null;
  if (
    /(draft|resume writing|草稿|未完成(?:的)?记录|继续(?:写|编辑)|找回(?:刚才|未完成))/i.test(value)
  )
    return 'draft';
  if (
    /(backup|restore data|export data|备份|恢复(?:备份|数据)|导入(?:备份|数据)|导出(?:备份|数据))/i.test(
      value,
    )
  )
    return 'backup';
  if (/(encrypt|security|protect data|unlock|加密|安全|保护(?:数据|资料)|密令|解锁)/i.test(value))
    return 'security';
  return null;
}

export const reliabilityReply = (task: AvatarReliabilityTask, language: 'zh' | 'en' = 'zh') => {
  if (language === 'en') {
    if (task === 'draft') return 'I can help you resume an unfinished record on this device.';
    if (task === 'security')
      return 'I can check protection on this device. Your password will not appear in this conversation.';
    return 'I can export or restore a backup. Exports are encrypted only when password protection is enabled. You can choose merge or replace before restoring.';
  }
  if (task === 'draft') return '我可以帮你查看这台设备上的未完成记录，并带你回到它继续写。';
  if (task === 'security') return '我可以检查这台设备的资料库保护状态。你的密令不会出现在对话中。';
  return '我可以导出或恢复备份；只有启用密码保护后，导出的文件才会加密。恢复前会保留清晰的合并或替换选择。';
};
