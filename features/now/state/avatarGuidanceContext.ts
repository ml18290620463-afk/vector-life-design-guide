import {
  buildGroundedGuidance,
  expandGuidanceAssociations,
  isAvatarContextContinuation,
  sourceMatchesTemporalScope,
} from '../../../services/avatarGuidance';
import type { GuidanceSource } from '../../../services/avatarGuidance';
import type { AvatarLaunchContext } from '../../avatar/types';
import type { ChatMessage } from '../types/now';
import { parseAvatarQueryPlan } from '../../../services/avatarQueryPlan';

type AvatarRetrievalIntent =
  | 'metric'
  | 'similar_experiences'
  | 'decision_support'
  | 'self_knowledge'
  | 'future_context'
  | 'general';

export function detectAvatarRetrievalIntent(question: string): AvatarRetrievalIntent {
  if (/(多少次|几次|统计|一共|总共|分别有多少|出现了几次)/.test(question)) return 'metric';
  if (/(类似经历|相似经历|以前.*(?:怎么|如何)|过去.*(?:怎么|如何)|回看.*经历)/.test(question)) return 'similar_experiences';
  if (/(选择|决策|要不要|应不应该|利弊|取舍|怎么办|怎么选|该不该)/.test(question)) return 'decision_support';
  if (/(我.*(?:是怎样|有什么(?:模式|偏好|特点|边界)|了解我|认识我)|我的.*(?:模式|特点|偏好|边界))/.test(question)) return 'self_knowledge';
  if (/(愿景|目标|行动|计划|规划)/.test(question)) return 'future_context';
  return 'general';
}

function allowedSourceForIntent(
  source: GuidanceSource,
  intent: AvatarRetrievalIntent,
  launchContext?: AvatarLaunchContext,
) {
  const isFuture = source.module === 'future' || ['行动', '愿景', '目标'].includes(source.kind);
  const fromAction = Boolean(launchContext?.actionId);
  if (isFuture && intent !== 'future_context' && !fromAction) return false;
  if (intent === 'self_knowledge')
    return source.kind !== '背景' && source.status !== 'candidate' && source.module !== 'now';
  if (intent === 'metric') return source.module === 'past' && source.kind === '背景';
  if (intent === 'similar_experiences') return source.module === 'past' || source.kind === '模式';
  if (intent === 'decision_support')
    return source.module === 'past' || source.kind === '模式' || isFuture;
  return source.module === 'past' || (isFuture && (intent === 'future_context' || fromAction));
}

export function resolveAvatarQueryScope(conversation: ChatMessage[]) {
  const question = conversation.at(-1)?.content ?? '';
  const previousQuestion = conversation
    .slice(0, -1)
    .filter((m) => m.role === 'user' && !isAvatarContextContinuation(m.content))
    .at(-1)?.content;
  // Resolve subject and time scope together. New substantive questions reset
  // the scope, while any number of short continuations keeps it intact.
  const scopedQuestion =
    isAvatarContextContinuation(question) && previousQuestion ? previousQuestion : question;
  return { question, previousQuestion, scopedQuestion };
}

/** Short follow-ups retain the latest substantive subject; identity remains independent. */
export function selectAvatarGuidanceContext(
  conversation: ChatMessage[],
  sources: GuidanceSource[],
  launchContext?: AvatarLaunchContext,
  preferredEntryIds?: string[],
) {
  const now = Date.now();
  const { question, previousQuestion, scopedQuestion } = resolveAvatarQueryScope(conversation);
  const plan = parseAvatarQueryPlan(scopedQuestion, now);
  sources = sources.filter((source) =>
    plan.range
      ? Boolean(
          source.evidence?.some(
            (item) => item.occurredAt >= plan.range!.start && item.occurredAt < plan.range!.end,
          ) ||
          (source.validFrom !== undefined &&
            source.validFrom < plan.range!.end &&
            (source.validTo === undefined || source.validTo > plan.range!.start)),
        )
      : (source.validFrom === undefined || source.validFrom <= now) &&
        (source.validTo === undefined || now < source.validTo),
  );
  const retrievalIntent = detectAvatarRetrievalIntent(scopedQuestion);
  const retrievalSources = sources.filter(
    (source) =>
      (plan.range || sourceMatchesTemporalScope(source, scopedQuestion)) &&
      allowedSourceForIntent(source, retrievalIntent, launchContext),
  );
  let selected = buildGroundedGuidance(question, retrievalSources, previousQuestion, {
    range: plan.range,
    preferredSourceIds: preferredEntryIds?.map((id) => `entry:${id}`),
  }).sources;
  // A question can describe a category ("我的偏好") or a planning need
  // ("怎么规划") without sharing the exact words stored in a record.  In
  // those two narrow cases, keep a small, already-authorized fallback set.
  // This never widens the data boundary: candidates and future items have
  // already been excluded by `retrievalSources` above.
  if (!selected.length && retrievalIntent === 'future_context') {
    const order = ['愿景', '目标', '行动'];
    selected = retrievalSources
      .filter((source) => order.includes(source.kind))
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
      .slice(0, 2);
  }
  if (!selected.length && retrievalIntent === 'self_knowledge') {
    selected = retrievalSources
      .filter((source) => source.status === 'confirmed' && source.kind !== '背景')
      .slice(0, 2);
  }
  const focus = sources.find((source) =>
    launchContext?.actionId
      ? source.sourceKey === `行动:${launchContext.actionId}`
      : launchContext?.entryId
        ? source.id === `entry:${launchContext.entryId}`
        : false,
  );
  const userQuestions = conversation.filter(
    (message) => message.role === 'user' && !isAvatarContextContinuation(message.content),
  );
  // The launch object supplies initial context and its short follow-ups. A new
  // substantive subject takes over normally instead of remaining pinned forever.
  if (
    focus &&
    userQuestions.length <= 1 &&
    (selected.length === 0 || isAvatarContextContinuation(question) || selected.includes(focus))
  )
    selected = expandGuidanceAssociations([focus], retrievalSources);

  const identity = sources
    .filter((source) => source.avatarName && source.status !== 'candidate')
    .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0))
    .slice(0, 2);
  return [
    ...identity,
    ...selected.filter(
      (source) => !identity.some((item) => item.id === source.id && item.kind === source.kind),
    ),
  ];
}

export function getFocusText(sources: GuidanceSource[], context: AvatarLaunchContext) {
  return sources.find(
    (source) =>
      (context.actionId && source.sourceKey === `行动:${context.actionId}`) ||
      (context.entryId && source.id === `entry:${context.entryId}`),
  )?.text;
}
