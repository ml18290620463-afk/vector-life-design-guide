import type { DiaryEntry } from '../../types';

export interface AvatarProactiveInvitation {
  eyebrow: string;
  title: string;
  context: string;
  prompts: string[];
  sourceEntryId?: string;
}

const cleanTag = (tag: string) => tag.replace(/^(心情|事件)[:：]/, '').trim();

const compactTitle = (title: string) => {
  const normalized = title.replace(/\s+/g, ' ').trim();
  return normalized.length > 22 ? `${normalized.slice(0, 22)}…` : normalized;
};

export const buildAvatarProactiveInvitation = (
  entries: DiaryEntry[],
): AvatarProactiveInvitation => {
  const available = entries
    .filter((entry) => !entry.isLocked && !entry.isSample)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8);

  if (available.length === 0) {
    return {
      eyebrow: '开始',
      title: '认识你的分身',
      context: '连接过去、现在与未来。',
      prompts: ['认识我', '我在意什么', '如何开始'],
    };
  }

  const counts = new Map<string, number>();
  available.forEach((entry) => {
    new Set(entry.tags.map(cleanTag).filter(Boolean)).forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });
  const repeated = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];

  if (repeated && repeated[1] >= 2) {
    return {
      eyebrow: '重复标签',
      title: `「${repeated[0]}」${repeated[1]} 次`,
      context: '连接不同时间里的你。',
      prompts: ['为什么反复出现', '和过去相比', '形成一条理解'],
    };
  }

  const latest = available[0];
  return {
    eyebrow: '最近记录',
    title: `「${compactTitle(latest.title)}」`,
    context: '连接不同时间里的你。',
    prompts: ['这说明了什么', '和过去相比', '形成一条理解'],
    sourceEntryId: latest.id,
  };
};
