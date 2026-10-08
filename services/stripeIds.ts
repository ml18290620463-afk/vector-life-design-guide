import { PRICING, type PriceSku } from '../lib/pricing';
import type { LicenseTier } from './licenseToken';
import type { BillingPeriod } from '../lib/pricing';

/**
 * Phase 5.2 — `services/stripeIds.ts`
 *
 * Server-only bridge from a `(tier, period)` SKU to its Stripe
 * `price_xxx` id. Stripe wants opaque ids; we keep the actual ids
 * in env vars so:
 *
 *   - The same client bundle works against test mode (sk_test_…
 *     + price_test_xxx) and live mode (sk_live_… + price_live_xxx).
 *   - Rotating a price (e.g. opening a promo) is a config change,
 *     not a code change.
 *   - Price ids never end up in client bundles via mis-imports —
 *     this module reads `process.env` directly so the bundler
 *     dead-strips it from the browser build (no `process.env` at
 *     runtime in the browser; if anyone imports it client-side,
 *     `resolveStripeId` returns `null`).
 *
 * # Env contract
 *
 * The expected env vars (server-side only):
 *
 *   - `VECTOR_STRIPE_PRICE_STARDUST_MONTHLY`
 *   - `VECTOR_STRIPE_PRICE_STARDUST_ANNUAL`
 *   - `VECTOR_STRIPE_PRICE_POLARIS_MONTHLY`
 *   - `VECTOR_STRIPE_PRICE_POLARIS_ANNUAL`
 *   - `VECTOR_STRIPE_PRICE_OWNER_LIFETIME`
 *
 * Each must hold a valid Stripe price id (`price_…`). When any
 * env var is missing, `resolveStripeId` for that SKU returns
 * `null`; the create-session route surfaces this as a 503
 * "this SKU is not configured" so the user sees a clean error
 * instead of Stripe rejecting the call with an opaque message.
 */

const ENV_VAR_FOR_SKU: Record<string, string> = {
  'stardust:monthly': 'VECTOR_STRIPE_PRICE_STARDUST_MONTHLY',
  'stardust:annual': 'VECTOR_STRIPE_PRICE_STARDUST_ANNUAL',
  'polaris:monthly': 'VECTOR_STRIPE_PRICE_POLARIS_MONTHLY',
  'polaris:annual': 'VECTOR_STRIPE_PRICE_POLARIS_ANNUAL',
  'owner:lifetime': 'VECTOR_STRIPE_PRICE_OWNER_LIFETIME',
};

const skuKey = (tier: LicenseTier, period: BillingPeriod): string => `${tier}:${period}`;

/**
 * Resolve a SKU to its Stripe price id. Returns `null` when the
 * env var is missing OR when called from the client (no
 * `process.env` at runtime in the browser).
 */
export const resolveStripeId = (tier: LicenseTier, period: BillingPeriod): string | null => {
  if (typeof process === 'undefined' || !process.env) return null;
  const envName = ENV_VAR_FOR_SKU[skuKey(tier, period)];
  if (!envName) return null;
  const id = process.env[envName];
  if (!id || id.length === 0) return null;
  return id;
};

/** True when EVERY SKU in the pricing matrix has a Stripe id wired
 *  via env. Used by the server's startup-log to fail loudly when
 *  the operator forgot to set a price id. */
export const allSkusHaveStripeIds = (): boolean =>
  PRICING.every((sku) => resolveStripeId(sku.tier, sku.period) !== null);

/** Mirror of `findSku` from `lib/pricing.ts` but enriches the
 *  result with the resolved Stripe id (null when not configured).
 *  The Checkout Session creator passes the resolved id; the
 *  client-facing pricing page is unaware of Stripe ids entirely. */
export interface ResolvedSku extends PriceSku {
  stripeIdResolved: string | null;
}
export const resolveSku = (tier: LicenseTier, period: BillingPeriod): ResolvedSku | null => {
  const sku = PRICING.find((s) => s.tier === tier && s.period === period);
  if (!sku) return null;
  return { ...sku, stripeIdResolved: resolveStripeId(tier, period) };
};
