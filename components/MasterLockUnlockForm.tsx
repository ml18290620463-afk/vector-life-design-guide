import React from 'react';
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
const LOGIN_MEMORY_PROMPT = '有些记忆  等你想起';

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
  const forgotPasswordLabel =
    language === 'zh' ? '忘记密码 使用通行私钥' : 'Forgot password? Use recovery credential';
  const wrongPasswordLabel =
    language === 'zh' ? '密令未能唤醒这段记忆' : 'Access code could not wake this memory';
  const accessLetterCopy =
    language === 'zh'
      ? {
          command: '通行密令',
          submit: '接入',
          decrypting: '解密中…',
        }
      : {
          command: 'ACCESS CODE',
          submit: 'CONNECT',
          decrypting: 'DECRYPTING...',
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

  return (
    <>
      <div className="master-unlock-form flex min-h-[430px] w-full flex-col justify-start gap-10 pt-7 font-mono text-tech-primary md:gap-12 md:pt-8">
        <div className="master-unlock-panel mx-auto w-full max-w-[620px] space-y-8 text-center md:space-y-9">
          <div className="master-unlock-main space-y-8 md:space-y-9">
            <div
              className={`master-unlock-title-block space-y-3 text-center ${theme === 'light' ? 'text-slate-500' : 'text-tech-primary'}`}
            >
              <div className="master-unlock-title flex items-center justify-center gap-5 text-[16px] font-bold uppercase tracking-[0.34em] md:text-[20px]">
                <span className="h-px w-24 bg-gradient-to-r from-transparent via-tech-primary/62 to-tech-primary/10 shadow-[0_0_16px_color-mix(in_srgb,_var(--color-tech-primary)_18%,_transparent)]" />
                <span
                  className={
                    theme === 'light'
                      ? ''
                      : '[text-shadow:0_0_18px_color-mix(in_srgb,_var(--color-tech-primary)_28%,_transparent)]'
                  }
                >
                  {accessLetterCopy.command}
                </span>
                <span className="h-px w-24 bg-gradient-to-r from-tech-primary/10 via-tech-accent-violet/46 to-transparent shadow-[0_0_16px_color-mix(in_srgb,_var(--color-tech-accent-violet)_7.2%,_transparent)]" />
              </div>
              <div
                className={`master-unlock-subtitle text-[12px] font-semibold tracking-[0.2em] md:text-[13px] ${theme === 'light' ? 'text-slate-600' : 'text-space-text-secondary'}`}
              >
                {LOGIN_MEMORY_PROMPT.split('').map((char, index) => (
                  <motion.span
                    key={`${char}-${index}`}
                    aria-hidden={char === ' '}
                    className={char === ' ' ? 'inline-block w-3' : 'inline-block'}
                    initial={{
                      opacity: 0.08,
                      y: 2,
                      filter: 'blur(4px)',
                    }}
                    animate={{
                      opacity: 0.9,
                      y: 0,
                      filter: 'blur(0px)',
                    }}
                    transition={{
                      delay: index * 0.16,
                      duration: 0.95,
                      ease: 'easeOut',
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="master-password-area space-y-4">
              <div
                className={`master-memory-slot relative mx-auto h-[78px] w-full max-w-[560px] transition-all duration-300 ${
                  error ? 'master-memory-slot--error' : ''
                } ${password.length > 0 ? 'master-memory-slot--active' : ''}`}
              >
                <motion.div
                  aria-hidden="true"
                  animate={{
                    opacity: [0.38, 0.72, 0.38],
                    x: [-8, 8, -8],
                  }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute -inset-x-10 -inset-y-6 rounded-[999px] bg-[radial-gradient(circle_at_16%_45%,color-mix(in_srgb,_var(--color-tech-primary)_28%,_transparent),transparent_32%),radial-gradient(circle_at_82%_50%,color-mix(in_srgb,_var(--color-tech-accent-violet)_9%,_transparent),transparent_38%),linear-gradient(100deg,transparent,color-mix(in_srgb,_var(--color-tech-primary)_14%,_transparent),transparent)] blur-md"
                />
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-tech-primary/42 to-transparent shadow-[0_0_20px_color-mix(in_srgb,_var(--color-tech-primary)_32%,_transparent)]" />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 460 64"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-100 drop-shadow-[0_0_14px_color-mix(in_srgb,_var(--color-tech-primary)_22%,_transparent)]"
                >
                  <defs>
                    <linearGradient id="access-code-edge" x1="0%" y1="35%" x2="100%" y2="65%">
                      <stop
                        offset="0%"
                        stopColor="color-mix(in srgb, var(--color-tech-primary) 18%, transparent)"
                      />
                      <stop
                        offset="18%"
                        stopColor="color-mix(in srgb, var(--color-tech-primary) 72%, transparent)"
                      />
                      <stop
                        offset="54%"
                        stopColor="color-mix(in srgb, var(--color-tech-accent-violet) 13.5%, transparent)"
                      />
                      <stop
                        offset="88%"
                        stopColor="color-mix(in srgb, var(--color-tech-primary) 64%, transparent)"
                      />
                      <stop
                        offset="100%"
                        stopColor="color-mix(in srgb, var(--color-tech-primary) 16%, transparent)"
                      />
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
                    fill={
                      theme === 'light'
                        ? 'color-mix(in srgb, var(--color-tech-primary) 12%, transparent)'
                        : 'var(--color-space-bg)'
                    }
                    stroke="url(#access-code-edge)"
                    strokeWidth="1.9"
                    filter="url(#access-code-glow)"
                  />
                  <path
                    d="M62 28C139 15 288 15 392 26"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-tech-primary) 20%, transparent)"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d="M76 40C151 53 296 51 386 38"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-tech-accent-violet) 12.6%, transparent)"
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
                  className={`access-code-input relative h-[78px] w-full appearance-none border-0 bg-transparent pl-12 pr-[5.25rem] text-center text-[24px] tracking-[0.42em] transition-all focus:outline-none focus:ring-0 focus-visible:outline-none disabled:opacity-45 md:text-[29px] ${theme === 'light' ? 'text-slate-900' : 'text-tech-primary [text-shadow:0_0_18px_color-mix(in_srgb,_var(--color-tech-primary)_34%,_transparent)]'}`}
                  placeholder={lockout.isLocked ? 'LOCKED' : ''}
                />
                <span
                  aria-hidden="true"
                  className="master-memory-slot-line pointer-events-none absolute left-1/2 top-1/2 h-px w-0 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-tech-primary/62 to-tech-accent-violet/28 opacity-0"
                />
                {error && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-300/72 to-rose-400/48"
                    initial={{ x: '-42%', opacity: 0 }}
                    animate={{ x: ['-42%', '0%', '42%'], opacity: [0, 0.78, 0] }}
                    transition={{ duration: 0.62, ease: 'easeOut' }}
                  />
                )}
                <button
                  type="button"
                  onClick={onToggleShowPassword}
                  aria-label={
                    showUnlockPassword
                      ? (t.hidePassword ?? 'Hide password')
                      : (t.showPassword ?? 'Show password')
                  }
                  aria-pressed={showUnlockPassword}
                  className={`absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md transition-all hover:scale-105 ${theme === 'light' ? 'border-tech-primary/18 bg-white/48 text-cyan-700' : 'border-tech-primary/16 bg-space-bg/28 text-tech-primary/72 shadow-[0_0_12px_color-mix(in_srgb,_var(--color-tech-primary)_7%,_transparent),inset_0_0_14px_color-mix(in_srgb,_var(--color-tech-accent-violet)_2.02%,_transparent)] hover:text-tech-primary'}`}
                  disabled={inputDisabled}
                >
                  {showUnlockPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <button
                onClick={onForgotPassword}
                aria-label={forgotPasswordLabel}
                className={`inline-flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.16em] transition-all hover:scale-[1.02] ${theme === 'light' ? 'text-cyan-700 hover:text-cyan-900' : 'text-tech-primary/78 [text-shadow:0_0_12px_color-mix(in_srgb,_var(--color-tech-primary)_16%,_transparent)] hover:text-tech-primary'}`}
              >
                {forgotPasswordLabel}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {(error || lockout.isLocked || biometricError) && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mx-auto inline-flex rounded-full border border-amber-300/24 bg-space-bg/54 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.08)]"
              >
                {lockout.isLocked
                  ? `${t.tooManyAttempts} (${lockout.secondsRemaining}s)`
                  : biometricError || wrongPasswordLabel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="master-connect-area mx-auto flex w-full max-w-[360px] flex-col items-center gap-4 text-center">
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={inputDisabled || password.length < MIN_PASSWORD_LENGTH}
            aria-label={
              isSuccess
                ? t.identityVerified
                : isDecrypting
                  ? accessLetterCopy.decrypting
                  : accessLetterCopy.submit
            }
            whileHover={inputDisabled ? undefined : { scale: 1.04 }}
            whileTap={inputDisabled ? undefined : { scale: 0.97 }}
            animate={
              isSuccess
                ? {
                    scale: [1, 0.88, 1.18, 1],
                    boxShadow: [
                      '0 0 20px color-mix(in srgb, var(--color-tech-primary) 12%, transparent)',
                      '0 0 12px color-mix(in srgb, var(--color-tech-primary) 8%, transparent)',
                      '0 0 58px color-mix(in srgb, var(--color-tech-primary) 50%, transparent)',
                      '0 0 28px color-mix(in srgb, var(--color-tech-primary) 18%, transparent)',
                    ],
                  }
                : undefined
            }
            transition={isSuccess ? { duration: 0.58, ease: 'easeOut' } : undefined}
            className={`master-connect-button relative flex h-[72px] min-w-[212px] items-center justify-center gap-4 rounded-full border px-8 transition-opacity disabled:cursor-not-allowed disabled:opacity-75 ${theme === 'light' ? 'border-tech-primary/38 bg-white/34 text-cyan-700' : 'border-tech-primary/46 bg-[radial-gradient(circle_at_28%_50%,color-mix(in_srgb,_var(--color-tech-primary)_18%,_transparent),color-mix(in_srgb,_var(--color-space-bg)_18%,_transparent)_54%,color-mix(in_srgb,_var(--color-tech-accent-violet)_5.4%,_transparent)),linear-gradient(90deg,color-mix(in_srgb,_var(--color-tech-primary)_10%,_transparent),color-mix(in_srgb,_var(--color-tech-accent-violet)_4.5%,_transparent))] text-tech-primary shadow-[0_0_28px_color-mix(in_srgb,_var(--color-tech-primary)_20%,_transparent),0_0_58px_color-mix(in_srgb,_var(--color-tech-accent-violet)_6.3%,_transparent),inset_0_0_24px_color-mix(in_srgb,_var(--color-tech-primary)_5.5%,_transparent)]'}`}
          >
            <span
              aria-hidden="true"
              className="absolute -inset-4 rounded-full border border-tech-primary/14 shadow-[0_0_24px_color-mix(in_srgb,_var(--color-tech-primary)_16%,_transparent)]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-1 rounded-full border border-tech-primary/34"
            />
            <span className="absolute inset-3 rounded-full border border-cyan-700/40 bg-space-bg/10" />
            <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full border border-tech-primary/28 bg-space-bg/22 shadow-[inset_0_0_18px_color-mix(in_srgb,_var(--color-tech-primary)_6%,_transparent)]">
              {isSuccess ? (
                <ShieldCheck className="h-6 w-6 text-vector-teal-online" />
              ) : isDecrypting ? (
                <motion.span
                  aria-hidden="true"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                >
                  <Fingerprint className="h-6 w-6" />
                </motion.span>
              ) : isScanning ? (
                <Terminal className="h-6 w-6" />
              ) : (
                <Fingerprint className="h-6 w-6" />
              )}
            </span>
            <span className="relative z-10 text-[15px] font-bold tracking-[0.32em] [text-shadow:0_0_16px_color-mix(in_srgb,_var(--color-tech-primary)_28%,_transparent)]">
              {isDecrypting ? accessLetterCopy.decrypting : accessLetterCopy.submit}
            </span>
          </motion.button>
        </div>
      </div>
      <style>{`
        .master-memory-slot--active .master-memory-slot-line,
        .master-memory-slot:focus-within .master-memory-slot-line {
          width: 74%;
          opacity: 0.7;
          transition: width 0.42s ease, opacity 0.42s ease;
        }
        .master-memory-slot--error {
          filter: blur(0.22px) saturate(0.92);
          animation: memory-slot-error-shift 0.42s ease both;
        }
        @keyframes memory-slot-error-shift {
          0%, 100% { transform: translateX(0); }
          24% { transform: translateX(-2px); }
          52% { transform: translateX(2px); }
          78% { transform: translateX(-1px); }
        }
      `}</style>
    </>
  );
};
