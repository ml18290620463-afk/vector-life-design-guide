import type { CustomPersona } from '../types';

/**
 * Phase 4 Week 2 (§6.2 of [`docs/product-vision-2026Q2.md`](../docs/product-vision-2026Q2.md))
 * — the **single source of truth** for tier-based quota gates.
 *
 * Why a dedicated service? Because Stripe / WeChat-pay integration is
 * a separate Phase 4 task (not Week 2). For now we have no live
 * payment pipeline, so every user is implicitly `'free'`. Once the
 * payment surface lands, only the `getCurrentTier()` resolver here
 * needs to change — every paywall trigger across the codebase
 * (Persona Builder, Memoir Builder, Morning Star quota, etc.) reads
 * from this single helper.
 *
 * Decision matrix (from product-vision §6.1, locked by the user on
 * 2026-05-03):
 *
 *   Tier      | 内置启明星/月 | 自定义启明星 | 心象  | 心象对话/年
 *   --------- | ------------- | ----------- | ----- | -----------
 *   free      |       5       |       0     |   0   |     —
 *   stardust  |      80       |       5     |   1   |     500
 *   polaris   |     300       |      30     |   5   |    1000
 *   owner     |     300 终身  |      50     |  10   |    1000 终身
 *
 * Free-tier hard cap on `customPersonas = 0` is the **paywall trigger
 * for Persona Builder Week 2**. The wizard's "create" CTA is
 * intercepted by `canCreateCustomPersona()` — when it returns a
 * `paywall` reason, the UI surfaces the upgrade modal instead of
 * actually generating the persona.
 */

export type UserTier = 'free' | 'stardust' | 'polaris' | 'owner';

/** Hard-coded ceilings per tier. Reflects §6.1 of the product
 *  vision document; numbers may move during alpha based on user
 *  feedback (see Phase 4.5 review window).
 *
 *  Phase 4 W4 (§2.3 of `docs/memoir-memory-system.md`) adds the
 *  per-Memoir long-term-memory capacity. This is the upper bound
 *  the harvester uses to decide when to evict the lowest-salience
 *  memory; see `services/memoryService.evictLowestSalience`.
 *  Free tier is `0` because Memoirs themselves are paid-only —
 *  no Memoir = no memories to bound. */
export const TIER_LIMITS = {
  free: {
    morningStarPerMonth: 5,
    customPersonaCount: 0,
    memoirSlotsOwned: 0,
    memoirChatsPerYear: 0,
    memoriesPerMemoir: 0,
  },
  stardust: {
    morningStarPerMonth: 80,
    customPersonaCount: 5,
    memoirSlotsOwned: 1,
    memoirChatsPerYear: 500,
    memoriesPerMemoir: 200,
  },
  polaris: {
    morningStarPerMonth: 300,
    customPersonaCount: 30,
    memoirSlotsOwned: 5,
    memoirChatsPerYear: 1000,
    memoriesPerMemoir: 500,
  },
  owner: {
    morningStarPerMonth: 300,
    customPersonaCount: 50,
    memoirSlotsOwned: 10,
    memoirChatsPerYear: 1000,
    memoriesPerMemoir: 1000,
  },
} as const satisfies Record<
  UserTier,
  {
    morningStarPerMonth: number;
    customPersonaCount: number;
    memoirSlotsOwned: number;
    memoirChatsPerYear: number;
    memoriesPerMemoir: number;
  }
>;

export type TierLimits = (typeof TIER_LIMITS)[UserTier];

/* -------------------------------------------------------------------- */
/*  Tier resolver                                                       */
/* -------------------------------------------------------------------- */

/**
 * Phase 4 Week 2 — without a live payment pipeline, every user is
 * `'free'` by default. **However**, a localStorage feature-flag
 * `vector_dev_tier` is read (only in non-production builds) so
 * developers / QA can flip into a higher tier locally to exercise
 * the paywall flows. This is intentionally **not** an env var so
 * that production bundles never compile in a "go premium" backdoor.
 */
export const getCurrentTier = (): UserTier => {
  if (typeof window === 'undefined') return 'free';
  // Production guard: this dev override never resolves outside
  // localhost / dev-mode. The check uses the runtime hostname
  // because `process.env.NODE_ENV` is rewritten at build time and
  // we want a single bundle to behave the same across environments.
  const isDevHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');
  if (!isDevHost) return 'free';
  try {
    const raw = window.localStorage.getItem('vector_dev_tier');
    if (raw === 'stardust' || raw === 'polaris' || raw === 'owner') return raw;
  } catch {
    // localStorage may be unavailable (e.g. private mode) — fall through
  }
  return 'free';
};

export const getTierLimits = (tier: UserTier = getCurrentTier()): TierLimits => TIER_LIMITS[tier];

/* -------------------------------------------------------------------- */
/*  Phase 5 §5.1 — license → tier bridge                                */
/* -------------------------------------------------------------------- */

/**
 * Phase 5 §5.1 — bridge between `services/licenseToken` (where
 * `LicenseTier = 'stardust' | 'polaris' | 'owner'`) and the
 * paywall predicates above (where `UserTier` adds `'free'`).
 *
 * The bridge intentionally lives in `quotaService` (not in
 * `licenseStore` / `useLicense`) so the predicates remain the
 * single source of truth and the rest of the codebase can stay
 * `getCurrentTier()`-shaped:
 *
 *   ```ts
 *   const { currentTier } = useLicense();
 *   const verdict = canStartEchoChamber(currentTier);
 *   ```
 *
 * Why a separate type union for license tokens vs paywall
 * checks: tokens are NEVER signed for `'free'` (free is the
 * no-token default); keeping them as separate types makes that
 * invariant compile-checkable.
 */
import type { LicensePayload } from './licenseToken';

/**
 * Extract a paywall-friendly `UserTier` from a license payload
 * (or `null` for "no active license"). The license layer's
 * `useLicense.currentTier` already does this resolution; this
 * helper is the inverse for callers that have a payload in
 * hand (e.g. tests, server-side handlers in Phase 5.2).
 */
export const tierFromLicense = (payload: LicensePayload | null): UserTier =>
  payload ? payload.tier : 'free';

/* -------------------------------------------------------------------- */
/*  Paywall predicates                                                  */
/* -------------------------------------------------------------------- */

export type PaywallReason =
  | 'free-tier-no-personas'
  | 'free-tier-no-memoirs'
  | 'free-tier-no-memoir-chats'
  | 'free-tier-no-echo-chamber'
  | 'tier-limit-reached'
  | 'memoir-chat-quota-exhausted'
  | 'ok';

export interface PaywallVerdict {
  reason: PaywallReason;
  /** True iff the action MUST be blocked. The UI surfaces the upgrade
   *  modal in this case instead of executing the action. */
  blocked: boolean;
  /** Currently active tier — handy for the upgrade-modal copy. */
  tier: UserTier;
  /** The current quota ceiling for the action under review. */
  limit: number;
  /** How much the user has already consumed. */
  used: number;
  /** Suggested upgrade target ('stardust' for Free hitting the cap,
   *  'polaris' for Stardust hitting their cap, etc.). Null for Owner
   *  which has no upgrade above it. */
  suggestedUpgrade: UserTier | null;
}

const upgradePathFor = (tier: UserTier): UserTier | null => {
  switch (tier) {
    case 'free':
      return 'stardust';
    case 'stardust':
      return 'polaris';
    case 'polaris':
      return 'owner';
    case 'owner':
      return null;
  }
};

/**
 * Top-level gate consumed by the Persona Builder "create" CTA.
 * Reads the live tier + the user's current persona count and returns
 * a `PaywallVerdict` the UI can act on.
 *
 * Free tier returns `'free-tier-no-personas'` immediately (zero is
 * zero — the user is not "near the limit", they are categorically
 * not allowed). Paid tiers return `'tier-limit-reached'` only after
 * they hit their cap; below the cap they return `'ok'`.
 */
export const canCreateCustomPersona = (
  personas: CustomPersona[],
  tier: UserTier = getCurrentTier(),
): PaywallVerdict => {
  const limit = TIER_LIMITS[tier].customPersonaCount;
  const used = personas.filter((p) => p.kind === 'persona').length;
  if (tier === 'free') {
    return {
      reason: 'free-tier-no-personas',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  if (used >= limit) {
    return {
      reason: 'tier-limit-reached',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  return {
    reason: 'ok',
    blocked: false,
    tier,
    limit,
    used,
    suggestedUpgrade: upgradePathFor(tier),
  };
};

/**
 * Pre-emptive predicate the Settings panel uses to grey out the
 * "新增启明星" button (vs. letting the click open the wizard and the
 * wizard then bouncing the user). Same data as `canCreateCustomPersona`
 * but exposed under a more explicit name.
 */
export const isCustomPersonaCreationBlocked = (
  personas: CustomPersona[],
  tier: UserTier = getCurrentTier(),
): boolean => canCreateCustomPersona(personas, tier).blocked;

/* -------------------------------------------------------------------- */
/*  Memoir paywall predicates (Phase 4 Week 3 §5.1.B)                   */
/* -------------------------------------------------------------------- */

/**
 * Gate consumed by the Memoir Builder "create" CTA. Counts existing
 * memoirs (`kind === 'memoir'`) against the active tier's
 * `memoirSlotsOwned` ceiling.
 *
 * Free tier returns `'free-tier-no-memoirs'` immediately — the
 * paywall takeover surface (Day 4) reads this reason and renders a
 * gentler upgrade copy than the Persona Builder paywall, because the
 * emotional stakes for "为心中的某个真实的人立一座心象" are higher
 * than for a generic AI persona. Paid tiers return
 * `'tier-limit-reached'` only after they hit the cap.
 */
export const canCreateMemoir = (
  personas: CustomPersona[],
  tier: UserTier = getCurrentTier(),
): PaywallVerdict => {
  const limit = TIER_LIMITS[tier].memoirSlotsOwned;
  const used = personas.filter((p) => p.kind === 'memoir').length;
  if (tier === 'free') {
    return {
      reason: 'free-tier-no-memoirs',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  if (used >= limit) {
    return {
      reason: 'tier-limit-reached',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  return {
    reason: 'ok',
    blocked: false,
    tier,
    limit,
    used,
    suggestedUpgrade: upgradePathFor(tier),
  };
};

/**
 * Gate consumed at Memoir conversation time. The Memoir chat pipeline
 * (Day 6) checks this before sending a message — when blocked, the
 * UI surfaces the upgrade modal instead of forwarding the message
 * to the AI proxy.
 *
 * `chatsUsedThisYear` is the per-Memoir running counter (configured
 * in §6.1: each Memoir has its OWN annual quota, not a shared pool).
 * Free tier always returns `'free-tier-no-memoir-chats'` because Free
 * users cannot own a Memoir at all — this branch exists purely so a
 * smuggled-in Memoir from a v3 backup at a higher tier downgrade
 * cannot be silently chatted with.
 */
export const canChatMemoir = (
  chatsUsedThisYear: number,
  tier: UserTier = getCurrentTier(),
): PaywallVerdict => {
  const limit = TIER_LIMITS[tier].memoirChatsPerYear;
  const used = Math.max(0, Math.floor(chatsUsedThisYear));
  if (tier === 'free') {
    return {
      reason: 'free-tier-no-memoir-chats',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  if (used >= limit) {
    return {
      reason: 'memoir-chat-quota-exhausted',
      blocked: true,
      tier,
      limit,
      used,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  return {
    reason: 'ok',
    blocked: false,
    tier,
    limit,
    used,
    suggestedUpgrade: upgradePathFor(tier),
  };
};

/** Pre-emptive predicate parallel to `isCustomPersonaCreationBlocked`,
 *  used by the Settings panel to grey out the "新增心象" CTA. */
export const isMemoirCreationBlocked = (
  personas: CustomPersona[],
  tier: UserTier = getCurrentTier(),
): boolean => canCreateMemoir(personas, tier).blocked;

/* -------------------------------------------------------------------- */
/*  Phase 4.5 §B — Echo Chamber paywall                                 */
/* -------------------------------------------------------------------- */

/**
 * Phase 4.5 §B (Echo Chamber) — gate for the multi-persona round
 * table. Free tier is hard-blocked because:
 *   - the round-table burns ~5× the tokens of a single Morning
 *     Star call (one prompt expanded by N persona sections + a
 *     consensus / divergence summary block); Free tier is sized
 *     for casual exploration, not the deepest AI surface.
 *   - it is a value-anchor for the Stardust+ tiers — letting Free
 *     users sample it would erode the upgrade incentive, mirroring
 *     the Persona Builder + Memoir paywalls already in place.
 *
 * Paid tiers are uniformly allowed (no per-tier session count yet —
 * shared with the wider `morningStarPerMonth` budget at the
 * server side). When that quota integration lands the predicate
 * gains a `'tier-limit-reached'` branch, but until then the
 * function only differentiates Free vs. paid.
 */
export const canStartEchoChamber = (tier: UserTier = getCurrentTier()): PaywallVerdict => {
  if (tier === 'free') {
    return {
      reason: 'free-tier-no-echo-chamber',
      blocked: true,
      tier,
      limit: 0,
      used: 0,
      suggestedUpgrade: upgradePathFor(tier),
    };
  }
  return {
    reason: 'ok',
    blocked: false,
    tier,
    limit: TIER_LIMITS[tier].morningStarPerMonth,
    used: 0,
    suggestedUpgrade: upgradePathFor(tier),
  };
};

/** Pre-emptive predicate the Dashboard CTA reads to grey out the
 *  Echo Chamber FAB. */
export const isEchoChamberBlocked = (tier: UserTier = getCurrentTier()): boolean =>
  canStartEchoChamber(tier).blocked;
