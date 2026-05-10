import React from 'react';
import { Anchor, ChevronRight } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface StatisticsRecoveryRowProps {
  theme: Theme;
  t: TranslationDictionary;
  language: Language;
  /** Whether the master password has ever been set; controls the
   *  status-string variants on the right-hand chip. */
  passwordHash: string | null;
  /** Open the recovery-key viewing surface. */
  onOpen: () => void;
}

const buildStatusCopy = (language: Language, passwordHash: string | null) => {
  if (passwordHash) {
    return {
      hint: language === 'zh' ? '32位唯一凭证已备案' : '32-char logic anchor secured',
      cta: language === 'zh' ? '点击检视' : 'Click to View',
    };
  }
  return {
    hint: null,
    cta: language === 'zh' ? '尚未备份' : 'No Backup',
  };
};

/**
 * "Emergency Anchor" recovery-key shortcut row inside the statistics
 * widget. Pulled out of `StatisticsWidget.tsx` as part of Phase 2 §2.m.
 *
 * The whole row is now a real `<button>` (was a `<div onClick>`) so
 * keyboard navigation lands on it, and the right-hand status text
 * advertises whether the user has ever set a master password.
 */
export const StatisticsRecoveryRow: React.FC<StatisticsRecoveryRowProps> = ({
  theme,
  t,
  language,
  passwordHash,
  onOpen,
}) => {
  const { hint, cta } = buildStatusCopy(language, passwordHash);
  const fallbackHint = t.emergencyAnchorDesc;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t.emergencyAnchor}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all text-left ${theme === 'light' ? 'bg-cyan-50/50 border-cyan-100/50 hover:bg-cyan-100/50' : 'bg-vector-cyan-neon/5 border-vector-navy-deep/30 hover:border-vector-cyan-neon/30'}`}
    >
      <div className="flex items-center gap-3">
        <Anchor
          className={`w-5 h-5 ${theme === 'light' ? 'text-cyan-500' : 'text-vector-cyan-neon'}`}
        />
        <span
          className={`text-sm font-bold ${theme === 'light' ? 'text-cyan-700' : 'text-vector-ice-pale'}`}
        >
          {t.emergencyAnchor}
        </span>
        <span
          className={`hidden md:inline text-xs ${theme === 'light' ? 'text-slate-400' : 'text-vector-slate-chrome/40'}`}
        >
          {' '}
          —— {hint ?? fallbackHint}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-mono ${theme === 'light' ? 'text-cyan-600' : 'text-vector-cyan-neon/80'}`}
        >
          {cta}
        </span>
        <ChevronRight
          className={`w-4 h-4 ${theme === 'light' ? 'text-cyan-300' : 'text-vector-slate-chrome/30'}`}
        />
      </div>
    </button>
  );
};
