import React, { useId, useState } from 'react';
import { Check, Crown, KeyRound, Sparkles, Star, Trash2 } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { CurrentTier } from '../hooks/useLicense';
import type { LicensePayload } from '../services/licenseToken';
import type { LoadLicenseFailure } from '../services/licenseStore';
import { CyberButton } from './CyberButton';
import { PRICING, formatUsdPrice } from '../lib/pricing';

/**
 * Phase 5 §5.1 — `LicenseSection`
 *
 * Settings-mounted card that exposes:
 *
 *   - The user's anonymous **install id** (read-only, copyable —
 *     they need to paste it into the Stripe Checkout form when
 *     Phase 5.2 ships).
 *   - The **current tier** + payload metadata (`tier` / `exp` /
 *     `kid`) when a license is active.
 *   - An **Activate license** text input + button for users to
 *     paste a token (today: minted by `npm run license:mint`;
 *     Phase 5.2: returned by the Stripe Checkout success
 *     redirect).
 *   - A **Deactivate** button when a license is active (e.g. user
 *     cancelled their subscription or wants to re-paste a fresh
 *     token).
 *   - A small read-only **price reference** so users see what each
 *     tier costs without needing to leave Settings.
 *
 * # Currency policy
 *
 * Every price renders via `formatUsdPrice` (`$X.XX USD`). The
 * literal `USD` suffix is intentional — see `lib/pricing.ts`
 * file-header rationale.
 *
 * # i18n
 *
 * Localised copy keys all begin with `license*` (zh + en
 * dictionaries). Failure reasons map to dedicated
 * `licenseFailure_*` keys so the UI can show actionable text
 * (e.g. "expired" → "请联系支持续期" rather than the raw enum).
 */

interface LicenseSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Anonymous install id from `useLicense.installId`. */
  installId: string;
  /** Current tier (`free` when no token). */
  currentTier: CurrentTier;
  /** Decoded payload (tier / exp / kid) when active. */
  payload: LicensePayload | null;
  /** Last verification failure for the persisted token, or null. */
  failure: LoadLicenseFailure | null;
  /** Wrap `useLicense.activate`. Returns null on success. */
  onActivate: (token: string) => Promise<LoadLicenseFailure | null>;
  /** Wrap `useLicense.deactivate`. */
  onDeactivate: () => Promise<void>;
  /** Phase 5.2 — open the public pricing page (Settings → Upgrade
   *  CTA). When omitted, the Upgrade button is hidden. */
  onOpenPricing?: () => void;
}

const formatExpDate = (expSeconds: number): string =>
  new Date(expSeconds * 1000).toISOString().slice(0, 10);

const tierIcon = (tier: CurrentTier): React.ReactNode => {
  switch (tier) {
    case 'stardust':
      return <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />;
    case 'polaris':
      return <Star className="w-3.5 h-3.5" aria-hidden="true" />;
    case 'owner':
      return <Crown className="w-3.5 h-3.5" aria-hidden="true" />;
    default:
      return <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />;
  }
};

export const LicenseSection: React.FC<LicenseSectionProps> = ({
  theme,
  t,
  installId,
  currentTier,
  payload,
  failure,
  onActivate,
  onDeactivate,
  onOpenPricing,
}) => {
  const inputId = useId();
  const [tokenInput, setTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activateError, setActivateError] = useState<LoadLicenseFailure | null>(null);
  const [installCopied, setInstallCopied] = useState(false);

  const handleSubmit = async () => {
    if (!tokenInput.trim()) return;
    setSubmitting(true);
    setActivateError(null);
    try {
      const reason = await onActivate(tokenInput);
      if (reason) {
        setActivateError(reason);
      } else {
        setTokenInput('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyInstallId = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(installId).then(() => {
      setInstallCopied(true);
      setTimeout(() => setInstallCopied(false), 1500);
    });
  };

  const surface =
    theme === 'light' ? 'bg-cyan-50/40 border-cyan-200' : 'bg-cyan-500/5 border-cyan-500/30';
  const headingTone = theme === 'light' ? 'text-cyan-900/80' : 'text-cyan-200/80';
  const subtle = theme === 'light' ? 'text-cyan-900/70' : 'text-cyan-200/70';
  const inputClass = `flex-1 p-2 text-[12px] font-mono rounded-md border ${theme === 'light' ? 'bg-white border-cyan-200 text-cyan-900' : 'bg-vector-night-deep/40 border-cyan-900/60 text-cyan-100'}`;
  const tierBadgeTone =
    currentTier === 'free'
      ? theme === 'light'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-slate-500/20 text-slate-300'
      : theme === 'light'
        ? 'bg-cyan-100 text-cyan-700'
        : 'bg-cyan-500/20 text-cyan-200';

  const failureMessage = activateError ?? failure ?? null;
  const failureCopy = failureMessage
    ? ((t[`licenseFailure_${failureMessage}` as keyof typeof t] as string | undefined) ??
      failureMessage)
    : null;

  return (
    <div
      className={`flex flex-col gap-3 border rounded-lg p-3 ${surface}`}
      data-testid="settings-license"
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 ${headingTone}`}
      >
        <KeyRound className="w-3 h-3" aria-hidden="true" />
        {(t.licenseTitle as string) ?? 'Subscription'}
      </p>

      {/* Current tier */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${tierBadgeTone}`}
            data-testid="settings-license-tier"
          >
            {tierIcon(currentTier)}
            {(t[`licenseTier_${currentTier}` as keyof typeof t] as string | undefined) ??
              currentTier}
          </span>
          {payload && (
            <span className={`text-[11px] ${subtle}`} data-testid="settings-license-exp">
              {(t.licenseExpires as string) ?? 'Expires'} {formatExpDate(payload.exp)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Phase 5.2 — Upgrade CTA. Visible whenever a pricing
              page handler is wired, regardless of current tier
              (paid users may still want to upgrade up the ladder
              or buy lifetime). */}
          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              className={`text-[11px] uppercase tracking-widest underline-offset-4 hover:underline ${theme === 'light' ? 'text-cyan-700' : 'text-cyan-300'}`}
              aria-label={(t.licenseUpgradeAria as string) ?? 'Open pricing page'}
              data-testid="settings-license-upgrade"
            >
              {currentTier === 'free'
                ? ((t.licenseUpgrade as string) ?? 'Upgrade')
                : ((t.licenseChangePlan as string) ?? 'Change plan')}
            </button>
          )}
          {payload && (
            <button
              type="button"
              onClick={() => void onDeactivate()}
              className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-rose-400 hover:text-rose-300"
              aria-label={(t.licenseDeactivateAria as string) ?? 'Deactivate license'}
              data-testid="settings-license-deactivate"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              {(t.licenseDeactivate as string) ?? 'Deactivate'}
            </button>
          )}
        </div>
      </div>

      {/* Failure banner */}
      {failureCopy && (
        <p
          className="text-[11px] text-rose-400 font-mono"
          role="status"
          data-testid="settings-license-failure"
        >
          {failureCopy}
        </p>
      )}

      {/* Install id */}
      <div className="flex flex-col gap-1">
        <p className={`text-[10px] uppercase tracking-widest ${subtle}`}>
          {(t.licenseInstallIdLabel as string) ?? 'Install id'}
        </p>
        <div className="flex items-center gap-2">
          <p
            className={`flex-1 text-[11px] font-mono truncate ${theme === 'light' ? 'text-cyan-900' : 'text-cyan-200'}`}
            data-testid="settings-license-install-id"
          >
            {installId}
          </p>
          <button
            type="button"
            onClick={handleCopyInstallId}
            className={`text-[11px] underline-offset-4 hover:underline ${subtle}`}
            data-testid="settings-license-copy-install-id"
          >
            {installCopied ? ((t.copied as string) ?? 'Copied') : ((t.copy as string) ?? 'Copy')}
          </button>
        </div>
        <p className={`text-[10px] leading-relaxed ${subtle}`}>
          {(t.licenseInstallIdHint as string) ??
            'Paste this id into the checkout form when you upgrade. Tokens issued for a different install id will be rejected.'}
        </p>
      </div>

      {/* Activate input */}
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className={`text-[10px] uppercase tracking-widest ${subtle}`}>
          {(t.licenseActivateLabel as string) ?? 'Paste feature redemption code'}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={(t.licenseActivatePlaceholder as string) ?? 'vector-license-v1.…'}
            className={inputClass}
            data-testid="settings-license-input"
            disabled={submitting}
          />
          <CyberButton
            theme={theme}
            onClick={() => void handleSubmit()}
            disabled={submitting || tokenInput.trim().length === 0}
            aria-label={(t.licenseActivateAria as string) ?? 'Activate license'}
            data-testid="settings-license-activate"
          >
            {submitting
              ? ((t.licenseActivating as string) ?? 'Activating…')
              : ((t.licenseActivate as string) ?? 'Activate')}
          </CyberButton>
        </div>
        <p className={`text-[10px] leading-relaxed ${subtle}`}>
          {`One code per user, non-transferable, up to 3 devices.`}
        </p>
      </div>

      {/* Pricing reference */}
      <details className="text-[11px]">
        <summary className={`cursor-pointer ${subtle}`}>
          {(t.licensePricingTitle as string) ?? 'Plans (USD)'}
        </summary>
        <ul className="mt-2 flex flex-col gap-1" data-testid="settings-license-pricing">
          {PRICING.map((sku) => (
            <li
              key={`${sku.tier}-${sku.period}`}
              className="flex items-center justify-between gap-2"
            >
              <span className={subtle}>
                {(t[`licenseTier_${sku.tier}` as keyof typeof t] as string | undefined) ?? sku.tier}{' '}
                ·{' '}
                {(t[`licensePeriod_${sku.period}` as keyof typeof t] as string | undefined) ??
                  sku.period}
              </span>
              <span
                className={`font-mono ${theme === 'light' ? 'text-cyan-900' : 'text-cyan-200'}`}
              >
                {formatUsdPrice(sku.amountUsdCents)}
              </span>
            </li>
          ))}
        </ul>
        <p className={`mt-2 text-[10px] leading-relaxed flex items-center gap-1 ${subtle}`}>
          <Check className="w-3 h-3" aria-hidden="true" />
          {(t.licensePricingFooter as string) ??
            'All prices are in US dollars. Local-currency totals appear at checkout once Phase 5.2 wires Stripe.'}
        </p>
      </details>
    </div>
  );
};
