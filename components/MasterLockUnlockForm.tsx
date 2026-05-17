import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Fingerprint, ShieldCheck, Terminal } from 'lucide-react';
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
const LOGIN_MEMORY_PROMPT = '有些记忆，等你想起。';

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
  const [typedQuote, setTypedQuote] = useState('');
  const inputDisabled =
    isRitualActive || isDecrypting || lockout.isLocked || isScanning || isSuccess;
  const forgotPasswordLabel =
    language === 'zh' ? '忘记密码？使用私钥进入' : 'Forgot password? Use private key';
  const accessLetterCopy =
    language === 'zh'
      ? {
          command: '通行密令',
          submit: '接入',
        }
      : {
          command: 'ACCESS CODE',
          submit: 'CONNECT',
        };

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

  useEffect(() => {
    setTypedQuote('');
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setTypedQuote(LOGIN_MEMORY_PROMPT);
      return;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedQuote(LOGIN_MEMORY_PROMPT.slice(0, index));
      if (index >= LOGIN_MEMORY_PROMPT.length) {
        window.clearInterval(timer);
      }
    }, 82);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className="flex min-h-[400px] w-full flex-col justify-start gap-7 pt-12 font-mono text-cyan-300 md:pt-14">
        <div className="mx-auto w-full max-w-[560px] space-y-6 text-center">
          <div className="space-y-7">
            <div
              className={`flex items-center justify-center gap-5 text-base font-bold uppercase tracking-[0.52em] md:text-lg ${theme === 'light' ? 'text-slate-500' : 'text-cyan-300/86'}`}
            >
              <span className="h-px w-20 bg-cyan-500/30" />
              <span>{accessLetterCopy.command}</span>
              <span className="h-px w-20 bg-cyan-500/30" />
            </div>
            <div className="relative mx-auto h-16 w-full max-w-[460px]">
              <motion.div
                aria-hidden="true"
                animate={{
                  opacity: [0.38, 0.72, 0.38],
                  x: [-8, 8, -8],
                }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute -inset-x-5 -inset-y-3 rounded-[999px] bg-[radial-gradient(circle_at_16%_45%,rgba(125,249,255,0.14),transparent_30%),radial-gradient(circle_at_82%_50%,rgba(99,102,241,0.1),transparent_36%),linear-gradient(100deg,transparent,rgba(34,211,238,0.075),transparent)] blur-md"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 460 64"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id="access-code-edge" x1="0%" y1="35%" x2="100%" y2="65%">
                    <stop offset="0%" stopColor="rgba(190,255,255,0.08)" />
                    <stop offset="18%" stopColor="rgba(103,232,249,0.38)" />
                    <stop offset="52%" stopColor="rgba(125,249,255,0.13)" />
                    <stop offset="88%" stopColor="rgba(103,232,249,0.34)" />
                    <stop offset="100%" stopColor="rgba(190,255,255,0.06)" />
                  </linearGradient>
                  <filter id="access-code-glow" x="-8%" y="-40%" width="116%" height="180%">
                    <feGaussianBlur stdDeviation="2.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d="M31 34C48 9 122 5 209 10C303 16 407 6 435 29C458 48 424 62 331 59C246 57 179 66 96 57C31 50 12 44 31 34Z"
                  fill="rgba(0,18,22,0.22)"
                  stroke="url(#access-code-edge)"
                  strokeWidth="1.4"
                  filter="url(#access-code-glow)"
                />
                <path
                  d="M62 28C139 15 288 15 392 26"
                  fill="none"
                  stroke="rgba(190,255,255,0.16)"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M76 40C151 53 296 51 386 38"
                  fill="none"
                  stroke="rgba(103,232,249,0.34)"
                  strokeLinecap="round"
                  strokeWidth="1.1"
                  initial={{ pathLength: 0.2, opacity: 0.16 }}
                  animate={{ pathLength: [0.2, 0.88, 0.2], opacity: [0.14, 0.48, 0.14] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </svg>
              <input
                autoFocus
                type={showUnlockPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
                aria-label={t.enterMasterPassword ?? t.masterLock}
                data-suppress-focus-ring="true"
                className={`access-code-input relative h-16 w-full appearance-none border-0 bg-transparent pl-10 pr-[4.75rem] text-center text-xl tracking-[0.48em] transition-all focus:outline-none focus:ring-0 focus-visible:outline-none disabled:opacity-35 md:text-2xl ${theme === 'light' ? 'text-slate-900' : 'text-cyan-50'}`}
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
                className={`absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md ${theme === 'light' ? 'border-cyan-500/18 bg-white/48 text-cyan-700' : 'border-cyan-300/20 bg-black/40 text-cyan-300'}`}
                disabled={inputDisabled}
              >
                {showUnlockPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-[520px] text-center text-[15px] font-semibold leading-8 tracking-[0.12em] text-cyan-50/78 md:text-[17px] md:leading-9">
            <p>{typedQuote}</p>
          </div>
          <AnimatePresence>
            {(error || lockout.isLocked || biometricError) && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mx-auto inline-flex border border-vector-magenta/30 bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-vector-magenta"
              >
                {lockout.isLocked
                  ? `${t.tooManyAttempts} (${lockout.secondsRemaining}s)`
                  : biometricError || t.passwordMismatch}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-auto flex w-full max-w-[320px] flex-col items-center gap-3 text-center">
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={inputDisabled || password.length < MIN_PASSWORD_LENGTH}
            aria-label={isSuccess ? t.identityVerified : accessLetterCopy.submit}
            whileHover={inputDisabled ? undefined : { scale: 1.04 }}
            whileTap={inputDisabled ? undefined : { scale: 0.97 }}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full border transition-opacity disabled:cursor-not-allowed disabled:opacity-45 ${theme === 'light' ? 'border-cyan-400/38 bg-white/34 text-cyan-700' : 'border-cyan-300/38 bg-black/22 text-cyan-300 shadow-[0_0_28px_rgba(0,220,255,0.12)]'}`}
          >
            <motion.span
              aria-hidden="true"
              className="absolute -inset-5 rounded-full border border-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
              animate={{ scale: [0.86, 1.14, 0.86], opacity: [0.2, 0.52, 0.2] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute -inset-3 rounded-full border border-dashed border-cyan-500/24"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-1 rounded-full border border-cyan-300/30"
              animate={{ opacity: [0.35, 0.82, 0.35], scale: [1, 1.06, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="absolute inset-3 rounded-full border border-cyan-900/70" />
            {isSuccess ? (
              <ShieldCheck className="h-9 w-9 text-green-300" />
            ) : isDecrypting || isScanning ? (
              <Terminal className="h-9 w-9" />
            ) : (
              <Fingerprint className="h-9 w-9" />
            )}
          </motion.button>
          <div className="space-y-2">
            <div className="text-sm font-bold tracking-[0.45em] text-cyan-400">
              {accessLetterCopy.submit}
            </div>
          </div>
          <button
            onClick={onForgotPassword}
            aria-label={forgotPasswordLabel}
            className={`text-[10px] uppercase tracking-[0.22em] opacity-45 transition-opacity hover:opacity-100 ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
          >
            {forgotPasswordLabel}
          </button>
        </div>
      </div>
    </>
  );
};
