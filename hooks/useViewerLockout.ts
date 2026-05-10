import { useCallback, useRef, useState } from 'react';
import { useTimeoutManager } from './useTimeoutManager';

export interface ViewerLockoutOptions {
  /** Hard cap before lockout kicks in. Default: 5. */
  maxAttempts?: number;
  /** Lockout window in milliseconds. Default: 30_000 (30s). */
  lockoutDurationMs?: number;
}

export interface ViewerLockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
  /** True while the user must wait before retrying. */
  isLockedOut: boolean;
  /**
   * Record one failed attempt. When `failedAttempts + 1 >= maxAttempts`,
   * the lockout is armed and `lockedOutNow` is returned `true` so the
   * caller can render the proper "too many attempts" message.
   */
  registerFailure: () => { failedAttempts: number; lockedOutNow: boolean };
  /** Reset both counters; call this on a successful unlock. */
  resetAttempts: () => void;
}

/**
 * Encapsulates the "N failed attempts → lock for M seconds" logic that
 * was inlined in `Viewer.tsx`. Extracted as a hook so we can unit-test
 * the lock window deterministically (with vitest fake timers) and so
 * sibling features (Editor, MasterLock) can adopt the same semantics
 * without copy-pasting the failure ladder.
 *
 * Implementation note: we keep an internal `useRef` mirror of the
 * counter so a synchronous chain of `registerFailure()` calls works
 * deterministically — React 18 may invoke `setState` updaters more than
 * once in StrictMode and they cannot be relied on as a synchronous read
 * channel.
 */
export const useViewerLockout = (options: ViewerLockoutOptions = {}): ViewerLockoutState => {
  const maxAttempts = options.maxAttempts ?? 5;
  const lockoutDurationMs = options.lockoutDurationMs ?? 30_000;

  const { scheduleTimeout } = useTimeoutManager();
  const failedRef = useRef(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const registerFailure = useCallback((): { failedAttempts: number; lockedOutNow: boolean } => {
    const next = failedRef.current + 1;
    failedRef.current = next;
    setFailedAttempts(next);
    const lockedOutNow = next >= maxAttempts;
    if (lockedOutNow) {
      const until = Date.now() + lockoutDurationMs;
      setLockoutUntil(until);
      scheduleTimeout(() => setLockoutUntil(null), lockoutDurationMs);
    }
    return { failedAttempts: next, lockedOutNow };
  }, [lockoutDurationMs, maxAttempts, scheduleTimeout]);

  const resetAttempts = useCallback(() => {
    failedRef.current = 0;
    setFailedAttempts(0);
    setLockoutUntil(null);
  }, []);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  return {
    failedAttempts,
    lockoutUntil,
    isLockedOut,
    registerFailure,
    resetAttempts,
  };
};
