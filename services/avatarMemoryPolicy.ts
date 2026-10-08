import type { AvatarAtomicMemory, AvatarMemoryNature } from '../features/avatar/types';

export const MEMORY_NATURE_LABELS: Record<AvatarMemoryNature, string> = {
  explicit: '明确表达 · 资料、偏好或观点',
  experience: '具体经历 · 已发生的事情',
  commitment: '计划与承诺 · 尚未完成',
  state: '当时状态 · 情绪或感受',
  inferred: '待验证理解 · 推断或混合小结',
};

/** Only the complete, reviewed naming statement may establish avatar identity. */
export const readAvatarNameStatement = (text: string): string | null =>
  text.trim().match(/^用户为分身取名为「([^「」\n]{1,12})」[。]?$/)?.[1] ?? null;

/** Suggestions only: the user can correct this before saving. Ambiguity stays inferred. */
export function suggestMemoryNature(text: string): AvatarMemoryNature {
  if (readAvatarNameStatement(text)) return 'explicit';
  if (/(可能|似乎|也许|推测|猜测|大概)/.test(text)) return 'inferred';
  const kinds = new Set<AvatarMemoryNature>();
  if (/(打算|计划|准备|承诺|决定|目标是)/.test(text)) kinds.add('commitment');
  if (/(焦虑|难过|开心|生气|委屈|害怕|压力|很累)/.test(text)) kinds.add('state');
  if (/(喜欢|偏好|讨厌|不喜欢|倾向|原则是|不能接受|底线是)/.test(text)) kinds.add('explicit');
  if (/(昨天|上周|去年|经历了|发生了|完成了|参加了)/.test(text)) kinds.add('experience');
  return kinds.size === 1 ? [...kinds][0] : 'inferred';
}

/** End time is exclusive; absent bounds mean unknown, not a fabricated date. */
export function isCurrentAvatarMemory(memory: AvatarAtomicMemory, now = Date.now()): boolean {
  return (
    (memory.status === 'confirmed' || memory.status === 'retained') &&
    (memory.validFrom === undefined || memory.validFrom <= now) &&
    (memory.validTo === undefined || now < memory.validTo)
  );
}
