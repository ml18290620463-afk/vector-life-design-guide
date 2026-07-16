import { afterEach, describe, expect, it } from 'vitest';
import {
  TIER_LIMITS,
  getCurrentTier,
  getTierLimits,
  tierFromLicense,
} from './quotaService';
import type { LicensePayload } from './licenseToken';

describe('services/quotaService', () => {
  describe('getCurrentTier', () => {
    afterEach(() => {
      try {
        window.localStorage.removeItem('vector_dev_tier');
      } catch {
        // ignore
      }
    });

    it('returns "free" by default', () => {
      expect(getCurrentTier()).toBe('free');
    });

    it('reads the dev override when on localhost', () => {
      window.localStorage.setItem('vector_dev_tier', 'polaris');
      expect(getCurrentTier()).toBe('polaris');
    });

    it('ignores invalid override values', () => {
      window.localStorage.setItem('vector_dev_tier', 'bogus');
      expect(getCurrentTier()).toBe('free');
    });
  });

  describe('getTierLimits', () => {
    it('exposes plan labels per tier', () => {
      expect(getTierLimits('free').label).toBe('Free');
      expect(getTierLimits('stardust').label).toBe('Stardust');
      expect(getTierLimits('polaris').label).toBe('Polaris');
      expect(getTierLimits('owner').label).toBe('Owner');
    });

    it('matches the TIER_LIMITS source-of-truth table', () => {
      expect(getTierLimits('free')).toEqual(TIER_LIMITS.free);
      expect(getTierLimits('polaris')).toEqual(TIER_LIMITS.polaris);
    });
  });

  describe('tierFromLicense', () => {
    const payload = (tier: 'stardust' | 'polaris' | 'owner'): LicensePayload => ({
      tier,
      sub: 'install-x',
      iat: 1,
      exp: 99999999999,
      kid: 'k',
    });

    it('returns "free" for a null payload', () => {
      expect(tierFromLicense(null)).toBe('free');
    });

    it('passes through every paid tier verbatim', () => {
      expect(tierFromLicense(payload('stardust'))).toBe('stardust');
      expect(tierFromLicense(payload('polaris'))).toBe('polaris');
      expect(tierFromLicense(payload('owner'))).toBe('owner');
    });
  });
});
