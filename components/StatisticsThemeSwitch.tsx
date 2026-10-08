import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDown, ChevronDown, Moon, Palette, Sun } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface StatisticsThemeSwitchProps {
  theme: Theme;
  t: TranslationDictionary;
  onSetTheme: (next: Theme) => void;
}

/**
 * Collapsible theme switch (light / dark) inside the statistics
 * widget. The toggle row is now a real `<button>` with `aria-expanded`
 * (was a `<div onClick>`); the two theme cards are real `<button>`s
 * with `aria-pressed` so screen readers announce the active theme.
 *
 * Pulled out of `StatisticsWidget.tsx` as part of Phase 2 §2.m.
 */
export const StatisticsThemeSwitch: React.FC<StatisticsThemeSwitchProps> = ({
  theme,
  t,
  onSetTheme,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="statistics-theme-options"
        className={`flex items-center justify-between group cursor-pointer text-[10px] font-mono uppercase tracking-[0.2em] px-1 py-1 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-cyan-50 text-slate-400 hover:text-cyan-600' : 'hover:bg-cyan-950/30 text-cyan-800 hover:text-cyan-400'}`}
      >
        <span className="flex items-center gap-2">
          <Palette className="w-3 h-3" />
          {t.lightShadowMode}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="statistics-theme-options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-cyan-500/10">
              <button
                type="button"
                onClick={() => onSetTheme('light')}
                aria-pressed={theme === 'light'}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-left group ${theme === 'light' ? 'bg-white border-cyan-200 shadow-sm' : 'bg-transparent border-vector-navy-deep/20'}`}
              >
                <div className="flex items-center gap-2 w-full mb-1">
                  <Sun
                    className={`w-4 h-4 ${theme === 'light' ? 'text-cyan-500' : 'text-vector-slate-chrome/30'}`}
                  />
                  <span
                    className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-800' : 'text-vector-slate-chrome/30'}`}
                  >
                    {t.lightMode}
                  </span>
                  <ArrowDown
                    className={`w-3 h-3 ml-auto rotate-[-135deg] ${theme === 'light' ? 'text-cyan-400' : 'text-vector-navy-deep/40'}`}
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSetTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-left ${theme === 'dark' ? 'bg-vector-cyan-neon/5 border-vector-cyan-neon/40' : 'bg-transparent border-slate-100'}`}
              >
                <div className="flex items-center gap-2 w-full mb-1">
                  <Moon
                    className={`w-4 h-4 ${theme === 'dark' ? 'text-vector-cyan-neon' : 'text-slate-300'}`}
                  />
                  <span
                    className={`text-[10px] font-bold ${theme === 'dark' ? 'text-vector-ice-pale' : 'text-slate-300'}`}
                  >
                    {t.darkMode}
                  </span>
                  <ArrowDown
                    className={`w-3 h-3 ml-auto rotate-[-135deg] ${theme === 'dark' ? 'text-vector-cyan-neon/50' : 'text-slate-100'}`}
                  />
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
