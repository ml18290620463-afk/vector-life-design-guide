import React from 'react';
import { Activity } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { StatisticsIdentityCard } from './StatisticsIdentityCard';
import { StatisticsThemeSwitch } from './StatisticsThemeSwitch';
import { StatisticsLanguageSwitch } from './StatisticsLanguageSwitch';
import { StatisticsRecoveryRow } from './StatisticsRecoveryRow';

interface StatisticsWidgetProps {
  theme: Theme;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  customIdentity: string;
  setCustomIdentity: (identity: string) => void;
  dynamicVersion: string;
  isUnlocked: boolean;
  onSetTheme: (theme: Theme) => void;
  setSecurityMode: (mode: 'idle' | 'setup' | 'confirm') => void;
  setIsViewingRecovery: (viewing: boolean) => void;
  passwordHash: string | null;
}

/**
 * Top section of the Settings drawer — identity badge + theme +
 * language + emergency anchor shortcut. Phase 2 §2.m broke the
 * original 341-LOC monolith into four focused sub-components and
 * this file now only owns the card frame + decorative chrome +
 * compositional wiring.
 *
 * The five `<div onClick>` interaction sites that previously kept
 * this file inside the legacy ESLint override block were promoted
 * to real `<button>` / `role="radio"` / `role="radiogroup"`
 * elements, so the widget is now jsx-a11y-clean on its own.
 */
export const StatisticsWidget: React.FC<StatisticsWidgetProps> = ({
  theme,
  language,
  onSetLanguage,
  customIdentity,
  setCustomIdentity,
  dynamicVersion,
  isUnlocked,
  onSetTheme,
  setSecurityMode,
  setIsViewingRecovery,
  passwordHash,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div
      className={`relative rounded-2xl border p-6 space-y-6 transition-all overflow-hidden ${theme === 'light' ? 'bg-white/80 border-slate-100 shadow-sm' : 'bg-black/40 border-cyan-900/20'}`}
    >
      {/* Decorative Corner Accents */}
      <div
        aria-hidden="true"
        className={`absolute top-0 left-0 w-8 h-8 pointer-events-none border-t border-l ${theme === 'light' ? 'border-cyan-200' : 'border-cyan-500/20'}`}
      />
      <div
        aria-hidden="true"
        className={`absolute top-0 right-0 w-8 h-8 pointer-events-none border-t border-r ${theme === 'light' ? 'border-cyan-200' : 'border-cyan-500/20'}`}
      />
      <div
        aria-hidden="true"
        className={`absolute bottom-0 left-0 w-8 h-8 pointer-events-none border-b border-l ${theme === 'light' ? 'border-cyan-200' : 'border-cyan-500/20'}`}
      />
      <div
        aria-hidden="true"
        className={`absolute bottom-0 right-0 w-8 h-8 pointer-events-none border-b border-r ${theme === 'light' ? 'border-cyan-200' : 'border-cyan-500/20'}`}
      />

      {/* Structural Scanline */}
      <div
        aria-hidden="true"
        className={`absolute top-0 left-12 right-12 h-px pointer-events-none ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-cyan-100 to-transparent opacity-50' : 'bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent opacity-30'}`}
      />

      <div className="flex items-center gap-2 mb-2 relative z-10">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-950/50 text-cyan-400'}`}
          aria-hidden="true"
        >
          <Activity className="w-5 h-5" />
        </span>
        <h4
          className={`text-sm font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-cyan-200'}`}
        >
          {t.navStatus}
        </h4>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <StatisticsIdentityCard
          theme={theme}
          t={t}
          customIdentity={customIdentity}
          setCustomIdentity={setCustomIdentity}
          dynamicVersion={dynamicVersion}
          isUnlocked={isUnlocked}
          onOpenSecuritySetup={() => setSecurityMode('setup')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
          <StatisticsThemeSwitch theme={theme} t={t} onSetTheme={onSetTheme} />
          <StatisticsLanguageSwitch
            theme={theme}
            t={t}
            language={language}
            onSetLanguage={onSetLanguage}
          />
        </div>
      </div>

      <StatisticsRecoveryRow
        theme={theme}
        t={t}
        language={language}
        passwordHash={passwordHash}
        onOpen={() => setIsViewingRecovery(true)}
      />
    </div>
  );
};
