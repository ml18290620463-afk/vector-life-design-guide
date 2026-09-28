import type { AvatarUnderstandingVersion, PastPatternDomain } from '../features/avatar/types';
import type { DiaryEntry, PatternPrincipleLink, Principle } from '../types';

interface PatternRule {
  id: string;
  domain: PastPatternDomain;
  label: string;
  signal: RegExp;
  /** A change rule describes a before → now trajectory, rather than a repeated static response. */
  trajectory?: boolean;
  trigger: string;
  response: string;
  outcome: string;
}

/**
 * The taxonomy combines cognitive appraisal, observable behaviour, emotion regulation,
 * interpersonal behaviour, coping and motivation. Each rule follows a functional
 * situation → response → possible-outcome structure. These are observation lenses,
 * never clinical diagnoses, personality types, or value judgements.
 */
const PATTERN_RULES: PatternRule[] = [
  {
    id: 'risk-rehearsal',
    domain: 'cognitive',
    label: '风险预演',
    signal:
      /反复.{0,8}(?:想|考虑|预想)|最坏|万一|担心.{0,10}(?:失败|出错|不好)|害怕.{0,8}(?:失败|出错)/,
    trigger: '面对结果尚不确定的事情时',
    response: '你会先反复预想风险与可能出错的地方',
    outcome: '行动开始前会投入更多时间确认安全感',
  },
  {
    id: 'high-start-threshold',
    domain: 'cognitive',
    label: '高标准启动',
    signal: /(?:完美|万无一失|准备好).{0,10}(?:再|才)(?:开始|行动|发布|提交)|还不够好|不能出错/,
    trigger: '需要交付或公开成果时',
    response: '你倾向于先达到很高的准备标准，再允许自己开始',
    outcome: '质量要求得到保护，但启动时间可能被推后',
  },
  {
    id: 'reflective-calibration',
    domain: 'cognitive',
    label: '反思校准',
    signal: /复盘|反思|回顾|总结|重新看|意识到/,
    trigger: '一件事情结束后',
    response: '你会回看过程并修正自己的理解',
    outcome: '经历会被整理成下一次可使用的认识',
  },
  {
    id: 'cognitive-reappraisal',
    domain: 'cognitive',
    label: '换角度理解',
    signal: /换个角度|另一方面|重新理解|也可以看成|并不等于|这不代表/,
    trigger: '原有理解让你陷入僵局时',
    response: '你会尝试换一个角度解释这件事',
    outcome: '原本单一的解释因此多了新的可能',
  },
  {
    id: 'delay-under-pressure',
    domain: 'behavioral',
    label: '延后行动',
    signal: /拖延|推迟|不想开始|迟迟|一直没|没有行动|先放一放/,
    trigger: '部分任务推进过程中',
    response: '你倾向于延后开始或暂时把行动放下',
    outcome: '记录中出现了延后安排，原因与影响仍需结合具体情境确认',
  },
  {
    id: 'prepare-before-action',
    domain: 'behavioral',
    label: '行动前准备',
    signal: /提前|准备|先.{0,8}(?:确认|整理|计划|列出|想清楚)|预先/,
    trigger: '面对重要任务或沟通时',
    response: '你会先整理、确认或规划，再进入行动',
    outcome: '行动中的不确定性因此降低',
  },
  {
    id: 'task-decomposition',
    domain: 'behavioral',
    label: '拆出下一步',
    signal:
      /拆成.{0,8}(?:小步骤|几步|小任务)|先做.{0,8}(?:一点|最小|第一步)|从.{0,8}开始做|一步一步/,
    trigger: '任务过大或不知从哪里开始时',
    response: '你会把任务拆小，先完成一个明确步骤',
    outcome: '行动入口变得更清楚',
  },
  {
    id: 'starting-transition',
    domain: 'behavioral',
    label: '从延后到启动',
    signal:
      /(?:过去|以前|原来).{0,20}(?:拖延|推迟|迟迟|不想开始|一直没).{0,18}(?:现在|如今|后来).{0,18}(?:开始|动手|先做|拆成)/,
    trajectory: true,
    trigger: '面对原本容易延后的任务时',
    response: '你正在从推迟开始，转向先做出一个可执行步骤',
    outcome: '这显示的是行动方式的变化，而不是旧模式的继续',
  },
  {
    id: 'seek-feedback',
    domain: 'coping',
    label: '反馈校准',
    signal: /询问|请教|征求.{0,6}(?:意见|建议)|听取.{0,6}(?:意见|建议)|沟通确认|寻求反馈/,
    trigger: '独自判断仍不确定时',
    response: '你会通过询问或听取反馈来校准判断',
    outcome: '决定会吸收更多外部视角',
  },
  {
    id: 'anxious-activation',
    domain: 'emotional',
    label: '不确定时紧张',
    signal: /焦虑|紧张|不安|压力很大|很有压力|害怕.{0,8}(?:结果|发生|失去)/,
    trigger: '结果不明或压力升高时',
    response: '你的紧张与不安会明显上升',
    outcome: '注意力会更多转向风险与结果',
  },
  {
    id: 'self-critical-after-setback',
    domain: 'emotional',
    label: '受挫后自我否定',
    signal: /自责|怪自己|觉得自己不行|我不行|很失败|否定自己/,
    trigger: '结果不如预期或出现失误后',
    response: '你容易把对结果的不满转向对自己的否定',
    outcome: '一次事件可能扩展成对整体自我能力的判断',
  },
  {
    id: 'emotion-holding',
    domain: 'emotional',
    label: '情绪先压住',
    signal:
      /压下去|不想让.{0,8}知道|装作没事|假装没事|把情绪.{0,5}藏|忍住.{0,8}(?:情绪|眼泪|难过|生气)/,
    trigger: '情绪强烈但不便直接表达时',
    response: '你会先隐藏或压住自己的感受',
    outcome: '当下互动得以继续，感受则留待之后处理',
  },
  {
    id: 'emotion-recovery',
    domain: 'emotional',
    label: '情绪回稳',
    signal: /平静下来|慢慢缓过来|情绪回稳|冷静之后|平复之后|缓(?:了)?一会儿/,
    trigger: '情绪明显升高之后',
    response: '你会先留出缓冲，等感受回稳再继续处理',
    outcome: '后续反应与当下强烈情绪之间多了缓冲',
  },
  {
    id: 'emotion-expression-transition',
    domain: 'emotional',
    label: '从压住到说出',
    signal:
      /(?:过去|以前|原来).{0,20}(?:压住|忍住|藏起|假装没事).{0,18}(?:现在|如今|后来).{0,18}(?:说出|表达|告诉|说明).{0,8}(?:感受|情绪|难过|生气|需要)?/,
    trajectory: true,
    trigger: '强烈感受出现且需要被看见时',
    response: '你正在从隐藏感受，转向把它说出来',
    outcome: '情绪表达方式正在发生变化',
  },
  {
    id: 'conflict-expression-delay',
    domain: 'relational',
    label: '冲突中延后表达',
    signal:
      /回避.{0,6}(?:冲突|争执|沟通)|躲开.{0,6}(?:冲突|争执|沟通)|不敢说|没有表达|保持沉默|怕冲突|忍住没说/,
    trigger: '关系中出现分歧或冲突时',
    response: '你倾向于先保持沉默或延后表达真实想法',
    outcome: '表面冲突暂时减少，但自己的立场可能没有被看见',
  },
  {
    id: 'approval-prioritizing',
    domain: 'relational',
    label: '关系中优先满足他人',
    signal: /讨好|怕别人失望|不好意思拒绝|立刻答应|马上答应|迎合|先满足别人/,
    trigger: '他人提出期待或请求时',
    response: '你容易先照顾对方的期待，再考虑自己的需要',
    outcome: '关系和谐被优先维护，自己的空间可能被压缩',
  },
  {
    id: 'boundary-maintenance',
    domain: 'relational',
    label: '边界维护',
    signal: /拒绝|边界|保留自己|需要空间|不再承担|说不/,
    trigger: '请求超过自己的能力或意愿时',
    response: '你会通过拒绝或说明边界来保护自己的空间',
    outcome: '自己的精力与责任范围变得更清楚',
  },
  {
    id: 'relationship-repair',
    domain: 'relational',
    label: '主动修复关系',
    signal:
      /主动.{0,8}(?:道歉|解释|和好|联系)|重新.{0,8}(?:沟通|联系|说清楚)|把误会说开|修复.{0,6}关系/,
    trigger: '重要关系出现误会或中断后',
    response: '你会主动重新联系，尝试把问题说开',
    outcome: '关系获得了再次协商的机会',
  },
  {
    id: 'expression-transition',
    domain: 'relational',
    label: '从回避到表达',
    signal:
      /(?:过去|以前|原来).{0,20}(?:回避|不敢说|沉默|忍住|没有表达).{0,18}(?:现在|如今|后来).{0,18}(?:表达|说出|说明|沟通)/,
    trajectory: true,
    trigger: '关系中再次出现分歧时',
    response: '你正在从延后表达，转向主动说明自己的立场',
    outcome: '这显示的是表达方式的转变，而不是回避的继续',
  },
  {
    id: 're-engage-after-setback',
    domain: 'motivational',
    label: '受挫后重新投入',
    signal: /重新开始|再试一次|继续尝试|没有放弃|调整后.{0,6}(?:继续|再来)|从头再来/,
    trigger: '行动受阻或结果不如预期后',
    response: '你会调整方式并再次投入行动',
    outcome: '一次受挫不会直接终止这件事',
  },
];

const stableId = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pattern-${(hash >>> 0).toString(36)}`;
};

const readText = (value: unknown) => (typeof value === 'string' ? value : '');
const readTags = (tags: unknown) =>
  Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
const readEntryId = (entry: DiaryEntry) => readText(entry.id).trim();
const readEntryCorpus = (entry: DiaryEntry) =>
  `${readText(entry.title)}\n${readText(entry.content)}\n${readText(entry.reflection)}`;
const readEventTags = (entry: DiaryEntry) =>
  readTags(entry.tags).flatMap((tag) =>
    tag.startsWith('事件:') && tag.slice(3).trim() ? [tag.slice(3).trim()] : [],
  );

const splitObservationUnits = (text: string) =>
  text
    .split(/[\n。！？!?;；]+/)
    .map((unit) => unit.trim())
    .filter(Boolean);

const NEGATION_BEFORE_SIGNAL = /(?:不再|已经不|并不|并没有|没有|没再|不会|不太|从不|未曾)\s*$/;
const CHANGE_PIVOT = /(?:但是|不过|但)?\s*(?:现在|如今|后来|目前|已经)/;

/**
 * Match an observation in context rather than counting a bare keyword. A negated
 * occurrence ("我已经不焦虑") is ignored. If the sentence explicitly contrasts
 * the past with the present, a static rule only counts when the same response is
 * also present after the change pivot; trajectory rules describe the change itself.
 */
const unitMatchesRule = (unit: string, rule: PatternRule) => {
  // Quoted advice and other people's behaviour are not observations of the user.
  const observation = unit.replace(/[“「『][^”」』]*[”」』]/g, '');
  if (/(?:朋友|同事|别人|对方|他|她)(?:总是|经常|会|说|觉得|又|在)/.test(observation)) return false;
  unit = observation;
  const match = rule.signal.exec(unit);
  if (!match || typeof match.index !== 'number') return false;
  const prefix = unit.slice(0, match.index);
  if (/(?:应该|希望|打算|计划|想要|需要学会|建议).{0,12}$/.test(prefix)) return false;
  if (rule.trajectory) return true;

  const beforeSignal = unit.slice(Math.max(0, match.index - 8), match.index);
  if (NEGATION_BEFORE_SIGNAL.test(beforeSignal)) return false;

  const pivot = CHANGE_PIVOT.exec(unit);
  if (pivot && match.index < pivot.index) {
    const currentClause = unit.slice(pivot.index + pivot[0].length);
    return rule.signal.test(currentClause);
  }
  return true;
};

const entryMatchesRule = (entry: DiaryEntry, rule: PatternRule) =>
  splitObservationUnits(readEntryCorpus(entry)).some((unit) => unitMatchesRule(unit, rule));

const findSharedEvent = (entries: DiaryEntry[]): string | null => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const event of new Set(readEventTags(entry))) {
      counts.set(event, (counts.get(event) ?? 0) + 1);
    }
  }
  return (
    [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))[0]?.[0] ?? null
  );
};

const contextualTrigger = (rule: PatternRule, matchedEntries: DiaryEntry[]) => {
  const sharedEvent = findSharedEvent(matchedEntries);
  return sharedEvent ? `在「${sharedEvent}」相关情境中` : rule.trigger;
};

const mergePattern = (
  candidate: AvatarUnderstandingVersion,
  existingById: Map<string, AvatarUnderstandingVersion>,
): AvatarUnderstandingVersion => {
  const existing = existingById.get(candidate.id);
  if (!existing) return candidate;
  const isConfirmed = existing.status === 'confirmed';
  return {
    ...candidate,
    statement: isConfirmed ? existing.statement : candidate.statement,
    status: existing.status,
    sourceEntryIds: [
      ...new Set([
        ...(Array.isArray(existing.sourceEntryIds) ? existing.sourceEntryIds : []),
        ...candidate.sourceEntryIds,
      ]),
    ],
    createdAt: existing.createdAt,
    updatedAt: candidate.updatedAt,
    patternDomain:
      isConfirmed && existing.patternDomain ? existing.patternDomain : candidate.patternDomain,
    patternLabel:
      isConfirmed && existing.patternLabel ? existing.patternLabel : candidate.patternLabel,
    trigger: isConfirmed && existing.trigger ? existing.trigger : candidate.trigger,
    response: isConfirmed && existing.response ? existing.response : candidate.response,
    outcome: isConfirmed && existing.outcome ? existing.outcome : candidate.outcome,
    ...(typeof existing.confirmedAt === 'number' ? { confirmedAt: existing.confirmedAt } : {}),
    ...(existing.confirmedBy ? { confirmedBy: existing.confirmedBy } : {}),
    ...(existing.summaryKind ? { summaryKind: existing.summaryKind } : {}),
    ...(existing.previousVersionId ? { previousVersionId: existing.previousVersionId } : {}),
  };
};

export const isLegacyEventOnlyPattern = (pattern: AvatarUnderstandingVersion) =>
  /^「.+」相关事件反复出现。?$/.test(pattern.statement.trim());

export const extractPastPatterns = (
  entries: DiaryEntry[],
  existing: AvatarUnderstandingVersion[] = [],
  now = Date.now(),
): AvatarUnderstandingVersion[] => {
  const available = [
    ...new Map(entries.map((entry) => [readEntryId(entry), entry])).values(),
  ].filter(
    (entry) =>
      !entry.isSample &&
      (!entry.unlockAt || entry.unlockAt <= now) &&
      readEntryId(entry).length > 0 &&
      readEntryCorpus(entry).trim().length > 0,
  );
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const candidates: AvatarUnderstandingVersion[] = [];

  for (const rule of PATTERN_RULES) {
    const matchedEntries = available.filter((entry) => entryMatchesRule(entry, rule));
    if (matchedEntries.length < 2) continue;
    const trigger = contextualTrigger(rule, matchedEntries);
    const id = stableId(`rule:${rule.id}`);
    candidates.push(
      mergePattern(
        {
          id,
          statement: `${trigger}，${rule.response}。`,
          status: 'pending',
          sourceEntryIds: matchedEntries.map(readEntryId),
          createdAt: now,
          updatedAt: now,
          patternDomain: rule.domain,
          patternLabel: rule.label,
          trigger,
          response: rule.response,
          outcome: rule.outcome,
        },
        existingById,
      ),
    );
  }

  return candidates.sort(
    (a, b) => b.sourceEntryIds.length - a.sourceEntryIds.length || a.id.localeCompare(b.id),
  );
};

export type PastPatternEvolutionStage =
  | 'emerging'
  | 'strengthening'
  | 'established'
  | 'shifting'
  | 'fading';

export interface PastPatternEvolution {
  stage: PastPatternEvolutionStage;
  sourceCount: number;
  linkedPrincipleCount: number;
  validationCount: number;
  challengeCount: number;
  latestSourceAt: number;
}

const ACTIVE_LINK_STATUSES = new Set(['suggested', 'confirmed', 'validated']);
const PATTERN_STALE_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;

const readCreatedAt = (entry: DiaryEntry) =>
  typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : 0;

const getLinkedPrincipleIds = (
  patternId: string,
  principles: Principle[] = [],
  links: PatternPrincipleLink[] = [],
) => {
  const linkedIds = new Set<string>();

  for (const principle of principles) {
    if (
      Array.isArray(principle.sourcePatternIds) &&
      principle.sourcePatternIds.includes(patternId)
    ) {
      linkedIds.add(principle.id);
    }
  }

  for (const link of links) {
    if (link.patternId !== patternId || !ACTIVE_LINK_STATUSES.has(link.status)) continue;
    linkedIds.add(link.principleId);
  }

  return linkedIds;
};

const readFeedbackFromEntries = (entries: DiaryEntry[], linkedPrincipleIds: Set<string>) => {
  let helpful = 0;
  let partial = 0;
  let unhelpful = 0;

  for (const entry of entries) {
    if (!Array.isArray(entry.principleFeedback)) continue;
    for (const feedback of entry.principleFeedback) {
      if (!linkedPrincipleIds.has(feedback.principleId)) continue;
      if (feedback.outcome === 'helpful') helpful += 1;
      if (feedback.outcome === 'partial') partial += 1;
      if (feedback.outcome === 'unhelpful') unhelpful += 1;
    }
  }

  return { helpful, partial, unhelpful };
};

const readFeedbackFromPrinciples = (principles: Principle[], linkedPrincipleIds: Set<string>) => {
  let helpful = 0;
  let partial = 0;
  let unhelpful = 0;

  for (const principle of principles) {
    if (!linkedPrincipleIds.has(principle.id)) continue;
    helpful += principle.helpfulCount ?? 0;
    partial += principle.partialCount ?? 0;
    unhelpful += principle.unhelpfulCount ?? 0;
  }

  return { helpful, partial, unhelpful };
};

export const derivePastPatternEvolution = ({
  pattern,
  entries,
  principles = [],
  links = [],
  now = Date.now(),
}: {
  pattern: AvatarUnderstandingVersion;
  entries: DiaryEntry[];
  principles?: Principle[];
  links?: PatternPrincipleLink[];
  now?: number;
}): PastPatternEvolution => {
  const sourceEntryIds = Array.isArray(pattern.sourceEntryIds) ? pattern.sourceEntryIds : [];
  const sourceEntryIdSet = new Set(sourceEntryIds);
  const sourceEntries = entries.filter((entry) => sourceEntryIdSet.has(readEntryId(entry)));
  const sourceCount = sourceEntryIds.length;
  const latestSourceAt = sourceEntries.reduce(
    (latest, entry) => Math.max(latest, readCreatedAt(entry)),
    0,
  );
  const linkedPrincipleIds = getLinkedPrincipleIds(pattern.id, principles, links);
  const entryFeedback = readFeedbackFromEntries(entries, linkedPrincipleIds);
  const fallbackFeedback = readFeedbackFromPrinciples(principles, linkedPrincipleIds);
  const hasEntryFeedback =
    entryFeedback.helpful + entryFeedback.partial + entryFeedback.unhelpful > 0;
  const feedback = hasEntryFeedback ? entryFeedback : fallbackFeedback;
  const validationCount = feedback.helpful + feedback.partial;
  const challengeCount = feedback.unhelpful;
  const isStale = latestSourceAt > 0 && now - latestSourceAt > PATTERN_STALE_WINDOW_MS;
  let stage: PastPatternEvolutionStage =
    sourceCount >= 4 ? 'established' : sourceCount >= 2 ? 'strengthening' : 'emerging';

  if (linkedPrincipleIds.size > 0 && validationCount + challengeCount > 0) {
    stage = isStale && validationCount > challengeCount ? 'fading' : 'shifting';
  }

  return {
    stage,
    sourceCount,
    linkedPrincipleCount: linkedPrincipleIds.size,
    validationCount,
    challengeCount,
    latestSourceAt,
  };
};
