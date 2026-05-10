import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardVault } from './useDashboardVault';
import { SecurityService } from '../services/securityService';
import { AppStorageKeys } from '../services/appSettings';
import { setStoredString, removeStoredValue } from '../services/browserStorage';

beforeEach(() => {
  removeStoredValue(AppStorageKeys.vaultUnlocked);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  removeStoredValue(AppStorageKeys.vaultUnlocked);
});

describe('useDashboardVault', () => {
  it('initialises closed when no localStorage flag exists', () => {
    const { result } = renderHook(() =>
      useDashboardVault({
        isUnlocked: true,
        passwordHash: 'h',
        passwordSalt: 's',
        onSetPassword: vi.fn(),
      }),
    );
    expect(result.current.isVaultOpen).toBe(false);
    expect(result.current.isVerifyingVault).toBe(false);
  });

  it('rehydrates open from localStorage only when isUnlocked is also true', () => {
    setStoredString(AppStorageKeys.vaultUnlocked, 'true');
    const { result, rerender } = renderHook(
      ({ unlocked }: { unlocked: boolean }) =>
        useDashboardVault({
          isUnlocked: unlocked,
          passwordHash: 'h',
          passwordSalt: 's',
          onSetPassword: vi.fn(),
        }),
      { initialProps: { unlocked: false } },
    );
    // Stale flag without an in-memory password must not auto-open the vault.
    expect(result.current.isVaultOpen).toBe(false);
    rerender({ unlocked: true });
    // Switching to unlocked does not retroactively open it (we only read the
    // flag at mount); a subsequent toggle should still work though.
    expect(result.current.isVaultOpen).toBe(false);
  });

  it('forces close + flag wipe whenever isUnlocked flips back to false', () => {
    setStoredString(AppStorageKeys.vaultUnlocked, 'true');
    const { result, rerender } = renderHook(
      ({ unlocked }: { unlocked: boolean }) =>
        useDashboardVault({
          isUnlocked: unlocked,
          passwordHash: 'h',
          passwordSalt: 's',
          onSetPassword: vi.fn(),
        }),
      { initialProps: { unlocked: true } },
    );
    expect(result.current.isVaultOpen).toBe(true);
    rerender({ unlocked: false });
    expect(result.current.isVaultOpen).toBe(false);
  });

  it('handleToggleVault opens immediately if already isUnlocked, otherwise shows the prompt', () => {
    const { result, rerender } = renderHook(
      ({ unlocked }: { unlocked: boolean }) =>
        useDashboardVault({
          isUnlocked: unlocked,
          passwordHash: 'h',
          passwordSalt: 's',
          onSetPassword: vi.fn(),
        }),
      { initialProps: { unlocked: true } },
    );
    act(() => result.current.handleToggleVault());
    expect(result.current.isVaultOpen).toBe(true);
    // A second toggle should close it.
    act(() => result.current.handleToggleVault());
    expect(result.current.isVaultOpen).toBe(false);
    // When locked, toggle should pop the verification overlay instead.
    rerender({ unlocked: false });
    act(() => result.current.handleToggleVault());
    expect(result.current.isVerifyingVault).toBe(true);
    expect(result.current.isVaultOpen).toBe(false);
  });

  it('handleVaultUnlock with the correct password opens the vault and promotes the password to the parent', async () => {
    const onSetPassword = vi.fn();
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(true);
    const { result } = renderHook(() =>
      useDashboardVault({
        isUnlocked: false,
        passwordHash: 'h',
        passwordSalt: 's',
        onSetPassword,
      }),
    );
    act(() => result.current.setVaultPassword('correct-horse'));
    await act(async () => {
      await result.current.handleVaultUnlock();
    });
    expect(result.current.isVaultOpen).toBe(true);
    expect(result.current.isVerifyingVault).toBe(false);
    expect(onSetPassword).toHaveBeenCalledWith('correct-horse');
  });

  it('handleVaultUnlock with the wrong password flashes the error and auto-clears after errorFlashMs', async () => {
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(false);
    const { result } = renderHook(() =>
      useDashboardVault({
        isUnlocked: false,
        passwordHash: 'h',
        passwordSalt: 's',
        onSetPassword: vi.fn(),
        errorFlashMs: 500,
      }),
    );
    act(() => result.current.setVaultPassword('nope'));
    await act(async () => {
      await result.current.handleVaultUnlock();
    });
    expect(result.current.vaultError).toBe(true);
    expect(result.current.isVaultOpen).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.vaultError).toBe(false);
  });

  it('handleVaultCancel clears prompt state without changing isVaultOpen', () => {
    const { result } = renderHook(() =>
      useDashboardVault({
        isUnlocked: false,
        passwordHash: 'h',
        passwordSalt: 's',
        onSetPassword: vi.fn(),
      }),
    );
    act(() => result.current.handleToggleVault());
    expect(result.current.isVerifyingVault).toBe(true);
    act(() => result.current.setVaultPassword('typed'));
    act(() => result.current.handleVaultCancel());
    expect(result.current.isVerifyingVault).toBe(false);
    expect(result.current.vaultPassword).toBe('');
    expect(result.current.isVaultOpen).toBe(false);
  });
});
