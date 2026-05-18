import { useCallback, useState } from 'react';
import { SecurityService } from '../services/securityService';
import { useTimeoutManager } from './useTimeoutManager';

export interface UseMasterPasswordVerifyArgs {
  passwordHash: string;
  passwordSalt: string | null;
  /** Disable verification while another flow (lockout, biometric scan,
   *  ritual) owns the surface. */
  disabled?: boolean;
  /** Called once the password has been verified. The parent decides
   *  what "unlocked" means (open Dashboard / decrypt session / etc.). */
  onUnlock: (password: string) => void;
  /** Kept for backward compatibility with older consumers. Explicit
   *  submit is now the only verification path. */
  onAutoFailure?: () => void;
  /** Called whenever the Enter-key path consumes a failure attempt. */
  onEnterFailure?: () => void;
  /** Override `SecurityService.verifyPassword` for tests. */
  verifyPassword?: (password: string, salt: string, hash: string) => Promise<boolean>;
  /** Time the parent should display the success ritual before the
   *  `onUnlock` callback fires. */
  autoUnlockDelayMs?: number;
  enterUnlockDelayMs?: number;
  /** Kept for backward compatibility. Passwords are no longer verified
   *  while the user is still typing. */
  debounceMs?: number;
  /** Minimum input length before explicit submit can verify. */
  minLength?: number;
}

export interface MasterPasswordVerify {
  password: string;
  setPassword: (value: string) => void;
  /** True the moment a valid password is submitted; stays true
   *  through the ritual delay so the parent can play its animation. */
  isSuccess: boolean;
  /** True while the success ritual is playing (auto-verify path
   *  immediately, Enter-key path immediately too). Mutually exclusive
   *  with `error`. */
  isRitualActive: boolean;
  /** True while a PBKDF2 / Argon2id verification pass is running. */
  isVerifying: boolean;
  /** Transient error flag (auto-clears 2 s after Enter-key failure). */
  error: boolean;
  /** Submit the current `password` synchronously (used by the Enter
   *  key handler). Returns true on success, false otherwise. */
  submitNow: () => Promise<boolean>;
  /** Imperative reset (the parent calls this on cancel / route-away). */
  reset: () => void;
}

/**
 * Owns MasterLock's "user submits password → we hash + verify → unlock
 * after a brief ritual" workflow:
 *
 *   - Verifies only on explicit user intent: click "connect" or press Enter.
 *   - Counts failures via the parent-supplied callback (so the
 *     lockout timer stays decoupled from the verifier).
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i.
 */
export const useMasterPasswordVerify = ({
  passwordHash,
  passwordSalt,
  disabled = false,
  onUnlock,
  onEnterFailure,
  verifyPassword = SecurityService.verifyPassword.bind(SecurityService),
  enterUnlockDelayMs = 500,
  minLength = 4,
}: UseMasterPasswordVerifyArgs): MasterPasswordVerify => {
  const { scheduleTimeout } = useTimeoutManager();
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRitualActive, setIsRitualActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(false);

  const reset = useCallback(() => {
    setPassword('');
    setIsSuccess(false);
    setIsRitualActive(false);
    setIsVerifying(false);
    setError(false);
  }, []);

  const submitNow = useCallback(async (): Promise<boolean> => {
    if (password.length < minLength || isRitualActive || isVerifying || disabled || isSuccess) {
      return false;
    }
    try {
      setError(false);
      setIsVerifying(true);
      const ok = await verifyPassword(password, passwordSalt || '', passwordHash);
      if (ok) {
        setIsRitualActive(true);
        setIsSuccess(true);
        scheduleTimeout(() => onUnlock(password), enterUnlockDelayMs);
        return true;
      }
      setError(true);
      onEnterFailure?.();
      scheduleTimeout(() => setError(false), 2000);
      return false;
    } catch (err) {
      console.error('MasterLock Enter-key verify error:', err);
      setError(true);
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [
    disabled,
    enterUnlockDelayMs,
    isRitualActive,
    isVerifying,
    isSuccess,
    minLength,
    onEnterFailure,
    onUnlock,
    password,
    passwordHash,
    passwordSalt,
    scheduleTimeout,
    verifyPassword,
  ]);

  return {
    password,
    setPassword,
    isSuccess,
    isRitualActive,
    isVerifying,
    error,
    submitNow,
    reset,
  };
};
