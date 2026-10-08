import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBiometricAuth } from './useBiometricAuth';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useBiometricAuth', () => {
  it('starts unavailable, then flips after the probe resolves', async () => {
    const probeAvailable = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'restricted',
        postSuccessHint: 'verified',
        probeAvailable,
      }),
    );
    expect(result.current.available).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(probeAvailable).toHaveBeenCalled();
    expect(result.current.available).toBe(true);
  });

  it('handleBiometricAuth flips isScanning + isSuccess + posts the hint after the delay', async () => {
    const createCredential = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'restricted',
        postSuccessHint: 'verified-hint',
        createCredential,
        postSuccessDelayMs: 100,
      }),
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.authenticate();
    });
    // Mid-scan.
    expect(result.current.isScanning).toBe(true);
    // Resolve the credential ceremony micro-task.
    await act(async () => {
      await pending;
    });
    expect(result.current.isSuccess).toBe(true);
    // Run out the delay → hint surfaces.
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isScanning).toBe(false);
    expect(result.current.error).toBe('verified-hint');
  });

  it('NotAllowedError surfaces the localised "restricted" message', async () => {
    const createCredential = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'env-restricted',
        postSuccessHint: 'verified',
        createCredential,
      }),
    );
    await act(async () => {
      await result.current.authenticate();
    });
    expect(result.current.error).toBe('env-restricted');
    expect(result.current.isScanning).toBe(false);
  });

  it('Other errors surface the Error.message verbatim', async () => {
    const createCredential = vi.fn().mockRejectedValue(new Error('hardware offline'));
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'restricted',
        postSuccessHint: 'verified',
        createCredential,
      }),
    );
    await act(async () => {
      await result.current.authenticate();
    });
    expect(result.current.error).toBe('hardware offline');
  });

  it('disabled=true short-circuits the ceremony entirely', async () => {
    const createCredential = vi.fn();
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'restricted',
        postSuccessHint: 'verified',
        disabled: true,
        createCredential,
      }),
    );
    await act(async () => {
      await result.current.authenticate();
    });
    expect(createCredential).not.toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  });

  it('clearError() wipes the inline error / hint banner', async () => {
    const createCredential = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useBiometricAuth({
        restrictedMessage: 'restricted',
        postSuccessHint: 'verified',
        createCredential,
      }),
    );
    await act(async () => {
      await result.current.authenticate();
    });
    expect(result.current.error).toBe('boom');
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
