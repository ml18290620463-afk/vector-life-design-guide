import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMasterPasswordVerify } from './useMasterPasswordVerify';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const baseArgs = (overrides: Partial<Parameters<typeof useMasterPasswordVerify>[0]> = {}) => ({
  passwordHash: 'h',
  passwordSalt: 's',
  onUnlock: vi.fn(),
  verifyPassword: vi.fn().mockResolvedValue(false),
  ...overrides,
});

describe('useMasterPasswordVerify', () => {
  it('starts in the idle state', () => {
    const { result } = renderHook(() => useMasterPasswordVerify(baseArgs()));
    expect(result.current.password).toBe('');
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isRitualActive).toBe(false);
    expect(result.current.isVerifying).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('does not verify while the user is still typing', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ verifyPassword, minLength: 4 })),
    );
    act(() => result.current.setPassword('correct'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('does not register a failure while the user is still typing', async () => {
    const onEnterFailure = vi.fn();
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ verifyPassword, onEnterFailure, debounceMs: 50 })),
    );
    act(() => result.current.setPassword('wrong'));
    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(onEnterFailure).not.toHaveBeenCalled();
    expect(result.current.error).toBe(false);
  });

  it('Enter-key submitNow() registers a failure on a wrong password and flashes the error', async () => {
    const onEnterFailure = vi.fn();
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ verifyPassword, onEnterFailure })),
    );
    act(() => result.current.setPassword('wrong'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitNow();
    });
    expect(ok).toBe(false);
    expect(onEnterFailure).toHaveBeenCalled();
    expect(result.current.error).toBe(true);
    // Auto-clears after 2 s.
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.error).toBe(false);
  });

  it('exposes isVerifying while submitNow() is waiting on password verification', async () => {
    let resolveVerify: (ok: boolean) => void = () => {};
    const verifyPassword = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveVerify = resolve;
        }),
    );
    const { result } = renderHook(() => useMasterPasswordVerify(baseArgs({ verifyPassword })));
    act(() => result.current.setPassword('correct'));

    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.submitNow();
    });
    expect(result.current.isVerifying).toBe(true);

    await act(async () => {
      resolveVerify(false);
      await pending;
    });
    expect(result.current.isVerifying).toBe(false);
  });

  it('Enter-key submitNow() on a correct password unlocks after the enterUnlockDelay', async () => {
    const onUnlock = vi.fn();
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ onUnlock, verifyPassword, enterUnlockDelayMs: 100 })),
    );
    act(() => result.current.setPassword('correct'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitNow();
    });
    expect(ok).toBe(true);
    expect(result.current.isRitualActive).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    expect(onUnlock).toHaveBeenCalledWith('correct');
  });

  it('disabled=true short-circuits explicit submit', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ verifyPassword, disabled: true })),
    );
    act(() => result.current.setPassword('correct'));
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitNow();
    });
    expect(ok).toBe(false);
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});
