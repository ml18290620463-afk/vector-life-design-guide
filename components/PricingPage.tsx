import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Crown, Loader2, Sparkles, Star, X } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import {
  PRICING,
  annualSavingsPercent,
  formatUsdPrice,
  type BillingPeriod,
  type PriceSku,
} from '../lib/pricing';
import type { LicenseTier } from '../services/licenseToken';
import { startCheckout, type StartCheckoutFailure } from '../services/checkoutService';

/**
 * Phase 5.2 — `PricingPage`
 *
 * Public USD-pricing landing surface. Reachable from:
 *
 *   - Settings → "Plans (USD)" → "Upgrade" CTA (Q6).
 *   - Direct URL `/?pricing=1` for marketing links.
 *
 * # Currency posture
 *
 * Every price renders via `formatUsdPrice` (`$X.XX USD`). The
 * literal `USD` suffix is the explicit product policy from
 * `lib/pricing.ts` — never strip it.
 *
 * # Layout
 *
 * Three columns (Stardust / Polaris / Owner). Each column shows:
 *   - Tier name + tagline.
 *   - The current price (monthly default, annual after toggle).
 *   - A per-tier feature list (4-6 bullets).
 *   - The CTA: "Subscribe via Stripe" → calls `startCheckout` →
 *     redirects to Stripe Checkout. Disabled when the page
 *     doesn't have an `installId` (the parent must pass it).
 *
 * # No PR-y dark patterns
 *
 * The page deliberately doesn't:
 *   - Show a fake "limited-time discount" badge.
 *   - Default to annual billing in the toggle (we let users see
 *     the monthly price first; annual is opt-in).
 *   - Hide the lifetime SKU behind a fold.
 *   - Ask for an email before showing the price.
 *
 * # Sub-states
 *
 *   - `submitting` — between "Subscribe" click and Stripe
 *     redirect. Disables every button so the user can't
 *     double-submit.
 *   - `failure` — Stripe / network error. Surfaces a localised
 *     `pricingFailure_*` banner (the user can retry).
 */

interface PricingPageProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Anonymous install id from `useLicense.installId`. Passed
   *  through to Stripe Checkout `metadata.installId`. When null
   *  the CTA is disabled with a "loading…" copy (the parent
   *  hasn't hydrated `useLicense` yet). */
  installId: string | null;
  /** Close the pricing page (typically routes back to the
   *  Cover screen or Settings). */
  onClose: () => void;
}

const FEATURES_BY_TIER: Record<LicenseTier, readonly string[]> = {
  stardust: [
    'pricingFeatStardust1',
    'pricingFeatStardust2',
    'pricingFeatStardust3',
    'pricingFeatStardust4',
  ],
  polaris: [
    'pricingFeatPolaris1',
    'pricingFeatPolaris2',
    'pricingFeatPolaris3',
    'pricingFeatPolaris4',
    'pricingFeatPolaris5',
  ],
  owner: ['pricingFeatOwner1', 'pricingFeatOwner2', 'pricingFeatOwner3', 'pricingFeatOwner4'],
};

const ICON_BY_TIER: Record<LicenseTier, React.ReactNode> = {
  stardust: <Sparkles className="w-5 h-5" aria-hidden="true" />,
  polaris: <Star className="w-5 h-5" aria-hidden="true" />,
  owner: <Crown className="w-5 h-5" aria-hidden="true" />,
};

/** Pick the SKU rendered in a given column based on the active
 *  toggle. Owner is always lifetime. */
const skuForColumn = (tier: LicenseTier, period: BillingPeriod): PriceSku | null => {
  if (tier === 'owner') return PRICING.find((s) => s.tier === 'owner') ?? null;
  return PRICING.find((s) => s.tier === tier && s.period === period) ?? null;
};

export const PricingPage: React.FC<PricingPageProps> = ({ theme, t, installId, onClose }) => {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [submittingTier, setSubmittingTier] = useState<LicenseTier | null>(null);
  const [failure, setFailure] = useState<StartCheckoutFailure | null>(null);

  const tiers: LicenseTier[] = useMemo(() => ['stardust', 'polaris', 'owner'], []);

  const handleSubscribe = async (tier: LicenseTier) => {
    if (!installId) return;
    const sku = skuForColumn(tier, period);
    if (!sku) {
      setFailure('sku-not-configured');
      return;
    }
    setSubmittingTier(tier);
    setFailure(null);
    try {
      const result = await startCheckout({
        tier,
        period: sku.period,
        installId,
      });
      if (result.ok === false) {
        setFailure(result.reason);
        setSubmittingTier(null);
        return;
      }
      // Hand off to Stripe.
      window.location.assign(result.url);
    } catch {
      setFailure('unknown');
      setSubmittingTier(null);
    }
  };

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white text-vector-ink-strong'
      : 'bg-vector-night-navy text-cyan-100';
  const subtle = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';
  const cardBase =
    theme === 'light' ? 'bg-white border-cyan-200' : 'bg-vector-night-deep/40 border-cyan-500/20';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-[150] overflow-y-auto ${surface}`}
      role="dialog"
      aria-labelledby="pricing-title"
      data-testid="pricing-page"
    >
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 id="pricing-title" className="text-3xl md:text-4xl font-bold tracking-tight">
              {(t.pricingTitle as string) ?? 'Choose your plan'}
            </h1>
            <p className={`mt-2 text-sm ${subtle}`}>
              {(t.pricingSubtitle as string) ??
                'All prices are in US dollars. Local-currency totals are calculated at checkout.'}
            </p>
            <p className={`mt-2 text-xs ${subtle}`}>
              {`Payment happens on web checkout. After success, redeem your feature code in-app.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={(t.close as string) ?? 'Close'}
            className={`p-2 rounded-md hover:bg-cyan-500/10`}
            data-testid="pricing-close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Period toggle (monthly / annual). Owner ignores it. */}
        <div className="flex items-center justify-center mb-8" role="radiogroup">
          {(['monthly', 'annual'] as const).map((p) => (
            <label
              key={p}
              className={`px-4 py-2 cursor-pointer text-[12px] uppercase tracking-widest border first:rounded-l-md last:rounded-r-md ${period === p ? (theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200') : `${subtle} border-transparent`}`}
            >
              <input
                type="radio"
                name="pricing-period"
                value={p}
                checked={period === p}
                onChange={() => setPeriod(p)}
                className="sr-only"
                data-testid={`pricing-period-${p}`}
              />
              {(t[`licensePeriod_${p}` as keyof TranslationDictionary] as string | undefined) ?? p}
              {p === 'annual' && (
                <span className="ml-2 text-[10px] text-emerald-400">~17% off</span>
              )}
            </label>
          ))}
        </div>

        {/* Failure banner */}
        {failure && (
          <p
            role="status"
            data-testid="pricing-failure"
            className={`mb-4 text-center text-[12px] text-rose-400`}
          >
            {(t[`pricingFailure_${failure}` as keyof TranslationDictionary] as
              | string
              | undefined) ?? failure}
          </p>
        )}

        {/* Three-column tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const sku = skuForColumn(tier, period);
            if (!sku) return null;
            const savings = annualSavingsPercent(sku);
            const features = FEATURES_BY_TIER[tier];
            const submitting = submittingTier === tier;
            const disabled = submitting || !installId || submittingTier !== null;
            return (
              <div
                key={tier}
                className={`flex flex-col gap-4 p-6 rounded-xl border ${cardBase}`}
                data-testid={`pricing-card-${tier}`}
              >
                <div className="flex items-center gap-2">
                  <span className={theme === 'light' ? 'text-cyan-700' : 'text-cyan-300'}>
                    {ICON_BY_TIER[tier]}
                  </span>
                  <h2 className="text-xl font-bold">
                    {(t[`licenseTier_${tier}` as keyof TranslationDictionary] as
                      | string
                      | undefined) ?? tier}
                  </h2>
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight font-mono">
                    {formatUsdPrice(sku.amountUsdCents)}
                  </p>
                  <p className={`text-[11px] ${subtle}`}>
                    {tier === 'owner'
                      ? ((t.pricingOnceOff as string) ?? 'one-time payment')
                      : period === 'annual'
                        ? ((t.pricingPerYear as string) ?? 'per year')
                        : ((t.pricingPerMonth as string) ?? 'per month')}
                    {savings != null && savings > 0 && (
                      <span className="ml-2 text-emerald-400">
                        {(t.pricingAnnualSavings as string)?.replace(
                          '{percent}',
                          String(savings),
                        ) ?? `save ${savings}%`}
                      </span>
                    )}
                  </p>
                </div>
                <ul className={`flex flex-col gap-1.5 text-[12px] ${subtle}`}>
                  {features.map((key) => {
                    const copy =
                      (t[key as keyof TranslationDictionary] as string | undefined) ?? key;
                    return (
                      <li key={key} className="flex items-start gap-1.5">
                        <Check
                          className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{copy}</span>
                      </li>
                    );
                  })}
                </ul>
                <CyberButton
                  theme={theme}
                  onClick={() => void handleSubscribe(tier)}
                  disabled={disabled}
                  aria-label={
                    (t[`pricingSubscribeAria_${tier}` as keyof TranslationDictionary] as
                      | string
                      | undefined) ?? `Subscribe to ${tier}`
                  }
                  data-testid={`pricing-subscribe-${tier}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                      {(t.pricingSubmitting as string) ?? 'Redirecting…'}
                    </>
                  ) : !installId ? (
                    ((t.pricingLoading as string) ?? 'Loading…')
                  ) : (
                    ((t.pricingSubscribe as string) ?? 'Subscribe via Stripe')
                  )}
                </CyberButton>
              </div>
            );
          })}
        </div>

        <p className={`mt-8 text-center text-[10px] ${subtle}`}>
          {(t.pricingFooterTrust as string) ??
            'Powered by Stripe. We never see your card details. Your install id is the only data we send to Stripe alongside your payment.'}
        </p>
      </div>
    </motion.div>
  );
};
