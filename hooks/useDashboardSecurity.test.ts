import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { useDashboardSecurity } from './useDashboardSecurity';
import { SecurityService } from '../services/securityService';
import type { DiaryEntry } from '../types';
import { AppStorageKeys } from '../services/appSettings';
import { removeStoredValue } from '../services/browserStorage';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

const copy = {
  passwordRequirement: 'weak',
  passwordMismatch: 'mismatch',
  passwordVerifyFailed: 'old-wrong',
  passwordChangeSuccess: 'changed',
  reEncryptFailureWarning: (n: number) => `lose ${n} entries?`,
};

beforeEach(() => {
  removeStoredValue(AppStorageKeys.recoveryVerifier);
});

afterEach(() => {
  vi.restoreAllMocks();
  removeStoredValue(AppStorageKeys.recoveryVerifier);
});

describe('useDashboardSecurity', () => {
  it('rejects a weak new password and never calls onSetPassword', async () => {
    const onSetPassword = vi.fn();
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: null,
        passwordSalt: null,
        entries: [],
        onSetPassword,
        onBulkUpdateEntries: vi.fn(),
        copy,
      }),
    );
    act(() => result.current.setNewPassword('short'));
    act(() => result.current.setConfirmPassword('short'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSecuritySetup();
    });
    expect(ok).toBe(false);
    expect(result.current.securityError).toBe('weak');
    expect(onSetPassword).not.toHaveBeenCalled();
  });

  it('rejects when newPassword !== confirmPassword', async () => {
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: null,
        passwordSalt: null,
        entries: [],
        onSetPassword: vi.fn(),
        onBulkUpdateEntries: vi.fn(),
        copy,
      }),
    );
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Bb'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSecuritySetup();
    });
    expect(ok).toBe(false);
    expect(result.current.securityError).toBe('mismatch');
  });

  it('rejects when changing password but old password fails verification', async () => {
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(false);
    const onSetPassword = vi.fn();
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: 'h',
        passwordSalt: 's',
        entries: [],
        onSetPassword,
        onBulkUpdateEntries: vi.fn(),
        copy,
      }),
    );
    act(() => result.current.setOldPassword('wrong'));
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Aa'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSecuritySetup();
    });
    expect(ok).toBe(false);
    expect(result.current.securityError).toBe('old-wrong');
    expect(onSetPassword).not.toHaveBeenCalled();
  });

  it('first-set (no existing hash) skips verify + bulk update and just promotes the password', async () => {
    const onSetPassword = vi.fn();
    const onBulk = vi.fn();
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: null,
        passwordSalt: null,
        entries: [],
        onSetPassword,
        onBulkUpdateEntries: onBulk,
        copy,
      }),
    );
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Aa'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSecuritySetup();
    });
    expect(ok).toBe(true);
    expect(onSetPassword).toHaveBeenCalledWith('Strong-1!Aa');
    expect(onBulk).not.toHaveBeenCalled();
    expect(result.current.securityMode).toBe('idle');
  });

  it('change-password re-encrypts every encrypted entry and bulk-updates them', async () => {
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(true);
    vi.spyOn(SecurityService, 'decrypt').mockResolvedValue('plain');
    vi.spyOn(SecurityService, 'encrypt').mockResolvedValue('cipher-new');
    vi.spyOn(SecurityService, 'hashRecoveryKey').mockResolvedValue('rk-hash');
    vi.spyOn(SecurityService, 'wipeSensitive').mockImplementation(() => {});
    const entries: DiaryEntry[] = [
      {
        id: 'e1',
        title: 't1',
        content: 'cipher-old-1',
        createdAt: 1,
        tags: [],
        isLocked: false,
        isEncrypted: true,
      },
      {
        id: 'e2',
        title: 't2',
        content: 'plain body',
        createdAt: 2,
        tags: [],
        isLocked: false,
      },
      {
        id: 'e3',
        title: 't3',
        content: 'cipher-old-3',
        createdAt: 3,
        tags: [],
        isLocked: false,
        isEncrypted: true,
      },
    ];
    const onBulk = vi.fn();
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: 'h',
        passwordSalt: 's',
        entries,
        onSetPassword: vi.fn(),
        onBulkUpdateEntries: onBulk,
        copy,
      }),
    );
    act(() => result.current.setOldPassword('Old-1!Aa'));
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Aa'));
    await act(async () => {
      await result.current.handleSecuritySetup();
    });
    expect(onBulk).toHaveBeenCalledTimes(1);
    const [updated] = onBulk.mock.calls[0];
    expect(updated.map((e: DiaryEntry) => e.id)).toEqual(['e1', 'e3']);
    expect(updated.every((e: DiaryEntry) => e.content === 'cipher-new')).toBe(true);
  });

  it('cancels (does not promote) when the user declines the "N entries failed to decrypt" prompt', async () => {
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(true);
    vi.spyOn(SecurityService, 'decrypt').mockRejectedValue(new Error('bad ciphertext'));
    const onSetPassword = vi.fn();
    const onBulk = vi.fn();
    const confirm = vi.fn(() => false);
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: 'h',
        passwordSalt: 's',
        entries: [
          {
            id: 'doomed',
            title: 'd',
            content: 'cipher',
            createdAt: 1,
            tags: [],
            isLocked: false,
            isEncrypted: true,
          },
        ],
        onSetPassword,
        onBulkUpdateEntries: onBulk,
        copy,
        confirm,
      }),
    );
    act(() => result.current.setOldPassword('Old-1!Aa'));
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Aa'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSecuritySetup();
    });
    expect(ok).toBe(false);
    expect(confirm).toHaveBeenCalledWith('lose 1 entries?');
    expect(onSetPassword).not.toHaveBeenCalled();
    expect(onBulk).not.toHaveBeenCalled();
  });

  it('toggles isFullscreen around the re-encryption flow', async () => {
    vi.spyOn(SecurityService, 'verifyPassword').mockResolvedValue(true);
    const setIsFullscreen = vi.fn();
    const { result } = renderHook(() =>
      useDashboardSecurity({
        passwordHash: 'h',
        passwordSalt: 's',
        entries: [],
        onSetPassword: vi.fn(),
        onBulkUpdateEntries: vi.fn(),
        copy,
        setIsFullscreen,
      }),
    );
    act(() => result.current.setOldPassword('Old-1!Aa'));
    act(() => result.current.setNewPassword('Strong-1!Aa'));
    act(() => result.current.setConfirmPassword('Strong-1!Aa'));
    await act(async () => {
      await result.current.handleSecuritySetup();
    });
    // First call sets it true (entering re-encryption), final call resets
    // it false in `finally`.
    expect(setIsFullscreen).toHaveBeenCalledWith(true);
    expect(setIsFullscreen).toHaveBeenLastCalledWith(false);
  });
});
