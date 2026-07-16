import { CONFIG } from '../constants/config';
import { EVENT_TAGS, MOOD_TAGS } from '../constants/tags';
import type { DiaryEntry } from '../../../types';
import { formatNowDisplayTime } from '../../../lib/dateFormat';
import { getMaterialTitle } from '../../../lib/materialDisplay';
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

export const formatDisplayTime = formatNowDisplayTime;

export const hasDraftContent = (draft: Pick<NowDraft, 'text' | 'materials'>): boolean =>
  draft.text.trim().length > 0 || draft.materials.length > 0;

export const isDraftEmpty = (draft: NowDraft): boolean =>
  draft.text.trim().length === 0 &&
  draft.materials.length === 0 &&
  draft.mood_tags.length === 0 &&
  draft.event_tags.length === 0;

export const getCanSend = (
  draft: Pick<NowDraft, 'text' | 'materials' | 'mood_tags' | 'event_tags'>,
): boolean => hasDraftContent(draft) && draft.mood_tags.length >= 1 && draft.event_tags.length >= 1;

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
  const next = [
    ...materials,
    { id: 'probe', type: nextType, url: '', sort_order: materials.length },
  ];
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

export const recordToDiaryEntry = (
  record: Omit<NowRecord, 'id' | 'sync_status'>,
): Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'> => {
  const materialLines = record.materials.map(
    (material) => `- ${material.type}: ${getMaterialTitle(material)}`,
  );
  const content = [record.text, materialLines.length ? `\n素材:\n${materialLines.join('\n')}` : '']
    .filter(Boolean)
    .join('\n');
  return {
    title: record.display_time,
    content,
    tags: [
      ...record.mood_tags.map((tag) => `心情:${tag}`),
      ...record.event_tags.map((tag) => `事件:${tag}`),
    ],
    updatedAt: Date.now(),
    nowMaterials: record.materials,
  };
};

export const isContentSufficient = (
  userMessages: Array<{ content: string; type?: string; audioMs?: number }>,
): boolean => {
  const effectiveMessages = userMessages.filter((message) =>
    hasRecordableInformation(message.content),
  );
  const totalAudioMs = userMessages.reduce((sum, message) => sum + (message.audioMs ?? 0), 0);
  return (
    effectiveMessages.length >= CONFIG.SUFFICIENT_MIN_MESSAGES ||
    effectiveMessages.some(
      (message) => message.content.trim().length >= CONFIG.SUFFICIENT_MIN_CHARS,
    ) ||
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

export interface AvatarStructuredInsight {
  fact: string | null;
  action: string | null;
  feeling: string | null;
  thought: string | null;
  result: string | null;
  moodTags: string[];
  eventTags: string[];
  completeness: number;
  nextQuestion: string | null;
  evidenceEntryIds: string[];
}

export interface AvatarRecallMemory {
  id: string;
  sourceEntryId: string;
  title: string;
  excerpt: string;
  tags: string[];
  score: number;
  createdAt: number;
  reason: string;
}

const compactRecordLine = (line: string, maxLength = 68): string => {
  const trimmed = line.replace(/\s+/g, ' ').trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
};

const stripNowTagPrefix = (tag: string): string => tag.replace(/^(心情|事件):/, '').trim();

const normalizeEntryText = (entry: Pick<DiaryEntry, 'content'>): string =>
  entry.content
    .split('\n')
    .filter((line) => !/^\s*(-\s*)?(image|video|audio|link|素材)[:：]/i.test(line.trim()))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeRecallText = (text: string): string[] => {
  const chineseTerms = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const latinTerms = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return [...chineseTerms, ...latinTerms].filter((term) => term.length >= 2);
};

export const selectAvatarRecallMemories = (
  entries: Array<Pick<DiaryEntry, 'id' | 'title' | 'content' | 'tags' | 'createdAt'>>,
  query: string,
  limit = 3,
): AvatarRecallMemory[] => {
  const queryText = query.trim();
  if (!queryText) return [];
  const queryMoodTags = inferAvatarMoodTags(queryText);
  const queryEventTags = inferAvatarEventTags(queryText);
  const queryTerms = tokenizeRecallText(queryText);
  const queryTermSet = new Set(queryTerms);

  return entries
    .filter((entry) => normalizeEntryText(entry).length > 0)
    .map((entry) => {
      const body = normalizeEntryText(entry);
      const tags = entry.tags.map(stripNowTagPrefix).filter(Boolean);
      const bodyTerms = new Set(tokenizeRecallText(`${entry.title} ${body} ${tags.join(' ')}`));
      const keywordScore = [...queryTermSet].filter((term) => bodyTerms.has(term)).length;
      const matchedMoodTags = queryMoodTags.filter((tag) => tags.includes(tag));
      const matchedEventTags = queryEventTags.filter((tag) => tags.includes(tag));
      const moodScore = matchedMoodTags.length * 3;
      const eventScore = matchedEventTags.length * 2;
      const score = keywordScore + moodScore + eventScore;
      const matchedTags = [...matchedMoodTags, ...matchedEventTags];
      const reason = matchedTags.length > 0
        ? `与你当前表达的「${matchedTags.join('、')}」信号一致`
        : keywordScore > 0
          ? `标题或正文包含 ${keywordScore} 个共同关键信号`
          : '与当前问题有可验证的关联';
      return {
        id: entry.id,
        sourceEntryId: entry.id,
        title: entry.title,
        excerpt: compactRecordLine(body, 42),
        tags: tags.slice(0, 3),
        score,
        createdAt: entry.createdAt,
        reason,
      };
    })
    .filter((memory) => memory.score > 0)
    .sort((first, second) => second.score - first.score || second.createdAt - first.createdAt)
    .slice(0, limit);
};

export const buildAvatarRecallHint = (memories: AvatarRecallMemory[]): string | null => {
  const top = memories[0];
  if (!top) return null;
  const tagText = top.tags.length ? `，标签「${top.tags.join('、')}」` : '';
  return `我联想到一条过去记录：${top.excerpt}${tagText}。这次我会把它当作背景，不会替你下结论。`;
};

export const wantsDirectRecord = (content: string): boolean =>
  /直接记|直接记录|记录吧|就这样|不想说|不说了|别问|不要问|不用问|可以了|够了/.test(content);

const isCorrection = (content: string): boolean =>
  /我都说了|刚才说了|不是|不对|应该是|我说的是|已经说了/.test(content);

export const analyzeAvatarInformation = (
  messages: Array<{ content: string }>,
): AvatarInformationSlots => {
  const text = messages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n');
  return {
    hasFact:
      /今天|昨天|刚刚|上午|下午|晚上|发生|看到|听到|遇到|收到|去了|来了|工作|项目|会议|家人|朋友|同事|身体/.test(
        text,
      ),
    hasAction: /我做|我说|我没|我去了|我完成|我决定|我选择|回复|拒绝|接受|处理|推进|整理|复盘/.test(
      text,
    ),
    hasFeeling:
      /开心|高兴|兴奋|焦虑|担心|不开心|难过|愤怒|生气|委屈|疲惫|累了|迷茫|感动|平静|害怕|失落|压力/.test(
        text,
      ),
    hasThought: /我想|觉得|感觉|认为|意识到|明白|理解|判断|希望|担心|在意|因为|所以/.test(text),
    hasResult: /结果|最后|后来|现在|已经|完成|结束|变成|导致|影响|收获|没成功|成功/.test(text),
  };
};

const latestMatchingLine = (lines: string[], pattern: RegExp): string | null =>
  [...lines].reverse().find((line) => pattern.test(line)) ?? null;

export const inferAvatarMoodTags = (text: string): string[] => {
  const matches: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(text) && !matches.includes(tag)) matches.push(tag);
  };
  const hasNegatedHappy = /不开心|并不开心|没开心|沒有开心|不是开心|并非开心/.test(text);
  if (hasNegatedHappy) matches.push('难过');
  if (!hasNegatedHappy) push('开心', /开心|高兴|愉快|快乐/);
  push('兴奋', /兴奋|激动|期待|热血/);
  push('焦虑', /焦虑|担心|紧张|压力|害怕|慌/);
  push('疲惫', /疲惫|累|困|耗尽|疲劳/);
  push('迷茫', /迷茫|不知道|困惑|混乱|没方向/);
  push('难过', /不开心|难过|失落|沮丧|伤心|委屈/);
  push('愤怒', /愤怒|生气|火大|不爽/);
  push('感动', /感动|触动|暖|被打动/);
  push('平静', /平静|稳定|淡定|释然|安心/);
  return matches.slice(0, CONFIG.MAX_MOOD_TAGS);
};

export const inferAvatarEventTags = (text: string): string[] => {
  const matches: string[] = [];
  const push = (tag: string, pattern: RegExp) => {
    if (pattern.test(text) && !matches.includes(tag)) matches.push(tag);
  };
  push('职业发展', /工作|项目|会议|客户|同事|老板|面试|职业|汇报|推进/);
  push('财务状况', /钱|收入|工资|花费|预算|投资|亏|赚|财务/);
  push('身体健康', /身体|睡眠|运动|病|疼|健康|医院|疲惫/);
  push('人际关系', /朋友|同事|关系|沟通|冲突|聊天|误会|社交/);
  push('家庭情感', /家人|父母|妈妈|爸爸|孩子|伴侣|家庭/);
  push('个人成长', /成长|复盘|学习|意识到|明白|突破|改变|原则|经验/);
  push('娱乐休闲', /电影|游戏|旅行|休息|散步|音乐|娱乐/);
  push('自我实现', /目标|理想|梦想|价值|使命|创造|作品|实现/);
  return matches.slice(0, CONFIG.MAX_EVENT_TAGS);
};

export const buildAvatarStructuredInsight = (
  messages: Array<{ content: string }>,
  recallMemories: AvatarRecallMemory[] = [],
): AvatarStructuredInsight => {
  const lines = messages.map((message) => message.content.trim()).filter(Boolean);
  const text = lines.join('\n');
  const slots = analyzeAvatarInformation(messages);
  const moodTags = inferAvatarMoodTags(text);
  const eventTags = inferAvatarEventTags(text);
  const completeness = Math.round(
    ([slots.hasFact, slots.hasAction, slots.hasFeeling, slots.hasThought, slots.hasResult].filter(
      Boolean,
    ).length /
      5) *
      100,
  );

  const insight: AvatarStructuredInsight = {
    fact: latestMatchingLine(
      lines,
      /今天|昨天|刚刚|上午|下午|晚上|发生|看到|听到|遇到|收到|去了|来了|工作|项目|会议|家人|朋友|同事|身体/,
    ),
    action: latestMatchingLine(
      lines,
      /我做|我说|我没|我去了|我完成|我决定|我选择|回复|拒绝|接受|处理|推进|整理|复盘/,
    ),
    feeling: latestMatchingLine(
      lines,
      /开心|高兴|兴奋|焦虑|担心|不开心|难过|愤怒|生气|委屈|疲惫|累了|迷茫|感动|平静|害怕|失落|压力/,
    ),
    thought: latestMatchingLine(
      lines,
      /我想|觉得|感觉|认为|意识到|明白|理解|判断|希望|担心|在意|因为|所以/,
    ),
    result: latestMatchingLine(
      lines,
      /结果|最后|后来|现在|已经|完成|结束|变成|导致|影响|收获|没成功|成功/,
    ),
    moodTags,
    eventTags,
    completeness,
    nextQuestion: buildAdaptiveFollowup(messages, 0),
    evidenceEntryIds: [...new Set(recallMemories.map((memory) => memory.sourceEntryId).filter(Boolean))],
  };

  return insight;
};

export const buildCompanionAcknowledgement = (
  messages: Array<{ content: string }>,
  assistantTurns: number,
  recallMemories: AvatarRecallMemory[] = [],
): string | null => {
  const insight = buildAvatarStructuredInsight(messages);
  const latest = messages[messages.length - 1]?.content.trim() ?? '';
  const recallHint = assistantTurns === 0 ? buildAvatarRecallHint(recallMemories) : null;
  if (wantsDirectRecord(latest)) {
    return '好，我不追问了。就按你已经说的内容整理成一条记录，你可以直接点「记录完毕」确认。';
  }
  const extracted: string[] = [];
  if (insight.fact) extracted.push(`事情是「${compactRecordLine(insight.fact)}」`);
  if (insight.feeling)
    extracted.push(
      `你的感受偏向「${insight.moodTags.join('、') || compactRecordLine(insight.feeling, 24)}」`,
    );
  if (insight.thought && insight.thought !== insight.fact) {
    extracted.push(`里面有一个判断/想法：「${compactRecordLine(insight.thought, 42)}」`);
  }
  if (insight.result && insight.result !== insight.fact) {
    extracted.push(`结果线索是「${compactRecordLine(insight.result, 42)}」`);
  }
  const prefix =
    extracted.length > 0
      ? `我先提炼到：${extracted.join('；')}。`
      : '我先接住这段记录了，但还需要一个具体事件来落点。';
  const memoryPrefix = recallHint ? `${recallHint}\n` : '';

  if (isCorrection(latest)) {
    return `${memoryPrefix}${prefix}收到，我会按你刚纠正的版本来，不再重复追这个点。`;
  }

  if (insight.completeness >= 80) {
    return `${memoryPrefix}${prefix}这已经可以整理成一条过去记录了；如果你愿意，再补一句“这件事给你的经验/原则是什么”，会更有价值。`;
  }
  if (!insight.fact)
    return `${memoryPrefix}${prefix}刚才具体发生了什么？可以只说时间、人物、事件。`;
  if (!insight.feeling) return `${memoryPrefix}${prefix}这件事里，你当时最明显的情绪是什么？`;
  if (!insight.thought && assistantTurns < CONFIG.MAX_FOLLOWUP_ROUNDS) {
    return `${memoryPrefix}${prefix}你现在怎么理解这件事？有没有一个判断或意识到的点？`;
  }
  if (!insight.result && assistantTurns < CONFIG.MAX_FOLLOWUP_ROUNDS) {
    return `${memoryPrefix}${prefix}后来结果怎样？它带来了什么影响？`;
  }
  if (insight.eventTags.length === 0)
    return `${memoryPrefix}${prefix}它更像工作、关系、健康、家庭，还是个人成长？`;
  return `${memoryPrefix}${prefix}你可以继续补一点背景，或直接点「记录完毕」让我整理。`;
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
  if (!slots.hasThought && followupCount < 2)
    return '你当时心里怎么理解这件事？有没有一个比较明确的判断？';
  if (!slots.hasResult && followupCount < 2)
    return '这件事最后变成了什么结果？和你原本期待的一样吗？';
  return null;
};
