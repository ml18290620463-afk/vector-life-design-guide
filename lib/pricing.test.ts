import { describe, expect, it } from 'vitest';
import { PRICING, annualSavingsPercent, findSku, formatUsdPrice } from './pricing';

describe('lib/pricing', () => {
  describe('PRICING table', () => {
    it('contains the five locked SKUs from the alpha pricing matrix', () => {
      expect(PRICING).toHaveLength(5);
      expect(findSku('stardust', 'monthly')?.amountUsdCents).toBe(499);
      expect(findSku('stardust', 'annual')?.amountUsdCents).toBe(4990);
      expect(findSku('polaris', 'monthly')?.amountUsdCents).toBe(999);
      expect(findSku('polaris', 'annual')?.amountUsdCents).toBe(9990);
      expect(findSku('owner', 'lifetime')?.amountUsdCents).toBe(19900);
    });

    it('every SKU has stripeId=null until Phase 5.2 wires the real Stripe ids', () => {
      for (const sku of PRICING) {
        expect(sku.stripeId).toBeNull();
      }
    });
  });

  describe('formatUsdPrice', () => {
    it('renders cents as $X.XX USD with the explicit USD suffix', () => {
      expect(formatUsdPrice(499)).toBe('$4.99 USD');
      expect(formatUsdPrice(9990)).toBe('$99.90 USD');
      expect(formatUsdPrice(19900)).toBe('$199.00 USD');
      expect(formatUsdPrice(0)).toBe('$0.00 USD');
    });
    it('handles negative values (e.g. refunds)', () => {
      expect(formatUsdPrice(-499)).toBe('-$4.99 USD');
    });
    it('pads single-digit cents to two characters', () => {
      expect(formatUsdPrice(105)).toBe('$1.05 USD');
      expect(formatUsdPrice(1000)).toBe('$10.00 USD');
    });
  });

  describe('findSku', () => {
    it('returns null when no SKU matches the (tier, period) pair', () => {
      expect(findSku('owner', 'monthly')).toBeNull();
      expect(findSku('stardust', 'lifetime')).toBeNull();
    });
  });

  describe('annualSavingsPercent', () => {
    it('computes ~17% savings for the stardust annual SKU', () => {
      const sku = findSku('stardust', 'annual');
      if (!sku) throw new Error('expected sku');
      expect(annualSavingsPercent(sku)).toBe(17);
    });
    it('computes ~17% savings for the polaris annual SKU', () => {
      const sku = findSku('polaris', 'annual');
      if (!sku) throw new Error('expected sku');
      expect(annualSavingsPercent(sku)).toBe(17);
    });
    it('returns null for monthly SKUs (no comparison baseline)', () => {
      const sku = findSku('stardust', 'monthly');
      if (!sku) throw new Error('expected sku');
      expect(annualSavingsPercent(sku)).toBeNull();
    });
    it('returns null for the lifetime SKU', () => {
      const sku = findSku('owner', 'lifetime');
      if (!sku) throw new Error('expected sku');
      expect(annualSavingsPercent(sku)).toBeNull();
    });
  });
});
