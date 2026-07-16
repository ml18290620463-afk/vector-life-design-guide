export type UserTier = 'free' | 'stardust' | 'polaris' | 'owner';

/**
 * Lightweight tier metadata retained for billing / license surfaces.
 *
 * B4 keeps only a simple tier identity bridge so subscription UI can still
 * display a plan without implying deleted feature quotas.
 */
export const TIER_LIMITS = {
  free: { label: 'Free' },
  stardust: { label: 'Stardust' },
  polaris: { label: 'Polaris' },
  owner: { label: 'Owner' },
} as const satisfies Record<UserTier, { label: string }>;

export type TierLimits = (typeof TIER_LIMITS)[UserTier];

export const getCurrentTier = (): UserTier => {
  if (typeof window === 'undefined') return 'free';
  const isDevHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');
  if (!isDevHost) return 'free';
  try {
    const raw = window.localStorage.getItem('vector_dev_tier');
    if (raw === 'stardust' || raw === 'polaris' || raw === 'owner') return raw;
  } catch {
    // localStorage may be unavailable (e.g. private mode) — fall through.
  }
  return 'free';
};

export const getTierLimits = (tier: UserTier = getCurrentTier()): TierLimits => TIER_LIMITS[tier];

import type { LicensePayload } from './licenseToken';

export const tierFromLicense = (payload: LicensePayload | null): UserTier =>
  payload ? payload.tier : 'free';
