import {
  fillGuidanceSlots,
  resolveGuidanceBudget,
  type GuidanceSelectionOptions,
} from '../../../services/avatarGuidancePolicy';
import {
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
  if (/(类似经历|相似经历|以前.*(?:怎么|如何)|过去.*(?:怎么|如何)|回看.*经历)/.test(question))
    return 'similar_experiences';
  if (/(选择|决策|要不要|应不应该|利弊|取舍|怎么办|怎么选|该不该)/.test(question))
    return 'decision_support';
  if (
    /(我.*(?:是怎样|有什么(?:模式|偏好|特点|边界)|了解我|认识我)|我的.*(?:模式|特点|偏好|边界))/.test(
      question,
    )
  )
    return 'self_knowledge';
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
  // Completed practice remains evidence for choices, never a current obligation.
  if (
    source.temporalStatus === 'historical_fact' &&
    source.results?.length &&
    ['decision_support', 'similar_experiences', 'general'].includes(intent)
  )
    return true;
  if (isFuture && intent !== 'future_context' && !fromAction) return false;
  if (source.status === 'candidate') return false;
  if (source.domain === 'about_me' || source.domain === 'my_understanding') return true;
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
  return { question, scopedQuestion };
}

/** Short follow-ups retain the latest substantive subject; identity remains independent. */
export function retrieveAvatarGuidanceContext(
  conversation: ChatMessage[],
  sources: GuidanceSource[],
  launchContext?: AvatarLaunchContext,
  preferredEntryIds?: string[],
  options: GuidanceSelectionOptions = {},
) {
  const now = Date.now();
  const { question, scopedQuestion } = resolveAvatarQueryScope(conversation);
  options = {
    mode: launchContext?.mode ?? 'general',
    messageCount: conversation.length,
    lightweightFollowup: isAvatarContextContinuation(question),
    ...options,
  };
  options.longGoal ??= sources.some(
    (source) =>
      source.id === launchContext?.actionId &&
      source.relatedKeys?.some((key) => key.startsWith('目标:')),
  );
  const budget = resolveGuidanceBudget(scopedQuestion, options);
  const allowHistory =
    budget.scopeTier === 'expanded' && ['recall', 'review'].includes(budget.policy.mode);
  const plan = parseAvatarQueryPlan(scopedQuestion, now);
  sources = sources.filter((source) =>
    plan.range
      ? Boolean(
          source.evidence?.some(
            (item) => item.occurredAt >= plan.range!.start && item.occurredAt < plan.range!.end,
          ) ||
          source.results?.some((result) => {
            const time = Date.parse(result.occurredOn);
            return time >= plan.range!.start && time < plan.range!.end;
          }) ||
          (source.validFrom !== undefined &&
            source.validFrom < plan.range!.end &&
            (source.validTo === undefined || source.validTo > plan.range!.start)),
        )
      : (source.validFrom === undefined || source.validFrom <= now) &&
        (source.validTo === undefined ||
          now < source.validTo ||
          (allowHistory && source.status === 'archived_expired')),
  );
  const retrievalIntent = detectAvatarRetrievalIntent(scopedQuestion);
  const retrievalSources = sources.filter(
    (source) =>
      (plan.range ||
        sourceMatchesTemporalScope(source, scopedQuestion) ||
        (allowHistory && source.status === 'archived_expired')) &&
      allowedSourceForIntent(source, retrievalIntent, launchContext),
  );
  const focus = sources.find((source) =>
    launchContext?.actionId
      ? source.sourceKey === `行动:${launchContext.actionId}`
      : launchContext?.entryId
        ? source.id === `entry:${launchContext.entryId}`
        : false,
  );
  const initialSubject =
    conversation.filter((m) => m.role === 'user' && !isAvatarContextContinuation(m.content))
      .length <= 1;
  const compact = scopedQuestion.replace(/\s+/g, '').toLowerCase();
  const terms = [
    ...new Set(
      Array.from({ length: Math.max(0, compact.length - 1) }, (_, i) => compact.slice(i, i + 2)),
    ),
  ];
  const tags = [
    ...new Set([
      ...(options.tags ?? []),
      ...sources.flatMap((s) => s.tags ?? []).filter((tag) => scopedQuestion.includes(tag)),
    ]),
  ];
  const ranked = retrievalSources
    .map((source) => {
      const text = [
        source.text,
        source.searchText,
        source.detail,
        ...(source.evidence ?? []).flatMap((e) => [e.text, e.searchText]),
        ...(source.results ?? []).map((r) => r.text),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matches = terms.filter((term) => text.includes(term)).length;
      const linked =
        initialSubject &&
        focus &&
        (source === focus ||
          focus.relatedKeys?.includes(source.sourceKey ?? `${source.kind}:${source.id}`));
      const categorical =
        (retrievalIntent === 'future_context' && ['愿景', '目标', '行动'].includes(source.kind)) ||
        (retrievalIntent === 'self_knowledge' &&
          source.status === 'confirmed' &&
          source.kind !== '背景');
      const score = Math.min(
        1,
        1 -
          Math.exp(-matches * 0.7) +
          (source.tags?.some((tag) => tags.includes(tag)) ? 0.2 : 0) +
          (['decide', 'review'].includes(budget.policy.mode) &&
          source.guardrail?.enabled &&
          source.guardrail.triggerTags.some((tag) => tags.includes(tag))
            ? 0.5
            : 0),
      );
      return {
        source,
        score:
          preferredEntryIds?.some((id) => source.id === `entry:${id}`) || linked
            ? 1
            : categorical
              ? Math.max(0.5, score)
              : score,
      };
    })
    .sort((a, b) => b.score - a.score);
  return fillGuidanceSlots(ranked, scopedQuestion, { ...options, tags, range: plan.range });
}

export function selectAvatarGuidanceContext(
  conversation: ChatMessage[],
  sources: GuidanceSource[],
  launchContext?: AvatarLaunchContext,
  preferredEntryIds?: string[],
  options: GuidanceSelectionOptions = {},
) {
  return retrieveAvatarGuidanceContext(
    conversation,
    sources,
    launchContext,
    preferredEntryIds,
    options,
  ).sources;
}

export function getFocusText(sources: GuidanceSource[], context: AvatarLaunchContext) {
  return sources.find(
    (source) =>
      (context.actionId && source.sourceKey === `行动:${context.actionId}`) ||
      (context.entryId && source.id === `entry:${context.entryId}`),
  )?.text;
}
