import { CONFIG } from '../constants/config';
import { EVENT_TAGS, MOOD_TAGS } from '../constants/tags';
import type { Material, MaterialType, NowDraft, NowRecord } from '../types/now';

export const createEmptyDraft = (date = new Date()): NowDraft => ({
  text: '',
  materials: [],
  mood_tags: [],
  event_tags: [],
  record_time: date.toISOString(),
  display_time: formatDisplayTime(date),
  updated_at: date.toISOString(),
});

export const formatDisplayTime = (date: Date): string =>
  `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}点${date.getMinutes()}分`;

export const hasDraftContent = (draft: Pick<NowDraft, 'text' | 'materials'>): boolean =>
  draft.text.trim().length > 0 || draft.materials.length > 0;

export const isDraftEmpty = (draft: NowDraft): boolean =>
  draft.text.trim().length === 0 &&
  draft.materials.length === 0 &&
  draft.mood_tags.length === 0 &&
  draft.event_tags.length === 0;

export const getCanSend = (
  draft: Pick<NowDraft, 'text' | 'materials' | 'mood_tags' | 'event_tags'>,
): boolean =>
  hasDraftContent(draft) && draft.mood_tags.length >= 1 && draft.event_tags.length >= 1;

export const getDisabledSendReason = (
  draft: Pick<NowDraft, 'text' | 'materials' | 'mood_tags' | 'event_tags'>,
): string | null => {
  if (!hasDraftContent(draft)) return '请先输入内容或添加素材';
  if (draft.mood_tags.length < 1) return '请选择心情标签';
  if (draft.event_tags.length < 1) return '请选择事件标签';
  return null;
};

export const validateTags = (
  moodTags: string[],
  eventTags: string[],
  customAnchors: string[] = [],
): { ok: true } | { ok: false; message: string } => {
  if (moodTags.length < CONFIG.MIN_MOOD_TAGS) return { ok: false, message: '请选择心情标签' };
  if (eventTags.length < CONFIG.MIN_EVENT_TAGS) return { ok: false, message: '请选择事件标签' };
  if (moodTags.length > CONFIG.MAX_MOOD_TAGS) return { ok: false, message: '心情标签最多 3 个' };
  if (eventTags.length > CONFIG.MAX_EVENT_TAGS) return { ok: false, message: '事件标签最多 3 个' };
  const custom = new Set(customAnchors);
  if (moodTags.some((tag) => !MOOD_TAGS.includes(tag))) {
    return { ok: false, message: '存在未知心情标签' };
  }
  if (eventTags.some((tag) => !EVENT_TAGS.includes(tag) && !custom.has(tag))) {
    return { ok: false, message: '存在未知事件标签' };
  }
  return { ok: true };
};

export const validateMaterials = (
  materials: Material[],
): { ok: true } | { ok: false; message: string } => {
  const counts = materials.reduce<Record<MaterialType, number>>(
    (acc, material) => {
      acc[material.type] += 1;
      return acc;
    },
    { image: 0, video: 0, link: 0, audio: 0 },
  );

  if (counts.image > CONFIG.MAX_IMAGES) return { ok: false, message: '图片最多 8 张' };
  if (counts.video > 1) return { ok: false, message: '视频最多 1 个' };
  if (counts.link > 1) return { ok: false, message: '链接最多 1 个' };
  if (counts.audio > 1) return { ok: false, message: '音频最多 1 个' };
  if (counts.video > 0 && (counts.image > 0 || counts.link > 0 || counts.audio > 0)) {
    return { ok: false, message: '视频不能与图片、链接或音频同时添加' };
  }
  if (counts.link > 0 && (counts.image > 0 || counts.video > 0)) {
    return { ok: false, message: '链接不能与图片或视频同时添加' };
  }
  return { ok: true };
};

export const canAddMaterialType = (
  materials: Material[],
  nextType: MaterialType,
): { ok: true } | { ok: false; message: string } => {
  const next = [...materials, { id: 'probe', type: nextType, url: '', sort_order: materials.length }];
  return validateMaterials(next);
};

export const buildRecordFromDraft = (
  draft: NowDraft,
  source: NowRecord['source'],
  avatarSessionId: string | null = null,
): Omit<NowRecord, 'id' | 'sync_status'> => ({
  created_at: draft.record_time,
  display_time: draft.display_time,
  text: draft.text.trim() ? draft.text.trim() : null,
  materials: draft.materials,
  mood_tags: draft.mood_tags,
  event_tags: draft.event_tags,
  source,
  avatar_session_id: avatarSessionId,
});

export const isContentSufficient = (
  userMessages: Array<{ content: string; type?: string; audioMs?: number }>,
): boolean => {
  const effectiveMessages = userMessages.filter((message) => hasRecordableInformation(message.content));
  const totalAudioMs = userMessages.reduce((sum, message) => sum + (message.audioMs ?? 0), 0);
  return (
    effectiveMessages.length >= CONFIG.SUFFICIENT_MIN_MESSAGES ||
    effectiveMessages.some((message) => message.content.trim().length >= CONFIG.SUFFICIENT_MIN_CHARS) ||
    totalAudioMs >= CONFIG.SUFFICIENT_MIN_AUDIO_MS
  );
};

export const hasRecordableInformation = (content: string): boolean => {
  const text = content.trim();
  if (!text) return false;
  const compact = text.replace(/\s+/g, '');
  const chineseChars = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z]{2,}/g) ?? [];
  const eventSignals = [
    '今天',
    '昨天',
    '刚刚',
    '上午',
    '下午',
    '晚上',
    '发生',
    '看到',
    '听到',
    '做了',
    '说了',
    '没做',
    '觉得',
    '感觉',
    '想到',
    '决定',
    '完成',
    '结果',
    '因为',
    '所以',
    '工作',
    '项目',
    '家人',
    '朋友',
    '身体',
  ];
  const hasSignal = eventSignals.some((signal) => text.includes(signal));
  if (chineseChars >= 8 && hasSignal) return true;
  if (chineseChars >= 18) return true;
  if (latinWords.length >= 5 && latinWords.join('').length >= 20) return true;
  return false;
};

export const getRecordableInformation = (messages: Array<{ content: string }>): string[] =>
  messages.map((message) => message.content.trim()).filter(hasRecordableInformation);

export interface AvatarInformationSlots {
  hasFact: boolean;
  hasAction: boolean;
  hasFeeling: boolean;
  hasThought: boolean;
  hasResult: boolean;
}

export const analyzeAvatarInformation = (messages: Array<{ content: string }>): AvatarInformationSlots => {
  const text = messages.map((message) => message.content.trim()).filter(Boolean).join('\n');
  return {
    hasFact:
      /今天|昨天|刚刚|上午|下午|晚上|发生|看到|听到|遇到|收到|去了|来了|工作|项目|会议|家人|朋友|同事|身体/.test(
        text,
      ),
    hasAction: /我做|我说|我没|我去了|我完成|我决定|我选择|回复|拒绝|接受|处理|推进|整理|复盘/.test(text),
    hasFeeling:
      /开心|高兴|兴奋|焦虑|担心|不开心|难过|愤怒|生气|委屈|疲惫|累了|迷茫|感动|平静|害怕|失落|压力/.test(
        text,
      ),
    hasThought: /我想|觉得|感觉|认为|意识到|明白|理解|判断|希望|担心|在意|因为|所以/.test(text),
    hasResult: /结果|最后|后来|现在|已经|完成|结束|变成|导致|影响|收获|没成功|成功/.test(text),
  };
};

export const buildAdaptiveFollowup = (
  messages: Array<{ content: string }>,
  followupCount: number,
): string | null => {
  const latest = messages[messages.length - 1]?.content.trim() ?? '';
  const slots = analyzeAvatarInformation(messages);
  const hasAnyRecordable = messages.some((message) => hasRecordableInformation(message.content));

  if (!hasAnyRecordable && slots.hasFeeling) {
    return `我听到你现在${latest.includes('不开心') ? '不开心' : '有情绪'}。为了把它记清楚，刚才具体发生了什么？涉及谁，在哪里？`;
  }
  if (!hasAnyRecordable) {
    return followupCount === 0
      ? '我还没抓到可记录的事实。你可以只补一句：什么时候、发生了什么、涉及谁？'
      : '这还不足以成为一条记录。请说一件具体发生的事，或者回到手动记录。';
  }
  if (!slots.hasFact) return '你刚才说的是感受或想法。它是由哪件具体事情引起的？';
  if (!slots.hasFeeling) return '这件事我大概知道了。你当时或现在最明显的感受是什么？';
  if (!slots.hasThought && followupCount < 2) return '你当时心里怎么理解这件事？有没有一个比较明确的判断？';
  if (!slots.hasResult && followupCount < 2) return '这件事最后变成了什么结果？和你原本期待的一样吗？';
  return null;
};
