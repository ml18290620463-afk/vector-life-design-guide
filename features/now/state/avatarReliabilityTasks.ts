export type AvatarReliabilityTask = 'draft' | 'security' | 'backup';

/**
 * Keep operational requests out of the model path. These commands work even
 * when an AI provider is unavailable, and never expose private record content.
 */
export function detectAvatarReliabilityTask(input: string): AvatarReliabilityTask | null {
  const value = input.trim();
  if (!value) return null;
  if (/(草稿|未完成(?:的)?记录|继续(?:写|编辑)|找回(?:刚才|未完成))/.test(value)) return 'draft';
  if (/(备份|恢复(?:备份|数据)|导入(?:备份|数据)|导出(?:备份|数据))/.test(value)) return 'backup';
  if (/(加密|安全|保护(?:数据|资料)|密令|解锁)/.test(value)) return 'security';
  return null;
}

export const reliabilityReply = (task: AvatarReliabilityTask) => {
  if (task === 'draft') return '我可以帮你查看这台设备上的未完成记录，并带你回到它继续写。';
  if (task === 'security') return '我可以检查这台设备的资料库保护状态。你的密令不会出现在对话中。';
  return '我可以为你生成一份加密备份，或从备份文件恢复资料。恢复前会保留清晰的合并或替换选择。';
};
