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
    <div className="master-lock-nav relative z-50 flex items-center gap-3">
      {isRecoveryMode ? (
        <button
          onClick={onBackFromRecovery}
          aria-label={language === 'zh' ? '返回解锁' : 'Back to unlock'}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-raised)] text-[var(--ds-text)] transition-colors hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)]"
          title={language === 'zh' ? '返回解锁' : 'Back'}
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>
      ) : (
        onCancel && (
          <>
            <button
              onClick={onCancelClick}
              aria-label={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)] ${isConfirmingCancel ? 'border-[var(--ds-danger)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]' : 'border-[var(--ds-border)] bg-[var(--ds-surface-raised)] text-[var(--ds-text)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-hover)]'}`}
              title={language === 'zh' ? '返回上一步' : 'Back to Previous Step'}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {isConfirmingCancel && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-[var(--ds-danger)] bg-[var(--ds-danger-bg)] px-3 py-2"
              >
                <AlertCircle className="h-4 w-4 text-[var(--ds-danger)]" />
                <span className="text-xs font-medium text-[var(--ds-danger)]">
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
