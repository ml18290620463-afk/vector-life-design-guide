import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allSkusHaveStripeIds, resolveSku, resolveStripeId } from './stripeIds';

const ENV_KEYS = [
  'VECTOR_STRIPE_PRICE_STARDUST_MONTHLY',
  'VECTOR_STRIPE_PRICE_STARDUST_ANNUAL',
  'VECTOR_STRIPE_PRICE_POLARIS_MONTHLY',
  'VECTOR_STRIPE_PRICE_POLARIS_ANNUAL',
  'VECTOR_STRIPE_PRICE_OWNER_LIFETIME',
];

describe('services/stripeIds', () => {
  let original: Record<string, string | undefined> = {};

  beforeEach(() => {
    original = {};
    for (const k of ENV_KEYS) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  describe('resolveStripeId', () => {
    it('returns null when the env var is missing', () => {
      expect(resolveStripeId('stardust', 'monthly')).toBeNull();
    });
    it('returns the env var value when set', () => {
      process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = 'price_TEST_AAA';
      expect(resolveStripeId('stardust', 'monthly')).toBe('price_TEST_AAA');
    });
    it('returns null for an unknown (tier, period) combination', () => {
      // owner doesn't have a monthly SKU.
      expect(resolveStripeId('owner', 'monthly')).toBeNull();
    });
    it('returns null when the env var is the empty string', () => {
      process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = '';
      expect(resolveStripeId('stardust', 'monthly')).toBeNull();
    });
  });

  describe('allSkusHaveStripeIds', () => {
    it('returns false when nothing is configured', () => {
      expect(allSkusHaveStripeIds()).toBe(false);
    });
    it('returns true when EVERY SKU has its env var set', () => {
      process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = 'price_S_M';
      process.env.VECTOR_STRIPE_PRICE_STARDUST_ANNUAL = 'price_S_A';
      process.env.VECTOR_STRIPE_PRICE_POLARIS_MONTHLY = 'price_P_M';
      process.env.VECTOR_STRIPE_PRICE_POLARIS_ANNUAL = 'price_P_A';
      process.env.VECTOR_STRIPE_PRICE_OWNER_LIFETIME = 'price_O_L';
      expect(allSkusHaveStripeIds()).toBe(true);
    });
    it('returns false when one SKU is unset', () => {
      process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = 'price_S_M';
      process.env.VECTOR_STRIPE_PRICE_STARDUST_ANNUAL = 'price_S_A';
      process.env.VECTOR_STRIPE_PRICE_POLARIS_MONTHLY = 'price_P_M';
      process.env.VECTOR_STRIPE_PRICE_POLARIS_ANNUAL = 'price_P_A';
      // owner missing
      expect(allSkusHaveStripeIds()).toBe(false);
    });
  });

  describe('resolveSku', () => {
    it('returns the sku enriched with the resolved Stripe id', () => {
      process.env.VECTOR_STRIPE_PRICE_POLARIS_ANNUAL = 'price_PA';
      const sku = resolveSku('polaris', 'annual');
      expect(sku).not.toBeNull();
      expect(sku?.amountUsdCents).toBe(9990);
      expect(sku?.stripeIdResolved).toBe('price_PA');
    });
    it('null when no such SKU exists', () => {
      expect(resolveSku('owner', 'monthly')).toBeNull();
    });
    it('the price.stripeId field stays null (kept that way for the client bundle)', () => {
      process.env.VECTOR_STRIPE_PRICE_STARDUST_MONTHLY = 'price_SM';
      const sku = resolveSku('stardust', 'monthly');
      expect(sku?.stripeId).toBeNull();
      expect(sku?.stripeIdResolved).toBe('price_SM');
    });
  });
});
