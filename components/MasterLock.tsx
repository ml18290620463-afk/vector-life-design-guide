import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { useLockoutTimer } from '../hooks/useLockoutTimer';
import { useRecoveryFlow } from '../hooks/useRecoveryFlow';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { useMasterPasswordVerify } from '../hooks/useMasterPasswordVerify';
import { useDoubleClickConfirm } from '../hooks/useDoubleClickConfirm';
import { MasterLockBackdrop } from './MasterLockBackdrop';
import { MasterLockCardChrome } from './MasterLockCardChrome';
import { MasterLockHeader } from './MasterLockHeader';
import { MasterLockRecoveryForm } from './MasterLockRecoveryForm';
import { MasterLockUnlockForm } from './MasterLockUnlockForm';

interface MasterLockProps {
  language: Language;
  theme?: Theme;
  passwordHash: string;
  passwordSalt: string | null;
  onUnlock: (password: string) => void;
  onResetPassword?: (password: string) => void;
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
  onUnlock,
  onResetPassword,
  onCancel,
}) => {
  const t = TRANSLATIONS[language];
  const lockout = useLockoutTimer({
    maxAttempts: MAX_ATTEMPTS,
    lockoutDurationMs: LOCKOUT_DURATION_MS,
  });
  const recovery = useRecoveryFlow({ language, t, onResetPassword, onUnlock });

  const biometric = useBiometricAuth({
    restrictedMessage: t.biometricRestricted || 'Environment Restricted',
    postSuccessHint:
      language === 'zh'
        ? '生物识别仅确认为本人，仍需密码解锁数据'
        : 'Biometrics verified, but password still required for decryption',
    disabled: lockout.isLocked,
  });

  const verify = useMasterPasswordVerify({
    passwordHash,
    passwordSalt,
    disabled: lockout.isLocked || biometric.isScanning,
    onUnlock,
    onEnterFailure: lockout.registerFailure,
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
      className={`fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-10 backdrop-blur-3xl overflow-y-auto transition-colors duration-1000 ${theme === 'light' ? 'bg-neutral-50' : 'bg-vector-onyx'}`}
    >
      <MasterLockBackdrop theme={theme} />

      <div className="relative w-full max-w-[340px] md:max-w-[380px] perspective-[3000px] z-10 transition-all duration-500 my-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          whileHover={{
            x: [0, -0.8, 0.8, -0.8, 0.8, 0],
            y: [0, 0.4, -0.4, 0.4, 0, 0],
            transition: { duration: 0.3 },
          }}
          animate={
            verify.isSuccess
              ? {
                  rotateX: 110,
                  rotateY: [0, 45, -45, 0],
                  z: 800,
                  opacity: 0,
                  scale: [1, 1.8, 2.5],
                  skewX: [0, 40, -40, 0],
                  skewY: [0, -20, 20, 0],
                  filter: ['blur(0px)', 'blur(15px)', 'blur(30px)'],
                }
              : {
                  opacity: 1,
                  scale: 1,
                  y: [0, -10, 0],
                  rotateY: [-1.2, 1.2, -1.2],
                  rotateX: [0.5, -0.5, 0.5],
                }
          }
          transition={
            verify.isSuccess
              ? {
                  duration: 2.2,
                  ease: 'circIn',
                  skewX: { duration: 1.1, repeat: 1 },
                  skewY: { duration: 1.1, repeat: 1 },
                }
              : {
                  opacity: { duration: 0.4 },
                  scale: { duration: 0.4 },
                  y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                  rotateY: { duration: 12, repeat: Infinity, ease: 'easeInOut' },
                  rotateX: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
                }
          }
          className={`relative w-full p-5 sm:p-6 border transition-all duration-1000 group rounded-sm ${theme === 'light' ? 'bg-vector-paper-cream shadow-[0_40px_100px_color-mix(in_srgb,_black_15%,_transparent)] border-slate-200' : 'bg-neutral-950 border border-white/[0.08] shadow-[0_0_100px_color-mix(in_srgb,_var(--color-cyan-500)_10%,_transparent)]'} ${verify.isSuccess ? 'pointer-events-none' : ''}`}
        >
          <MasterLockCardChrome theme={theme} />

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

          <div className="flex flex-col items-center text-center space-y-4">
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
                isDecrypting={false}
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
        </motion.div>
      </div>
    </div>
  );
};
