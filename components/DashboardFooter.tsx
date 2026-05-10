import React from 'react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { GeometricBoat } from './GeometricBoat';

interface DashboardFooterProps {
  theme: Theme;
  t: TranslationDictionary;
  /** True while the boat is animating away after the user clicks it. */
  isSailingHome: boolean;
  /** Trigger the "sail home" animation; the parent decides what happens
   *  next (replay intro / navigate). */
  onGoHome: () => void;
}

/**
 * Motivational footer at the bottom of the Dashboard. Renders the
 * Geometric Boat affordance plus the localised quote / sub-quote.
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h so the
 * dashboard composes rather than inlines decorative chrome.
 */
export const DashboardFooter: React.FC<DashboardFooterProps> = ({
  theme,
  t,
  isSailingHome,
  onGoHome,
}) => (
  <div
    className={`relative z-10 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center group border mt-auto backdrop-blur-md transition-all duration-1000 ${theme === 'light' ? 'border-slate-200/40 bg-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.03)]' : 'border-cyan-900/20 bg-black/40'}`}
  >
    <div
      className={`absolute inset-0 opacity-[0.03] pointer-events-none ${theme === 'light' ? 'bg-[radial-gradient(#06b6d4_1px,transparent_1px)] bg-[size:20px_20px]' : 'bg-[radial-gradient(#06b6d4_1px,transparent_1px)] bg-[size:40px_40px]'}`}
    ></div>
    <div
      className={`absolute inset-0 pointer-events-none ${theme === 'light' ? 'bg-gradient-to-t from-cyan-500/10 via-transparent to-transparent' : 'bg-gradient-to-t from-cyan-900/10 to-transparent'}`}
    ></div>

    <div className="relative z-10 max-w-3xl px-8 text-center flex flex-col items-center">
      <button
        type="button"
        onClick={onGoHome}
        aria-label={t.replayIntro ?? 'Replay intro'}
        className={`mb-6 p-4 rounded-full border transition-all cursor-pointer bg-transparent ${
          isSailingHome
            ? 'duration-1000 translate-x-[200px] opacity-0 blur-md scale-75'
            : 'duration-700 hover:scale-110 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]'
        } ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-black/50 border-cyan-900/30'}`}
      >
        <div className="relative">
          <GeometricBoat
            className={`w-10 h-10 ${theme === 'light' ? 'text-slate-700' : 'text-slate-100'} relative z-10 transition-colors duration-500`}
            theme={theme}
          />
          <div
            className={`absolute inset-0 blur-md ${theme === 'light' ? 'bg-cyan-200/50' : 'bg-cyan-500/30'}`}
          ></div>
        </div>
      </button>
      <h3
        className={`text-xl md:text-2xl font-light tracking-[0.2em] mb-2 transition-colors duration-700 ${theme === 'light' ? 'text-slate-600 group-hover:text-slate-900' : 'text-cyan-200/80 group-hover:text-cyan-100'}`}
      >
        {t.quote}
      </h3>
      <p
        className={`text-[10px] font-mono tracking-[0.4em] uppercase ${theme === 'light' ? 'text-slate-300' : 'text-cyan-500/40'}`}
      >
        {t.quoteSub}
      </p>
    </div>
  </div>
);
