import { afterEach, describe, expect, it } from 'vitest';
import {
  TIER_LIMITS,
  canChatMemoir,
  canCreateCustomPersona,
  canCreateMemoir,
  canStartEchoChamber,
  getCurrentTier,
  getTierLimits,
  isCustomPersonaCreationBlocked,
  isEchoChamberBlocked,
  isMemoirCreationBlocked,
  tierFromLicense,
} from './quotaService';
import { mintPersona } from './personaService';
import type { LicensePayload } from './licenseToken';

const samplePersona = (name = 'p') => mintPersona({ name, systemPrompt: 'x'.repeat(200) });

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
      // happy-dom defaults to localhost, so the dev override is allowed.
      // Without setting it, we should still get free.
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
    it('exposes the correct ceilings per tier', () => {
      expect(getTierLimits('free').customPersonaCount).toBe(0);
      expect(getTierLimits('stardust').customPersonaCount).toBe(5);
      expect(getTierLimits('polaris').customPersonaCount).toBe(30);
      expect(getTierLimits('owner').customPersonaCount).toBe(50);
    });

    it('matches the TIER_LIMITS source-of-truth table', () => {
      expect(getTierLimits('free')).toEqual(TIER_LIMITS.free);
      expect(getTierLimits('polaris')).toEqual(TIER_LIMITS.polaris);
    });
  });

  describe('canCreateCustomPersona', () => {
    it('Free tier is HARD-BLOCKED with reason free-tier-no-personas', () => {
      const verdict = canCreateCustomPersona([], 'free');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('free-tier-no-personas');
      expect(verdict.limit).toBe(0);
      expect(verdict.used).toBe(0);
      expect(verdict.suggestedUpgrade).toBe('stardust');
    });

    it('Stardust below cap is allowed', () => {
      const verdict = canCreateCustomPersona([samplePersona()], 'stardust');
      expect(verdict.blocked).toBe(false);
      expect(verdict.reason).toBe('ok');
      expect(verdict.used).toBe(1);
      expect(verdict.limit).toBe(5);
    });

    it('Stardust at cap is blocked with reason tier-limit-reached', () => {
      const list = Array.from({ length: 5 }, (_, i) => samplePersona(`p${i}`));
      const verdict = canCreateCustomPersona(list, 'stardust');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('tier-limit-reached');
      expect(verdict.suggestedUpgrade).toBe('polaris');
    });

    it('Owner has the highest cap and no upgrade suggestion', () => {
      const verdict = canCreateCustomPersona([samplePersona()], 'owner');
      expect(verdict.blocked).toBe(false);
      expect(verdict.suggestedUpgrade).toBe(null);
    });

    it('Memoir personas do NOT count toward the persona quota', () => {
      // Memoir personas have their own (separate) quota track.
      // Mixing 5 memoirs into a Stardust user's list should still
      // allow them to create personas — we are below the persona cap.
      const memoirList = Array.from({ length: 5 }, (_, i) =>
        mintPersona({ name: `m${i}`, systemPrompt: 'x'.repeat(200), kind: 'memoir' }),
      );
      const verdict = canCreateCustomPersona(memoirList, 'stardust');
      expect(verdict.blocked).toBe(false);
      expect(verdict.used).toBe(0); // only personas, not memoirs
    });
  });

  describe('isCustomPersonaCreationBlocked', () => {
    it('mirrors canCreateCustomPersona().blocked', () => {
      expect(isCustomPersonaCreationBlocked([], 'free')).toBe(true);
      expect(isCustomPersonaCreationBlocked([], 'stardust')).toBe(false);
    });
  });

  /* -------------------------------------------------------------- */
  /*  Memoir paywall predicates (Phase 4 Week 3)                    */
  /* -------------------------------------------------------------- */

  const sampleMemoir = (name = 'm') =>
    mintPersona({ name, systemPrompt: 'x'.repeat(200), kind: 'memoir' });

  describe('canCreateMemoir', () => {
    it('Free tier is HARD-BLOCKED with reason free-tier-no-memoirs', () => {
      const verdict = canCreateMemoir([], 'free');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('free-tier-no-memoirs');
      expect(verdict.limit).toBe(0);
      expect(verdict.suggestedUpgrade).toBe('stardust');
    });

    it('Stardust below cap is allowed', () => {
      const verdict = canCreateMemoir([], 'stardust');
      expect(verdict.blocked).toBe(false);
      expect(verdict.reason).toBe('ok');
      expect(verdict.limit).toBe(1);
    });

    it('Stardust at cap (1 memoir) is blocked with tier-limit-reached', () => {
      const verdict = canCreateMemoir([sampleMemoir('m1')], 'stardust');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('tier-limit-reached');
      expect(verdict.suggestedUpgrade).toBe('polaris');
    });

    it('Polaris allows up to 5 memoirs', () => {
      const list = Array.from({ length: 5 }, (_, i) => sampleMemoir(`m${i}`));
      expect(canCreateMemoir(list.slice(0, 4), 'polaris').blocked).toBe(false);
      expect(canCreateMemoir(list, 'polaris').blocked).toBe(true);
    });

    it('regular personas do NOT count toward the memoir quota', () => {
      const list = Array.from({ length: 5 }, (_, i) =>
        mintPersona({ name: `p${i}`, systemPrompt: 'x'.repeat(200) }),
      );
      const verdict = canCreateMemoir(list, 'stardust');
      expect(verdict.blocked).toBe(false);
      expect(verdict.used).toBe(0);
    });
  });

  describe('isMemoirCreationBlocked', () => {
    it('mirrors canCreateMemoir().blocked', () => {
      expect(isMemoirCreationBlocked([], 'free')).toBe(true);
      expect(isMemoirCreationBlocked([], 'stardust')).toBe(false);
      expect(isMemoirCreationBlocked([sampleMemoir()], 'stardust')).toBe(true);
    });
  });

  describe('canChatMemoir', () => {
    it('Free tier is HARD-BLOCKED even before any chat is consumed', () => {
      const verdict = canChatMemoir(0, 'free');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('free-tier-no-memoir-chats');
    });

    it('Stardust below 500/year is allowed', () => {
      const verdict = canChatMemoir(120, 'stardust');
      expect(verdict.blocked).toBe(false);
      expect(verdict.limit).toBe(500);
      expect(verdict.used).toBe(120);
    });

    it('Stardust at 500/year is blocked with memoir-chat-quota-exhausted', () => {
      const verdict = canChatMemoir(500, 'stardust');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('memoir-chat-quota-exhausted');
    });

    it('Polaris allows up to 1000/year per memoir', () => {
      expect(canChatMemoir(999, 'polaris').blocked).toBe(false);
      expect(canChatMemoir(1000, 'polaris').blocked).toBe(true);
    });

    it('coerces negative / non-integer used counts safely', () => {
      const verdict = canChatMemoir(-50, 'stardust');
      expect(verdict.used).toBe(0);
      expect(verdict.blocked).toBe(false);
    });
  });

  /* -------------------------------------------------------------- */
  /*  Phase 4.5 §B — Echo Chamber                                    */
  /* -------------------------------------------------------------- */

  describe('canStartEchoChamber', () => {
    it('Free tier is HARD-BLOCKED with reason free-tier-no-echo-chamber', () => {
      const verdict = canStartEchoChamber('free');
      expect(verdict.blocked).toBe(true);
      expect(verdict.reason).toBe('free-tier-no-echo-chamber');
      expect(verdict.suggestedUpgrade).toBe('stardust');
    });

    it('Stardust+ is allowed', () => {
      for (const tier of ['stardust', 'polaris', 'owner'] as const) {
        const verdict = canStartEchoChamber(tier);
        expect(verdict.blocked).toBe(false);
        expect(verdict.reason).toBe('ok');
      }
    });

    it('exposes the morningStarPerMonth budget as the soft limit', () => {
      expect(canStartEchoChamber('stardust').limit).toBe(TIER_LIMITS.stardust.morningStarPerMonth);
    });
  });

  describe('isEchoChamberBlocked', () => {
    it('mirrors canStartEchoChamber().blocked', () => {
      expect(isEchoChamberBlocked('free')).toBe(true);
      expect(isEchoChamberBlocked('stardust')).toBe(false);
    });
  });

  /* -------------------------------------------------------------- */
  /*  Phase 5 §5.1 — license → tier bridge                           */
  /* -------------------------------------------------------------- */

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
