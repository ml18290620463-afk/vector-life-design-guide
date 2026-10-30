import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Globe } from 'lucide-react';
import { Language, Theme } from '../types';
import { NATIVE_LANG_NAMES, TRANSLATIONS } from '../constants';
import { isMobileExperience } from '../lib/previewMode';
import { useLockoutTimer } from '../hooks/useLockoutTimer';
import { useRecoveryFlow } from '../hooks/useRecoveryFlow';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { useMasterPasswordVerify } from '../hooks/useMasterPasswordVerify';
import { useDoubleClickConfirm } from '../hooks/useDoubleClickConfirm';
import { MasterLockBackdrop } from './MasterLockBackdrop';
import { MasterLockHeader } from './MasterLockHeader';
import { MasterLockRecoveryForm } from './MasterLockRecoveryForm';
import { MasterLockUnlockForm } from './MasterLockUnlockForm';

interface MasterLockProps {
  language: Language;
  theme?: Theme;
  passwordHash: string;
  passwordSalt: string | null;
  onSetLanguage: (language: Language) => void;
  onUnlock: (password: string) => void;
  onResetPassword?: (password: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Currently unused at this surface — kept on the API for consumers
   *  that wire MasterLock straight into a "wipe & reset" affordance. */
  onWipeData?: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30_000;

/**
 * The fullscreen master-password gate. Phase 2 §2.i broke the original
 * 724-LOC monolith into:
 *
 *   - `useLockoutTimer` — failed-attempts ladder + 30 s lockout window
 *   - `useRecoveryFlow` — recovery key + new + confirm validation
 *   - `useBiometricAuth` — WebAuthn probe + scan ceremony
 *   - `useMasterPasswordVerify` — debounced auto-verify + Enter-key path
 *   - `useDoubleClickConfirm` — anti-misclick cancel button
 *   - `MasterLockBackdrop` — fullscreen starfield (already extracted)
 *   - `MasterLockCardChrome` — corner ripples + paper grain + glow
 *   - `MasterLockHeader` — recovery-back + cancel-confirm
 *   - `MasterLockRecoveryForm` — recovery-key entry surface
 *   - `MasterLockUnlockForm` — unlock-screen surface
 *
 * This file now only owns the modal frame + composition wiring.
 */
export const MasterLock: React.FC<MasterLockProps> = ({
  language,
  theme = 'dark',
  passwordHash,
  passwordSalt,
  onSetLanguage,
  onUnlock,
  onResetPassword,
  onCancel,
}) => {
  const t = TRANSLATIONS[language];
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const lockout = useLockoutTimer({
    maxAttempts: MAX_ATTEMPTS,
    lockoutDurationMs: LOCKOUT_DURATION_MS,
  });
  const recovery = useRecoveryFlow({ language, t, onResetPassword, onUnlock });

  const biometric = useBiometricAuth({
    restrictedMessage: t.biometricRestricted || 'Environment Restricted',
    postSuccessHint:
      language === 'zh'
        ? '生物识别仅确认本人，仍需密令解锁数据'
        : 'Biometrics verified, but password still required for decryption',
    disabled: lockout.isLocked,
  });

  const verify = useMasterPasswordVerify({
    passwordHash,
    passwordSalt,
    disabled: lockout.isLocked || biometric.isScanning,
    onUnlock,
    onEnterFailure: lockout.registerFailure,
    enterUnlockDelayMs: isMobileExperience() ? 0 : undefined,
  });

  const cancelConfirm = useDoubleClickConfirm({
    onConfirm: () => onCancel?.(),
  });

  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  // Mute the biometric availability flag for now — the UI affordance
  // for it is still in flight (Phase 2 §2.k follow-up). The hook
  // itself is wired and tested.
  void biometric.available;
  void biometric.authenticate;

  return (
    <div
      className="master-lock-screen master-lock-refined fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4 md:p-8"
    >
      <MasterLockBackdrop theme={theme} />

      <div className="master-lock-frame relative z-10 my-auto w-full max-w-[560px]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={
            verify.isSuccess
              ? { opacity: 0, y: -4, scale: 0.985 }
              : { opacity: 1, scale: 1, y: 0 }
          }
          transition={
            { duration: 0.28, ease: 'easeOut' }
          }
          className={`master-lock-card relative min-h-0 w-full ${verify.isSuccess ? 'pointer-events-none' : ''}`}
        >
          <div className="master-lock-toolbar">
          <MasterLockHeader
            theme={theme}
            language={language}
            t={t}
            isRecoveryMode={recovery.isRecoveryMode}
            onBackFromRecovery={() => recovery.setIsRecoveryMode(false)}
            onCancel={onCancel}
            isConfirmingCancel={cancelConfirm.isConfirming}
            onCancelClick={cancelConfirm.trigger}
          />
          <div className="master-lock-language relative z-50">
            <button
              type="button"
              onClick={() => setShowLanguageMenu((prev) => !prev)}
              aria-expanded={showLanguageMenu}
              aria-label={language === 'zh' ? '选择语言' : 'Select language'}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-raised)] px-3 text-xs text-[var(--ds-text-muted)] transition-colors hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-hover)] hover:text-[var(--ds-text)]"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{language === 'zh' ? '中文' : language.toUpperCase()}</span>
            </button>

            {showLanguageMenu && (
              <div
                className="absolute right-0 mt-2 w-36 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-1 text-xs shadow-[var(--ds-shadow-float)]"
              >
                {(Object.keys(NATIVE_LANG_NAMES) as Language[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      onSetLanguage(lang);
                      setShowLanguageMenu(false);
                    }}
                    className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors ${language === lang ? 'bg-[var(--ds-selected)] text-[var(--ds-accent)]' : 'text-[var(--ds-text-muted)] hover:bg-[var(--ds-hover)] hover:text-[var(--ds-text)]'}`}
                  >
                    <span>{NATIVE_LANG_NAMES[lang]}</span>
                    {language === lang && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          </div>

          <div className="master-lock-content flex flex-col items-center text-center space-y-4">
            {recovery.isRecoveryMode ? (
              <MasterLockRecoveryForm theme={theme} t={t} recovery={recovery} />
            ) : (
              <MasterLockUnlockForm
                theme={theme}
                language={language}
                t={t}
                password={verify.password}
                onPasswordChange={verify.setPassword}
                showUnlockPassword={showUnlockPassword}
                onToggleShowPassword={() => setShowUnlockPassword((prev) => !prev)}
                isSuccess={verify.isSuccess}
                isRitualActive={verify.isRitualActive}
                error={verify.error}
                isDecrypting={verify.isVerifying}
                lockout={{
                  isLocked: lockout.isLocked,
                  secondsRemaining: lockout.secondsRemaining,
                }}
                isScanning={biometric.isScanning}
                biometricError={biometric.error}
                onSubmit={() => void verify.submitNow()}
                onForgotPassword={() => recovery.setIsRecoveryMode(true)}
              />
            )}
          </div>
          {!recovery.isRecoveryMode && (
            <div
              className="master-lock-security pointer-events-none mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-5 text-[var(--ds-text-muted)]"
            >
              <span>{language === 'zh' ? '本地加密存储' : 'Encrypted on this device'}</span>
              <span>{language === 'zh' ? '使用 AI 时，相关内容将交由所选模型处理。' : 'When using AI, relevant content is sent to your selected model.'}</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
