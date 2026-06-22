import React from 'react';
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
    <div className="master-lock-nav absolute left-7 top-7 z-50 flex items-center gap-3">
      {isRecoveryMode ? (
        <button
          onClick={onBackFromRecovery}
          aria-label={language === 'zh' ? '返回解锁' : 'Back to unlock'}
          className={`flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-sm ${theme === 'light' ? 'border-cyan-500/25 bg-white/65 text-cyan-700 hover:text-cyan-900' : 'border-cyan-500/30 bg-black/25 text-cyan-500 hover:text-cyan-300'}`}
          title={language === 'zh' ? '返回解锁' : 'Back'}
        >
          <ArrowRight className="h-7 w-7 rotate-180" />
        </button>
      ) : (
        onCancel && (
          <>
            <button
              onClick={onCancelClick}
              aria-label={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
              className={`flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-sm ${isConfirmingCancel ? 'border-vector-magenta bg-vector-magenta/15 text-vector-magenta shadow-[0_0_20px_color-mix(in_srgb,_var(--color-vector-magenta)_30%,_transparent)]' : theme === 'light' ? 'border-cyan-500/25 bg-white/65 text-cyan-700 hover:text-cyan-900' : 'border-cyan-500/30 bg-black/25 text-cyan-500 hover:text-cyan-300'}`}
              title={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            {isConfirmingCancel && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-full border border-vector-magenta/30 bg-black px-3 py-1 shadow-[0_0_15px_color-mix(in_srgb,_var(--color-vector-magenta)_10%,_transparent)]"
              >
                <AlertCircle className="h-3 w-3 text-vector-magenta" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-vector-magenta neon-glow-alert">
                  {t.confirmAction}
                </span>
              </div>
            )}
          </>
        )
      )}
    </div>
  </>
);
