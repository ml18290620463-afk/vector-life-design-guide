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
    expect(result.current.error).toBe(false);
  });

  it('does not trigger auto-verify until password length >= minLength', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(baseArgs({ verifyPassword, minLength: 4 })),
    );
    act(() => result.current.setPassword('ab'));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('auto-verify path fires onUnlock after the debounce + ritual delay', async () => {
    const onUnlock = vi.fn();
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMasterPasswordVerify(
        baseArgs({
          onUnlock,
          verifyPassword,
          debounceMs: 100,
          autoUnlockDelayMs: 50,
        }),
      ),
    );
    act(() => result.current.setPassword('correct'));
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(verifyPassword).toHaveBeenCalledWith('correct', 's', 'h');
    expect(result.current.isRitualActive).toBe(true);
    expect(result.current.isSuccess).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(60);
    });
    expect(onUnlock).toHaveBeenCalledWith('correct');
  });

  it('auto-verify path does NOT register a failure (user might still be typing)', async () => {
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
    expect(verifyPassword).toHaveBeenCalled();
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

  it('disabled=true short-circuits both paths', async () => {
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
