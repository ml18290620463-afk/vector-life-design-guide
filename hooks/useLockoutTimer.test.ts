import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLockoutTimer } from './useLockoutTimer';

describe('useLockoutTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Note: `vi.advanceTimersByTime` already advances the mocked system
  // clock — calling `vi.setSystemTime` on top would double-advance and
  // break per-tick assertions like `secondsRemaining`.
  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('starts with zero attempts, no lockout, and zero seconds remaining', () => {
    const { result } = renderHook(() => useLockoutTimer());
    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.isLocked).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
  });

  it('counts failures up to but not including the cap without locking', () => {
    const { result } = renderHook(() => useLockoutTimer({ maxAttempts: 5 }));
    for (let i = 1; i <= 4; i += 1) {
      let outcome: { failedAttempts: number; lockedOutNow: boolean } | null = null;
      act(() => {
        outcome = result.current.registerFailure();
      });
      expect(outcome).toEqual({ failedAttempts: i, lockedOutNow: false });
      expect(result.current.isLocked).toBe(false);
    }
  });

  it('arms the lockout exactly at the cap and reports lockedOutNow=true', () => {
    const { result } = renderHook(() =>
      useLockoutTimer({ maxAttempts: 5, lockoutDurationMs: 30_000 }),
    );
    for (let i = 1; i <= 4; i += 1) act(() => void result.current.registerFailure());

    let outcome: { failedAttempts: number; lockedOutNow: boolean } | null = null;
    act(() => {
      outcome = result.current.registerFailure();
    });
    expect(outcome).toEqual({ failedAttempts: 5, lockedOutNow: true });
    expect(result.current.failedAttempts).toBe(5);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.secondsRemaining).toBe(30);
  });

  it('counts secondsRemaining down once per second while locked', () => {
    const { result } = renderHook(() =>
      useLockoutTimer({ maxAttempts: 1, lockoutDurationMs: 5_000 }),
    );
    act(() => void result.current.registerFailure());
    expect(result.current.secondsRemaining).toBe(5);
    advance(1_000);
    expect(result.current.secondsRemaining).toBe(4);
    advance(2_000);
    expect(result.current.secondsRemaining).toBe(2);
  });

  it('clears lockout AND resets attempts when the duration elapses', () => {
    const { result } = renderHook(() =>
      useLockoutTimer({ maxAttempts: 2, lockoutDurationMs: 1_000 }),
    );
    act(() => void result.current.registerFailure());
    act(() => void result.current.registerFailure());
    expect(result.current.isLocked).toBe(true);
    expect(result.current.failedAttempts).toBe(2);

    advance(1_500);
    expect(result.current.isLocked).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
    // Auto-reset gives the user a fresh budget — this is the diff vs
    // useViewerLockout, see hook docstring.
    expect(result.current.failedAttempts).toBe(0);
  });

  it('reset() clears counter and timer state immediately', () => {
    const { result } = renderHook(() =>
      useLockoutTimer({ maxAttempts: 2, lockoutDurationMs: 5_000 }),
    );
    act(() => void result.current.registerFailure());
    act(() => void result.current.registerFailure());
    expect(result.current.isLocked).toBe(true);

    act(() => result.current.reset());
    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.isLocked).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
  });
});
