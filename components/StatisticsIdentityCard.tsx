import React from 'react';
import { Fingerprint, ShieldAlert } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface StatisticsIdentityCardProps {
  theme: Theme;
  t: TranslationDictionary;
  customIdentity: string;
  setCustomIdentity: (next: string) => void;
  dynamicVersion: string;
  isUnlocked: boolean;
  /** Open the master-password setup flow. Promoted from `<div onClick>`
   *  to a real `<button>` here so screen readers announce it correctly. */
  onOpenSecuritySetup: () => void;
}

/**
 * Decorative geometric sailboat used as the identity badge inside the
 * statistics widget. Pure SVG, no DOM events.
 */
const Sailboat: React.FC<{ className?: string; theme: Theme }> = ({ className, theme }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <polygon
      points="20,70 80,70 65,85 35,85"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <line
      x1="50"
      y1="18"
      x2="50"
      y2="70"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={theme === 'light' ? 'text-cyan-600' : 'text-indigo-500'}
    />
    <polygon
      points="52,22 52,65 76,65"
      fill="var(--color-cyan-600)"
      fillOpacity="0.4"
      stroke="var(--color-cyan-500)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <polygon
      points="48,32 48,65 30,65"
      fill="var(--color-cyan-600)"
      fillOpacity="0.1"
      stroke="var(--color-cyan-500)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Identity card inside the statistics widget. Renders the boat
 * avatar, the editable custom identity input, the dynamic-version
 * label, the "encryption active" badge and the security-calibration
 * affordance that opens the master-password setup flow.
 *
 * Pulled out of `StatisticsWidget.tsx` as part of Phase 2 §2.m. The
 * security-calibration row is now a real `<button>` (was a
 * `<div onClick>`), satisfying jsx-a11y rules so the widget can
 * leave the legacy ESLint override block.
 */
export const StatisticsIdentityCard: React.FC<StatisticsIdentityCardProps> = ({
  theme,
  t,
  customIdentity,
  setCustomIdentity,
  dynamicVersion,
  isUnlocked,
  onOpenSecuritySetup,
}) => (
  <div className="flex flex-1 gap-5 items-start">
    <div
      className={`w-20 h-20 rounded-full flex items-center justify-center border shrink-0 shadow-inner ${theme === 'light' ? 'bg-vector-fog-paper border-cyan-100' : 'bg-cyan-950/20 border-cyan-900/30'}`}
    >
      <Sailboat
        className={`w-10 h-10 ${theme === 'light' ? 'text-cyan-500' : 'text-cyan-400'}`}
        theme={theme}
      />
    </div>
    <div className="flex-1 min-w-0 py-1">
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <input
          type="text"
          value={customIdentity}
          onChange={(e) => setCustomIdentity(e.target.value)}
          aria-label={t.defineYourself}
          className={`text-lg font-bold bg-transparent border-none p-0 focus:ring-0 w-full lg:w-auto outline-none ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
          placeholder={t.defineYourself}
        />
        <span
          className={`text-xs font-mono opacity-60 ${theme === 'light' ? 'text-slate-500' : 'text-vector-slate-chrome'}`}
        >
          · {t.version} {dynamicVersion}
        </span>
      </div>
      <div
        className={`flex items-center gap-2 text-xs font-medium ${theme === 'light' ? 'text-green-600' : 'text-vector-teal-online'}`}
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        {t.encryptionActive}
      </div>

      <button
        type="button"
        onClick={onOpenSecuritySetup}
        className={`mt-4 inline-flex items-center gap-1.5 text-[10px] font-mono whitespace-nowrap bg-opacity-30 rounded-full px-3 py-1 cursor-pointer hover:ring-1 hover:ring-vector-cyan-neon/30 transition-all ${theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-vector-cyan-neon/5 text-vector-slate-chrome'}`}
      >
        <Fingerprint className="w-3 h-3" />
        {t.securityCalibration}:{' '}
        {isUnlocked ? (
          <span className="text-green-500">{t.statusUnlocked}</span>
        ) : (
          <span className="text-vector-teal-online opacity-80">{t.statusOnline}</span>
        )}{' '}
        · {t.secLevelHigh}
      </button>
    </div>
  </div>
);
