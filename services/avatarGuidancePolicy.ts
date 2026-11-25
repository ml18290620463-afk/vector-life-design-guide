import type {
  AvatarTaskMode,
  GuidanceQuotaPolicy,
  GuidanceRetrievalManifest,
} from '../features/avatar/types';
import type { GuidanceSource } from './avatarGuidance';

const policy = (
  mode: AvatarTaskMode,
  defaultLimit: number,
  expandedLimit: number,
  aboutMe: number,
  myUnderstandingAndChanges: number,
  rawRecordsAndFuture: number,
  minRelevanceScore: number,
): GuidanceQuotaPolicy => ({
  mode,
  defaultLimit,
  expandedLimit,
  maxExcerptChars: 700,
  maxConversationMessages: 120,
  slotQuotas: { aboutMe, myUnderstandingAndChanges, rawRecordsAndFuture },
  allowEmptySlotOverflow: true,
  minRelevanceScore,
});
export const AVATAR_GUIDANCE_POLICIES: Record<AvatarTaskMode, GuidanceQuotaPolicy> = {
  capture: policy('capture', 3, 3, 1, 0, 2, 0.45),
  general: policy('general', 6, 12, 2, 2, 2, 0.35),
  distill: policy('distill', 8, 12, 2, 2, 4, 0.35),
  recall: policy('recall', 10, 16, 1, 2, 7, 0.3),
  decide: policy('decide', 12, 16, 4, 4, 4, 0.3),
  review: policy('review', 12, 20, 2, 4, 6, 0.28),
};
export interface GuidanceSelectionOptions {
  mode?: AvatarTaskMode;
  expanded?: boolean;
  smallWindow?: boolean;
  messageCount?: number;
  lightweightFollowup?: boolean;
  longGoal?: boolean;
  excludedIds?: string[];
  tags?: string[];
  privacyCount?: number;
  expiryCount?: number;
  range?: { start: number; end: number };
}
export function resolveGuidanceBudget(question: string, options: GuidanceSelectionOptions = {}) {
  const mode = options.mode ?? 'general';
  const policy = AVATAR_GUIDANCE_POLICIES[mode];
  const expanded = Boolean(
    options.expanded ||
    options.longGoal ||
    /跨(?:月|年|周期)|这些年|长期|从.*到|前后变化|over the years|across/i.test(question),
  );
  const contracted =
    options.smallWindow || ((options.messageCount ?? 0) >= 20 && options.lightweightFollowup);
  return {
    policy,
    scopeTier: expanded ? ('expanded' as const) : ('default' as const),
    limit: contracted
      ? Math.min(2, policy.defaultLimit)
      : expanded
        ? policy.expandedLimit
        : policy.defaultLimit,
  };
}
export const guidanceSourceSlot = (source: GuidanceSource) =>
  source.domain === 'about_me'
    ? 'aboutMe'
    : source.domain === 'my_understanding' || source.kind === '模式' || source.kind === '原则'
      ? 'myUnderstandingAndChanges'
      : 'rawRecordsAndFuture';

/** Ranked inputs have already passed the repository's live permission boundary. */
export function fillGuidanceSlots(
  ranked: Array<{ source: GuidanceSource; score: number }>,
  question: string,
  options: GuidanceSelectionOptions = {},
) {
  const { policy, scopeTier, limit } = resolveGuidanceBudget(question, options);
  const seen = new Set<string>();
  const eligible = ranked.filter(({ source, score }) => {
    if (score < policy.minRelevanceScore || seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
  const excluded = new Set(options.excludedIds ?? []);
  const pool = eligible.filter(({ source }) => !excluded.has(source.id));
  const selected: GuidanceSource[] = [];
  let overflow = 0;
  for (const slot of ['aboutMe', 'myUnderstandingAndChanges', 'rawRecordsAndFuture'] as const) {
    const quota =
      policy.slotQuotas[slot] +
      (slot === 'rawRecordsAndFuture' ? overflow + Math.max(0, limit - policy.defaultLimit) : 0);
    const picks = pool
      .filter(({ source }) => guidanceSourceSlot(source) === slot)
      .slice(0, Math.min(quota, limit - selected.length));
    selected.push(...picks.map(({ source }) => source));
    if (slot !== 'rawRecordsAndFuture' && policy.allowEmptySlotOverflow)
      overflow += Math.max(0, quota - picks.length);
  }
  const manifest: GuidanceRetrievalManifest = {
    mode: policy.mode,
    scopeTier,
    appliedLimit: limit,
    matchedCount: selected.length,
    filteredOutByPrivacyCount: options.privacyCount ?? 0,
    filteredOutByExpiryCount: options.expiryCount ?? 0,
    excludedByUserCount: eligible.filter(({ source }) => excluded.has(source.id)).length,
    searchedTags: options.tags ?? [],
    ...(options.range
      ? {
          searchedTimeRange: {
            from: new Date(options.range.start).toISOString(),
            to: new Date(options.range.end).toISOString(),
          },
        }
      : {}),
    breakdown: {
      aboutMeCount: selected.filter((s) => guidanceSourceSlot(s) === 'aboutMe').length,
      understandingCount: selected.filter(
        (s) => guidanceSourceSlot(s) === 'myUnderstandingAndChanges',
      ).length,
      rawRecordCount: selected.filter((s) => guidanceSourceSlot(s) === 'rawRecordsAndFuture')
        .length,
    },
    triggeredGuardrailIds: selected
      .filter(
        (source) =>
          ['decide', 'review'].includes(policy.mode) &&
          source.guardrail?.enabled &&
          source.guardrail.triggerTags.some((tag) => options.tags?.includes(tag)),
      )
      .map((source) => source.id),
    canExpandScope: scopeTier === 'default' && policy.expandedLimit > limit,
  };
  return { sources: selected, manifest };
}
