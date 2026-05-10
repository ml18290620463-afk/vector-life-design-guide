import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface MasterLockHeaderProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Whether the recovery branch is currently mounted (controls the
   *  left-side "back to unlock" button). */
  isRecoveryMode: boolean;
  /** Exits the recovery branch back to the unlock surface. */
  onBackFromRecovery: () => void;
  /** Optional cancel callback — when null, the right-side cancel
   *  button is hidden entirely. */
  onCancel?: () => void;
  /** Anti-misclick state from `useDoubleClickConfirm`. */
  isConfirmingCancel: boolean;
  /** Click handler bound to `useDoubleClickConfirm.trigger()`. */
  onCancelClick: () => void;
}

/**
 * The MasterLock card's top corners: left side hosts the "back to
 * unlock" link visible only inside the recovery branch; right side
 * hosts the cancel button that uses the double-click-confirm pattern
 * to prevent accidental bail-outs.
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i.
 */
export const MasterLockHeader: React.FC<MasterLockHeaderProps> = ({
  theme,
  language,
  t,
  isRecoveryMode,
  onBackFromRecovery,
  onCancel,
  isConfirmingCancel,
  onCancelClick,
}) => (
  <>
    {/* Navigation Control (left) */}
    <div className="absolute top-4 left-4 z-50">
      {isRecoveryMode && (
        <button
          onClick={onBackFromRecovery}
          className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 ${theme === 'light' ? 'text-slate-400 hover:text-slate-900' : 'text-cyan-600 hover:text-cyan-400'}`}
        >
          <ArrowRight className="w-3 h-3 rotate-180" /> {language === 'zh' ? '返回解锁' : 'BACK'}
        </button>
      )}
    </div>

    {/* Cancel button (right) — confirmation badge slides in from the right */}
    {onCancel && (
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        <AnimatePresence>
          {isConfirmingCancel && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 px-3 py-1 bg-black border border-vector-magenta/30 rounded-full shadow-[0_0_15px_color-mix(in_srgb,_var(--color-vector-magenta)_10%,_transparent)]"
            >
              <AlertCircle className="w-3 h-3 text-vector-magenta" />
              <span className="text-[10px] font-mono text-vector-magenta uppercase tracking-widest font-bold neon-glow-alert">
                {t.confirmAction}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onCancelClick}
          aria-label={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
          className={`p-2.5 rounded-full transition-all group ${isConfirmingCancel ? 'bg-vector-magenta text-white shadow-[0_0_20px_color-mix(in_srgb,_var(--color-vector-magenta)_40%,_transparent)]' : theme === 'light' ? 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-900 border border-transparent' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white border border-white/5'}`}
          title={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
        >
          <ArrowLeft
            className={`w-5 h-5 transition-transform ${isConfirmingCancel ? 'scale-110' : 'group-hover:scale-110'}`}
          />
        </button>
      </div>
    )}
  </>
);
