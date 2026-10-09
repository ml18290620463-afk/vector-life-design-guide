import {
  buildGroundedGuidance,
  expandGuidanceAssociations,
  isAvatarContextContinuation,
} from '../../../services/avatarGuidance';
import type { GuidanceSource } from '../../../services/avatarGuidance';
import type { AvatarLaunchContext } from '../../avatar/types';
import type { ChatMessage } from '../types/now';
import { parseAvatarQueryPlan } from '../../../services/avatarQueryPlan';

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
  let selected = buildGroundedGuidance(question, sources, previousQuestion, {
    range: plan.range,
    preferredSourceIds: preferredEntryIds?.map((id) => `entry:${id}`),
  }).sources;
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
    selected = expandGuidanceAssociations([focus], sources);

  const identity = sources
    .filter((source) => source.avatarName)
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
