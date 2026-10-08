import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewerLockout } from './useViewerLockout';

describe('useViewerLockout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => {
    act(() => {
      vi.setSystemTime(new Date(Date.now() + ms));
      vi.advanceTimersByTime(ms);
    });
  };

  it('starts with zero attempts and no lockout', () => {
    const { result } = renderHook(() => useViewerLockout());
    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.lockoutUntil).toBeNull();
    expect(result.current.isLockedOut).toBe(false);
  });

  it('counts failures up to but not including the cap without locking', () => {
    const { result } = renderHook(() => useViewerLockout({ maxAttempts: 5 }));
    for (let i = 1; i <= 4; i += 1) {
      let outcome: { failedAttempts: number; lockedOutNow: boolean } | null = null;
      act(() => {
        outcome = result.current.registerFailure();
      });
      expect(outcome).toEqual({ failedAttempts: i, lockedOutNow: false });
      expect(result.current.lockoutUntil).toBeNull();
    }
  });

  it('arms the lockout exactly at the cap and reports lockedOutNow=true', () => {
    const { result } = renderHook(() =>
      useViewerLockout({ maxAttempts: 5, lockoutDurationMs: 30_000 }),
    );
    for (let i = 1; i <= 4; i += 1) act(() => void result.current.registerFailure());

    let outcome: { failedAttempts: number; lockedOutNow: boolean } | null = null;
    act(() => {
      outcome = result.current.registerFailure();
    });
    expect(outcome).toEqual({ failedAttempts: 5, lockedOutNow: true });
    expect(result.current.failedAttempts).toBe(5);
    expect(result.current.isLockedOut).toBe(true);
    expect(result.current.lockoutUntil).toBe(Date.now() + 30_000);
  });

  it('clears the lockout flag once the duration elapses', () => {
    const { result } = renderHook(() =>
      useViewerLockout({ maxAttempts: 2, lockoutDurationMs: 1_000 }),
    );
    act(() => void result.current.registerFailure());
    act(() => void result.current.registerFailure());
    expect(result.current.isLockedOut).toBe(true);
    advance(1_500);
    expect(result.current.lockoutUntil).toBeNull();
    expect(result.current.isLockedOut).toBe(false);
  });

  it('resetAttempts clears both counter and timer state', () => {
    const { result } = renderHook(() =>
      useViewerLockout({ maxAttempts: 2, lockoutDurationMs: 5_000 }),
    );
    act(() => void result.current.registerFailure());
    act(() => void result.current.registerFailure());
    expect(result.current.isLockedOut).toBe(true);

    act(() => result.current.resetAttempts());
    expect(result.current.failedAttempts).toBe(0);
    expect(result.current.lockoutUntil).toBeNull();
    expect(result.current.isLockedOut).toBe(false);
  });
});
