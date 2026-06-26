import type { LicenseTier } from '../services/licenseToken';

/**
 * Phase 5 §5.1 — `lib/pricing.ts`
 *
 * Single source of truth for VECTOR's subscription pricing.
 *
 * # Currency policy
 *
 * **All prices are USD.** This is an explicit product decision — we
 * do NOT show local currency / dynamic FX conversion because:
 *
 *   1. FX rounding is misleading ("¥69.99" today vs ¥71.20 tomorrow
 *      after a rate refresh frustrates users and creates support
 *      churn).
 *   2. Stripe Checkout Sessions can be configured per currency, but
 *      tracking N currencies multiplies the SKU table and the
 *      revenue reconciliation overhead. v1 ships with a single
 *      currency.
 *   3. International users care more about the absolute USD price
 *      than a localised string — most of our target audience
 *      (26-38 yo, undergrad+, ¥50/mo+ willingness) reads English
 *      pricing comfortably.
 *
 * Display rule: render every price as `$X.XX USD` (the explicit
 * `USD` suffix — not just the `$` glyph — so users in CAD / AUD /
 * SGD / HKD jurisdictions don't mistake it for their local
 * currency). The i18n layer ONLY translates the surrounding copy
 * ("month" → "月", etc.) — it never localises the number.
 *
 * # Pricing matrix (locked 2026-05-XX, alpha pricing)
 *
 *   tier     | monthly | annual ($/yr saves) | one-time
 *   ---------|---------|---------------------|----------
 *   stardust | $4.99   | $49.90 (≈ 17% off)  | —
 *   polaris  | $9.99   | $99.90 (≈ 17% off)  | —
 *   owner    | —       | —                   | $199.00 (lifetime)
 *
 * Numbers may move during the alpha review window. The single
 * source of truth lives here so `LicenseSection.tsx`, the future
 * pricing landing page, and the Stripe price-id resolver all read
 * the same data.
 *
 * # Stripe price ids
 *
 * Stripe wants its own opaque `price_xxx` ids per SKU. We DON'T
 * embed them in the client (Phase 5.2 will resolve them on the
 * server when creating a Checkout Session). The `stripeId` field
 * stays `null` for v1 to make this explicit.
 */

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

export interface PriceSku {
  /** Tier this SKU upgrades the user into. */
  tier: LicenseTier;
  /** Billing cadence — drives the visible "$X / month" copy. */
  period: BillingPeriod;
  /** Price in USD cents (so `499` means "$4.99"). Cents avoid the
   *  classic `0.1 + 0.2 !== 0.3` floating-point trap. */
  amountUsdCents: number;
  /** When non-null, the cents you would have paid by buying this
   *  SKU's tier monthly for the same window — used to render the
   *  "save 17%" badge on annual SKUs without recomputing it on the
   *  fly. */
  comparisonMonthlyUsdCents: number | null;
  /** Stripe-side price id. Stays null until Phase 5.2 wires the
   *  real Stripe Checkout Session creator. */
  stripeId: string | null;
}

export const PRICING: readonly PriceSku[] = [
  {
    tier: 'stardust',
    period: 'monthly',
    amountUsdCents: 499,
    comparisonMonthlyUsdCents: null,
    stripeId: null,
  },
  {
    tier: 'stardust',
    period: 'annual',
    amountUsdCents: 4990,
    comparisonMonthlyUsdCents: 499 * 12, // 5988
    stripeId: null,
  },
  {
    tier: 'polaris',
    period: 'monthly',
    amountUsdCents: 999,
    comparisonMonthlyUsdCents: null,
    stripeId: null,
  },
  {
    tier: 'polaris',
    period: 'annual',
    amountUsdCents: 9990,
    comparisonMonthlyUsdCents: 999 * 12, // 11988
    stripeId: null,
  },
  {
    tier: 'owner',
    period: 'lifetime',
    amountUsdCents: 19900,
    comparisonMonthlyUsdCents: null,
    stripeId: null,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format USD cents as `$X.XX USD`. The literal `USD` suffix is
 *  intentional (see file-header rationale); callers MUST NOT strip
 *  it. The locale-neutral output makes price comparison across
 *  zh / en / future locales unambiguous. */
export const formatUsdPrice = (amountCents: number): string => {
  const sign = amountCents < 0 ? '-' : '';
  const abs = Math.abs(amountCents);
  const dollars = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}$${dollars}.${cents.toString().padStart(2, '0')} USD`;
};

/** Look up a SKU by tier + period. Returns null when no SKU
 *  matches (e.g. asking for `owner` monthly — there's no such
 *  SKU; owner is lifetime-only). */
export const findSku = (tier: LicenseTier, period: BillingPeriod): PriceSku | null =>
  PRICING.find((s) => s.tier === tier && s.period === period) ?? null;

/** Compute the "save %" string for an annual SKU. Returns null
 *  when `sku.comparisonMonthlyUsdCents` is null (monthly /
 *  lifetime SKUs have no comparison baseline). */
export const annualSavingsPercent = (sku: PriceSku): number | null => {
  if (sku.comparisonMonthlyUsdCents == null) return null;
  if (sku.amountUsdCents >= sku.comparisonMonthlyUsdCents) return 0;
  const ratio = 1 - sku.amountUsdCents / sku.comparisonMonthlyUsdCents;
  return Math.round(ratio * 100);
};
