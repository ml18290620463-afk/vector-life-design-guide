import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface PwaInstallBannerProps {
  /** When false, the banner renders nothing. Owner is the
   *  `usePwaInstallPrompt` hook (`isAvailable`). */
  active: boolean;
  theme: Theme;
  t: TranslationDictionary;
  /** Trigger the native install prompt. The browser only honours
   *  this inside a user-gesture handler, which the click delivers. */
  onInstall: () => void;
  /** "Not now" — persists for 30 days via the hook. */
  onDismiss: () => void;
}

/**
 * Phase 3 §3.g — Dashboard PWA install banner.
 *
 * Pure presentation; the upstream `usePwaInstallPrompt` hook
 * decides whether the browser actually fired
 * `beforeinstallprompt` and whether the user already dismissed
 * inside the 30-day window. The banner mirrors the
 * `BackupReminderBanner` look-and-feel so the visual vocabulary
 * stays coherent at the top of the Dashboard scroll surface.
 */
export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  active,
  theme,
  t,
  onInstall,
  onDismiss,
}) => {
  if (!active) return null;
  const surface =
    theme === 'light'
      ? 'border-cyan-200 bg-cyan-50 text-vector-cyan-brand'
      : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100';
  const action =
    theme === 'light'
      ? 'border-vector-cyan-brand/30 hover:bg-vector-cyan-brand hover:text-white'
      : 'border-cyan-400/40 hover:bg-cyan-500/20';
  const dismiss = theme === 'light' ? 'hover:bg-vector-cyan-brand/10' : 'hover:bg-cyan-500/10';
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-install-banner"
      className={`mb-6 flex items-start gap-3 px-4 py-3 rounded border text-[12px] leading-relaxed ${surface}`}
    >
      <Smartphone className="w-4 h-4 mt-[2px] flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <strong className="font-mono uppercase tracking-widest text-[10px] block mb-1">
          {t.pwaInstallTitle ?? 'Install VECTOR'}
        </strong>
        <span>
          {t.pwaInstallBody ??
            'Install the app for offline access, instant launches, and a homescreen icon. Your data stays local.'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onInstall}
          aria-label={t.pwaInstallAction ?? 'Install app'}
          className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest border px-3 py-1.5 transition-colors ${action}`}
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          {t.pwaInstallAction ?? 'Install app'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.pwaInstallDismiss ?? 'Not now'}
          title={t.pwaInstallDismiss ?? 'Not now'}
          className={`p-1.5 rounded transition-colors ${dismiss}`}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
