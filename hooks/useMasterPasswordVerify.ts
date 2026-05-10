import { useCallback, useEffect, useState } from 'react';
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
  /** Called whenever the auto-verify path consumes a failure attempt
   *  (the parent's lockout timer typically counts these). The hook
   *  itself never registers a failure on the auto-verify path —
   *  see comment below. */
  onAutoFailure?: () => void;
  /** Called whenever the Enter-key path consumes a failure attempt. */
  onEnterFailure?: () => void;
  /** Override `SecurityService.verifyPassword` for tests. */
  verifyPassword?: (password: string, salt: string, hash: string) => Promise<boolean>;
  /** Time the parent should display the success ritual before the
   *  `onUnlock` callback fires. Defaults to 800 ms (auto-verify) /
   *  500 ms (Enter key) — the original MasterLock UX. */
  autoUnlockDelayMs?: number;
  enterUnlockDelayMs?: number;
  /** Debounce for the auto-verify path so we don't hash on every
   *  keystroke. Defaults to 300 ms. */
  debounceMs?: number;
  /** Minimum input length before auto-verify even tries. */
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
  /** Transient error flag (auto-clears 2 s after Enter-key failure). */
  error: boolean;
  /** Submit the current `password` synchronously (used by the Enter
   *  key handler). Returns true on success, false otherwise. */
  submitNow: () => Promise<boolean>;
  /** Imperative reset (the parent calls this on cancel / route-away). */
  reset: () => void;
}

/**
 * Owns MasterLock's "user types password → we hash + verify → unlock
 * after a brief ritual" workflow:
 *
 *   - Auto-verifies on a 300 ms debounce so the user doesn't have to
 *     hit Enter (mirrors the original MasterLock UX).
 *   - Counts failures via the parent-supplied callbacks (so the
 *     lockout timer stays decoupled from the verifier).
 *   - Does NOT register a failure on the auto-verify path — the user
 *     might still be typing. Only the Enter-key path counts.
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
  autoUnlockDelayMs = 800,
  enterUnlockDelayMs = 500,
  debounceMs = 300,
  minLength = 4,
}: UseMasterPasswordVerifyArgs): MasterPasswordVerify => {
  const { scheduleTimeout } = useTimeoutManager();
  const [password, setPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRitualActive, setIsRitualActive] = useState(false);
  const [error, setError] = useState(false);

  const reset = useCallback(() => {
    setPassword('');
    setIsSuccess(false);
    setIsRitualActive(false);
    setError(false);
  }, []);

  // Auto-verify on debounce. Only the Enter-key path counts failures —
  // the auto path is "best effort" and the user might still be typing.
  useEffect(() => {
    if (password.length < minLength || isRitualActive || disabled || isSuccess) return;

    const timeout = setTimeout(async () => {
      try {
        const ok = await verifyPassword(password, passwordSalt || '', passwordHash);
        if (ok) {
          setIsRitualActive(true);
          setError(false);
          setIsSuccess(true);
          scheduleTimeout(() => onUnlock(password), autoUnlockDelayMs);
        }
      } catch (e) {
        console.error('MasterLock auto-verify error:', e);
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [
    autoUnlockDelayMs,
    debounceMs,
    disabled,
    isRitualActive,
    isSuccess,
    minLength,
    onUnlock,
    password,
    passwordHash,
    passwordSalt,
    scheduleTimeout,
    verifyPassword,
  ]);

  const submitNow = useCallback(async (): Promise<boolean> => {
    if (password.length < minLength || isRitualActive || disabled || isSuccess) {
      return false;
    }
    try {
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
    }
  }, [
    disabled,
    enterUnlockDelayMs,
    isRitualActive,
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
    error,
    submitNow,
    reset,
  };
};
