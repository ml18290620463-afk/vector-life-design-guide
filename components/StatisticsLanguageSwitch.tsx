import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Globe } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface StatisticsLanguageSwitchProps {
  theme: Theme;
  t: TranslationDictionary;
  language: Language;
  onSetLanguage: (next: Language) => void;
}

const LANGUAGES: ReadonlyArray<{ id: Language; label: string }> = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'es', label: 'Español' },
];

/**
 * Collapsible language switch (7 supported locales) inside the
 * statistics widget. The toggle row is now a real `<button>` with
 * `aria-expanded`; the language buttons are `role="radio"` inside a
 * `role="radiogroup"` so screen readers announce the active language.
 *
 * Pulled out of `StatisticsWidget.tsx` as part of Phase 2 §2.m.
 */
export const StatisticsLanguageSwitch: React.FC<StatisticsLanguageSwitchProps> = ({
  theme,
  t,
  language,
  onSetLanguage,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="statistics-language-options"
        className={`flex items-center justify-between group cursor-pointer text-[10px] font-mono uppercase tracking-[0.2em] px-1 py-1 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-cyan-50 text-slate-400 hover:text-cyan-600' : 'hover:bg-cyan-950/30 text-cyan-800 hover:text-cyan-400'}`}
      >
        <span className="flex items-center gap-2">
          <Globe className="w-3 h-3" />
          {t.interfaceLanguage}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id="statistics-language-options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              role="radiogroup"
              aria-label={t.interfaceLanguage}
              className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-3 gap-1.5 pt-1 border-t border-dashed border-cyan-500/10"
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  role="radio"
                  aria-checked={language === lang.id}
                  onClick={() => onSetLanguage(lang.id)}
                  className={`flex items-center justify-center py-1.5 px-1 rounded-lg border transition-all text-[9px] font-mono cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    language === lang.id
                      ? theme === 'light'
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-600 shadow-sm'
                        : 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold'
                      : theme === 'light'
                        ? 'bg-white border-slate-100 text-slate-400 hover:border-cyan-200 hover:text-cyan-500'
                        : 'bg-white/[0.02] border-white/[0.05] text-vector-slate-chrome hover:border-cyan-800 hover:text-cyan-400'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
