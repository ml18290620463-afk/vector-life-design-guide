import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Fingerprint, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface MasterLockUnlockFormProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Controlled password value. */
  password: string;
  /** Fired on every keystroke; the parent owns the state. */
  onPasswordChange: (value: string) => void;
  /** "Show password" toggle state + handler. */
  showUnlockPassword: boolean;
  onToggleShowPassword: () => void;
  /** Submit action. The component itself decides whether to invoke
   *  this on Enter (length ≥ 4 and not in any locked / ritual / scan
   *  / success state). */
  onSubmit: () => void;
  /** Whether a decryption pass is currently in flight (separate from
   *  the unlock ritual). MasterLock currently always passes false. */
  isDecrypting: boolean;
  /** Whether the WebAuthn ceremony is currently in flight. */
  isScanning: boolean;
  /** Whether the password verified successfully (parent plays the
   *  ritual; we just freeze the input). */
  isSuccess: boolean;
  /** True between successful verify and the parent calling onUnlock. */
  isRitualActive: boolean;
  /** Transient "wrong password" flag. */
  error: boolean;
  /** Inline biometric error (shown in the status badge when present). */
  biometricError: string | null;
  /** Lockout state from `useLockoutTimer`. */
  lockout: { isLocked: boolean; secondsRemaining: number };
  /** Open the recovery branch. */
  onForgotPassword: () => void;
}

const MIN_PASSWORD_LENGTH = 4;

/**
 * MasterLock's primary unlock surface: visual feedback ring,
 * status badge, password input + show/hide toggle, ritual text and
 * the "forgot password" link.
 *
 * Pure presentation; the verification + biometric workflows live in
 * `useMasterPasswordVerify` / `useBiometricAuth` respectively.
 */
export const MasterLockUnlockForm: React.FC<MasterLockUnlockFormProps> = ({
  theme,
  language,
  t,
  password,
  onPasswordChange,
  showUnlockPassword,
  onToggleShowPassword,
  onSubmit,
  isDecrypting,
  isScanning,
  isSuccess,
  isRitualActive,
  error,
  biometricError,
  lockout,
  onForgotPassword,
}) => {
  const inputDisabled =
    isRitualActive || isDecrypting || lockout.isLocked || isScanning || isSuccess;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'Enter' &&
      password.length >= MIN_PASSWORD_LENGTH &&
      !isRitualActive &&
      !lockout.isLocked &&
      !isScanning &&
      !isSuccess
    ) {
      onSubmit();
    }
  };

  return (
    <>
      {/* Visual Feedback Area */}
      <div className="relative">
        <motion.div
          animate={isDecrypting || isScanning ? { rotate: 360 } : {}}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className={`w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center transition-colors duration-500 ${isSuccess ? 'border-green-500 bg-green-500/10' : error || lockout.isLocked ? 'border-vector-magenta bg-vector-magenta/5 neon-border-alert' : theme === 'light' ? 'border-cyan-200' : 'border-white/10'}`}
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <ShieldCheck className="w-10 h-10 text-green-500" />
              </motion.div>
            ) : isScanning ? (
              <motion.div
                key="scanning"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Fingerprint
                  className={`w-10 h-10 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                />
              </motion.div>
            ) : isDecrypting ? (
              <Terminal
                className={`w-10 h-10 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
              />
            ) : (
              <Fingerprint
                className={`w-10 h-10 ${error || lockout.isLocked ? 'text-vector-magenta neon-glow-alert' : theme === 'light' ? 'text-cyan-600' : 'text-slate-500'}`}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Status Badge */}
        <AnimatePresence>
          {(error || lockout.isLocked || biometricError) && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black border border-vector-magenta/30 text-vector-magenta text-[10px] px-3 py-1 font-bold uppercase tracking-[0.2em] whitespace-nowrap shadow-[0_4px_12px_color-mix(in_srgb,_var(--color-vector-magenta)_15%,_transparent)]"
            >
              {lockout.isLocked
                ? `${t.tooManyAttempts} (${lockout.secondsRemaining}s)`
                : biometricError || t.passwordMismatch}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-1">
        <h2
          className={`text-2xl font-mono font-bold tracking-tighter uppercase italic ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
        >
          {isSuccess ? t.identityVerified : t.masterLock}
        </h2>
        <p
          className={`text-xs font-mono leading-relaxed tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-cyan-500/60'}`}
        >
          {lockout.isLocked
            ? 'SECURITY LOCKDOWN ACTIVE'
            : isScanning
              ? t.scanningBiometrics
              : t.enterMasterPassword}
        </p>
      </div>

      <div className="w-full space-y-6">
        <div className="space-y-4">
          <div className="relative group">
            <div className="relative w-full overflow-hidden">
              <AnimatePresence mode="wait">
                {!password && !lockout.isLocked && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none font-mono text-xl tracking-[0.8em] text-cyan-900/50"
                  >
                    ▪ ▪ ▪ ▪ ▪ ▪
                  </motion.div>
                )}
              </AnimatePresence>
              <input
                autoFocus
                type={showUnlockPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
                aria-label={t.enterMasterPassword ?? t.masterLock}
                className={`w-full border-b bg-transparent px-4 py-6 font-mono text-xl text-center tracking-[0.8em] transition-all focus:outline-none disabled:opacity-30 ${theme === 'light' ? 'border-slate-200 text-slate-900 focus:border-cyan-400 placeholder:text-slate-300' : 'border-cyan-900/30 text-cyan-400 focus:border-cyan-500/50 placeholder:text-cyan-900'}`}
                placeholder={lockout.isLocked ? 'LOCKED' : ''}
              />
              <button
                type="button"
                onClick={onToggleShowPassword}
                aria-label={
                  showUnlockPassword
                    ? (t.hidePassword ?? 'Hide password')
                    : (t.showPassword ?? 'Show password')
                }
                aria-pressed={showUnlockPassword}
                className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 ${theme === 'light' ? 'text-slate-300 hover:text-slate-600' : 'text-cyan-900 hover:text-cyan-500'}`}
                disabled={inputDisabled}
              >
                {showUnlockPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Ritual Text Guidance */}
          <div
            className={`py-2 text-center font-mono space-y-1.5 transition-colors duration-1000 ${theme === 'light' ? 'text-slate-400' : 'text-cyan-500'}`}
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs tracking-[0.6em] font-light opacity-80">打开记忆之锁</p>
              <p className="text-xs tracking-[0.6em] font-light opacity-80">推开世界的门</p>
            </div>

            <AnimatePresence>
              {isRitualActive && (
                <motion.div
                  key="ritual-line"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.8, ease: 'linear' }}
                  className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-2"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <button
        onClick={onForgotPassword}
        aria-label={t.forgotPassword}
        className={`text-[10px] font-mono uppercase tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
      >
        {t.forgotPassword}
      </button>

      <div
        className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-400' : 'text-cyan-900'}`}
      >
        <ShieldAlert className="w-3 h-3" />
        {language === 'zh' ? '加密协议 ● 已启动' : 'Encrypted Protocol ● Active'}
      </div>
    </>
  );
};
