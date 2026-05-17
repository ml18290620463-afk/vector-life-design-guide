import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Globe } from 'lucide-react';
import { Language, Theme } from '../types';
import { NATIVE_LANG_NAMES, TRANSLATIONS } from '../constants';
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
  onSetLanguage: (language: Language) => void;
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

      <div className="relative z-10 my-auto w-full max-w-[760px] perspective-[3000px] transition-all duration-500">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-10 opacity-80 blur-2xl [border-radius:37%_63%_48%_52%/12%_18%_82%_88%] ${
            theme === 'light'
              ? 'bg-cyan-300/14'
              : 'bg-[radial-gradient(circle_at_18%_0%,rgba(126,239,255,0.34),transparent_30%),radial-gradient(circle_at_92%_20%,rgba(123,109,255,0.28),transparent_36%),linear-gradient(135deg,rgba(0,230,255,0.12),rgba(0,0,0,0)_52%)]'
          }`}
        />
        <svg
          aria-hidden="true"
          data-testid="organic-lock-silhouette"
          viewBox="0 0 820 690"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] overflow-visible opacity-85 blur-[0.2px]"
        >
          <defs>
            <linearGradient id="lock-organic-edge" x1="8%" y1="2%" x2="92%" y2="96%">
              <stop offset="0%" stopColor="rgba(190,255,255,0.9)" />
              <stop offset="34%" stopColor="rgba(34,211,238,0.42)" />
              <stop offset="64%" stopColor="rgba(99,102,241,0.36)" />
              <stop offset="100%" stopColor="rgba(103,232,249,0.78)" />
            </linearGradient>
            <filter id="lock-edge-glow" x="-12%" y="-12%" width="124%" height="124%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M78 48C153 14 253 24 327 28C433 33 502 11 598 30C682 47 746 69 779 123C814 178 788 249 795 318C804 403 825 477 775 544C723 613 619 627 520 636C410 646 325 668 226 635C131 603 57 541 39 458C20 375 53 308 41 231C27 149 16 76 78 48Z"
            fill="none"
            stroke="url(#lock-organic-edge)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lock-edge-glow)"
          />
          <path
            d="M108 62C185 37 273 47 359 48C468 50 552 31 653 58C731 79 766 129 774 191"
            fill="none"
            stroke="rgba(190,255,255,0.42)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M68 441C103 549 212 613 346 626C466 638 593 619 707 575"
            fill="none"
            stroke="rgba(34,211,238,0.3)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
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
                  y: 0,
                  rotateY: 0,
                  rotateX: 0,
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
                }
          }
          className={`group relative min-h-[610px] w-full overflow-hidden border p-7 transition-all duration-1000 [border-radius:4.8rem_7.2rem_5.9rem_6.8rem/3.3rem_4.5rem_6.5rem_5.3rem] sm:p-10 ${theme === 'light' ? 'border-cyan-500/10 bg-white/82 shadow-[0_38px_100px_color-mix(in_srgb,_black_16%,_transparent)]' : 'border-cyan-200/10 bg-[radial-gradient(circle_at_16%_12%,rgba(80,255,245,0.14),transparent_24%),linear-gradient(135deg,rgba(0,20,24,0.76),rgba(0,0,0,0.76)_46%,rgba(2,10,24,0.82))] shadow-[0_30px_90px_rgba(0,0,0,0.56),0_0_110px_rgba(0,220,255,0.13),inset_0_1px_0_rgba(190,255,255,0.1),inset_14px_0_60px_rgba(25,255,240,0.065),inset_-16px_-18px_78px_rgba(79,70,229,0.1)]'} ${verify.isSuccess ? 'pointer-events-none' : ''}`}
        >
          <MasterLockCardChrome theme={theme} />
          <div className="absolute right-7 top-7 z-50 font-mono uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setShowLanguageMenu((prev) => !prev)}
              aria-expanded={showLanguageMenu}
              aria-label={language === 'zh' ? '选择语言' : 'Select language'}
              className={`flex items-center gap-2 px-3 py-2 text-[9px] backdrop-blur-md transition-all ${
                theme === 'light'
                  ? 'bg-white/42 text-cyan-700 hover:bg-white/62 hover:text-cyan-900'
                  : 'bg-black/16 text-cyan-300/85 hover:bg-black/28 hover:text-cyan-100'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{language.toUpperCase()}</span>
            </button>

            {showLanguageMenu && (
              <div
                className={`absolute right-0 mt-2 w-32 border p-1 text-[9px] shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-md ${
                  theme === 'light'
                    ? 'border-cyan-500/20 bg-white/90 text-cyan-700'
                    : 'border-cyan-500/25 bg-black/72 text-cyan-500'
                }`}
              >
                {(Object.keys(NATIVE_LANG_NAMES) as Language[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      onSetLanguage(lang);
                      setShowLanguageMenu(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-2 py-2 text-left transition-all ${
                      language === lang
                        ? theme === 'light'
                          ? 'bg-cyan-500/12 text-cyan-700'
                          : 'bg-cyan-400/16 text-cyan-100'
                        : theme === 'light'
                          ? 'text-slate-500 hover:bg-cyan-500/8 hover:text-cyan-700'
                          : 'text-cyan-700 hover:bg-cyan-400/8 hover:text-cyan-200'
                    }`}
                  >
                    <span>{NATIVE_LANG_NAMES[lang]}</span>
                    {language === lang && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

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
