import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRecoveryFlow } from './useRecoveryFlow';
import { AppStorageKeys } from '../services/appSettings';
import { SecurityService } from '../services/securityService';
import type { TranslationDictionary } from '../i18n/translations';

// A 32-char recovery key (no dashes), matching the format users actually
// paste in. The flow normalises to upper-case before hashing so we feed
// the upper variant directly.
const VALID_RECOVERY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
const VALID_PASSWORD = 'StrongP@ss1';

const baseT = {
  passwordRequirement: 'Password requirement',
  passwordMismatch: 'Password mismatch',
} as unknown as TranslationDictionary;

describe('useRecoveryFlow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes initial empty state with recovery mode off', () => {
    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn() }),
    );

    expect(result.current.isRecoveryMode).toBe(false);
    expect(result.current.recoveryInput).toBe('');
    expect(result.current.newPassword).toBe('');
    expect(result.current.resetError).toBeNull();
    expect(result.current.showKey).toBe(false);
    expect(result.current.showNewPassword).toBe(false);
  });

  it('toggleShowKey / toggleShowNewPassword flip the booleans', () => {
    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn() }),
    );

    act(() => result.current.toggleShowKey());
    act(() => result.current.toggleShowNewPassword());
    expect(result.current.showKey).toBe(true);
    expect(result.current.showNewPassword).toBe(true);
  });

  it('rejects an unknown recovery key with a localised error', async () => {
    // Stored verifier doesn't match what the user types.
    localStorage.setItem(
      AppStorageKeys.recoveryVerifier,
      await SecurityService.hashRecoveryKey('OTHERKEYOTHERKEYOTHERKEYOTHERKEY'),
    );

    const onReset = vi.fn();
    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn(), onResetPassword: onReset }),
    );

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword(VALID_PASSWORD));
    act(() => result.current.setConfirmNewPassword(VALID_PASSWORD));
    await act(async () => {
      await result.current.submitRecovery();
    });

    expect(result.current.resetError).toBe('Emergency Anchor verification failed');
    expect(onReset).not.toHaveBeenCalled();
  });

  it('rejects a weak new password even when the recovery key matches', async () => {
    localStorage.setItem(
      AppStorageKeys.recoveryVerifier,
      await SecurityService.hashRecoveryKey(VALID_RECOVERY),
    );

    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn() }),
    );

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword('weak'));
    act(() => result.current.setConfirmNewPassword('weak'));
    await act(async () => {
      await result.current.submitRecovery();
    });

    expect(result.current.resetError).toBe('Password requirement');
  });

  it('rejects when new and confirm passwords differ', async () => {
    localStorage.setItem(
      AppStorageKeys.recoveryVerifier,
      await SecurityService.hashRecoveryKey(VALID_RECOVERY),
    );

    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn() }),
    );

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword(VALID_PASSWORD));
    act(() => result.current.setConfirmNewPassword('OtherP@ss2'));
    await act(async () => {
      await result.current.submitRecovery();
    });

    expect(result.current.resetError).toBe('Password mismatch');
  });

  it('calls onResetPassword with the new password on full success', async () => {
    localStorage.setItem(
      AppStorageKeys.recoveryVerifier,
      await SecurityService.hashRecoveryKey(VALID_RECOVERY),
    );

    const onReset = vi.fn();
    const onUnlock = vi.fn();
    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock, onResetPassword: onReset }),
    );

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword(VALID_PASSWORD));
    act(() => result.current.setConfirmNewPassword(VALID_PASSWORD));
    await act(async () => {
      await result.current.submitRecovery();
    });

    expect(result.current.resetError).toBeNull();
    expect(onReset).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('falls back to onUnlock when onResetPassword is not supplied', async () => {
    localStorage.setItem(
      AppStorageKeys.recoveryVerifier,
      await SecurityService.hashRecoveryKey(VALID_RECOVERY),
    );

    const onUnlock = vi.fn();
    const { result } = renderHook(() => useRecoveryFlow({ language: 'en', t: baseT, onUnlock }));

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword(VALID_PASSWORD));
    act(() => result.current.setConfirmNewPassword(VALID_PASSWORD));
    await act(async () => {
      await result.current.submitRecovery();
    });

    expect(onUnlock).toHaveBeenCalledWith(VALID_PASSWORD);
  });

  it('upgrades a legacy plain-text verifier to a hash on first successful use', async () => {
    // Simulate a pre-Phase-1 user whose recoveryVerifier is still the
    // raw key in storage (no `recovery-sha256:v1:` prefix).
    localStorage.setItem(AppStorageKeys.recoveryVerifier, VALID_RECOVERY);

    const { result } = renderHook(() =>
      useRecoveryFlow({ language: 'en', t: baseT, onUnlock: vi.fn() }),
    );

    act(() => result.current.setRecoveryInput(VALID_RECOVERY));
    act(() => result.current.setNewPassword(VALID_PASSWORD));
    act(() => result.current.setConfirmNewPassword(VALID_PASSWORD));
    await act(async () => {
      await result.current.submitRecovery();
    });

    const stored = localStorage.getItem(AppStorageKeys.recoveryVerifier);
    expect(stored?.startsWith('recovery-sha256:v1:')).toBe(true);
    expect(result.current.resetError).toBeNull();
  });
});
