import { useCallback, useEffect, useRef, useState } from 'react';

export interface LockoutTimerOptions {
  /** Hard cap before lockout kicks in. Default: 5. */
  maxAttempts?: number;
  /** Lockout window in milliseconds. Default: 30_000 (30s). */
  lockoutDurationMs?: number;
}

export interface LockoutTimerState {
  failedAttempts: number;
  /** True while the user must wait before retrying. */
  isLocked: boolean;
  /**
   * Seconds remaining in the lockout window, updated once per second so
   * the UI can render a "wait Ns" badge. Always 0 when not locked.
   */
  secondsRemaining: number;
  /**
   * Record one failed attempt. When `failedAttempts + 1 >= maxAttempts`,
   * arms the lockout window and returns `lockedOutNow: true` so the
   * caller can switch its messaging to "too many attempts".
   */
  registerFailure: () => { failedAttempts: number; lockedOutNow: boolean };
  /** Reset both counter and timer; call on a successful unlock or recovery. */
  reset: () => void;
}

/**
 * Throttles unlock attempts with a per-second countdown.
 *
 * Differs from `useViewerLockout` in two ways that matter for the
 * MasterLock UX:
 *
 *  1. Exposes `secondsRemaining`, ticking once per second via
 *     `setInterval`, so the badge can show "(15s)" without the caller
 *     wiring its own timer.
 *  2. Once the lockout window elapses we *also* reset `failedAttempts`
 *     to zero, giving the user a fresh budget. The Viewer variant only
 *     resets on explicit success because it surfaces the cumulative
 *     count separately.
 *
 * The `useRef` mirror of the counter keeps a synchronous chain of
 * `registerFailure()` calls deterministic even under React 18 strict
 * mode, where setState updaters may run more than once.
 */
export const useLockoutTimer = (options: LockoutTimerOptions = {}): LockoutTimerState => {
  const maxAttempts = options.maxAttempts ?? 5;
  const lockoutDurationMs = options.lockoutDurationMs ?? 30_000;

  const failedRef = useRef(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

  useEffect(() => {
    if (lockoutUntil === null) {
      setSecondsRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setLockoutUntil(null);
        failedRef.current = 0;
        setFailedAttempts(0);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockoutUntil]);

  const registerFailure = useCallback((): {
    failedAttempts: number;
    lockedOutNow: boolean;
  } => {
    const next = failedRef.current + 1;
    failedRef.current = next;
    setFailedAttempts(next);
    const lockedOutNow = next >= maxAttempts;
    if (lockedOutNow) {
      setLockoutUntil(Date.now() + lockoutDurationMs);
    }
    return { failedAttempts: next, lockedOutNow };
  }, [maxAttempts, lockoutDurationMs]);

  const reset = useCallback(() => {
    failedRef.current = 0;
    setFailedAttempts(0);
    setLockoutUntil(null);
    setSecondsRemaining(0);
  }, []);

  return {
    failedAttempts,
    isLocked,
    secondsRemaining,
    registerFailure,
    reset,
  };
};
