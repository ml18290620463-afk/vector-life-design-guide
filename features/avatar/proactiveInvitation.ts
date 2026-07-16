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
    .filter((entry) => !entry.isLocked && !entry.isArchived && !entry.isSample)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8);

  if (available.length === 0) {
    return {
      eyebrow: '从此刻开始',
      title: '不用想好再开口',
      context: '你可以先说一句没整理好的话，我会先听，再帮你看见另一个角度。',
      prompts: ['我最近总在想一件事', '我现在有点说不清的感受', '陪我梳理今天'],
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
      eyebrow: '我注意到一个反复出现的信号',
      title: `「${repeated[0]}」最近出现了 ${repeated[1]} 次`,
      context: '这不一定是结论。我想和你一起判断：它是暂时状态，还是正在形成的模式？',
      prompts: [
        `帮我看看「${repeated[0]}」为什么反复出现`,
        '它和以前有什么不同？',
        '我想先说说最近发生的事',
      ],
    };
  }

  const latest = available[0];
  return {
    eyebrow: '有一件事值得回来看看',
    title: `关于「${compactTitle(latest.title)}」，我有个问题`,
    context: '我不知道后来发生了什么。如果你愿意，我们可以用现在的视角重新看它。',
    prompts: ['这件事后来有变化吗？', '现在回看，我当时忽略了什么？', '帮我找找相似的过去经历'],
    sourceEntryId: latest.id,
  };
};
