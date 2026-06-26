import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { useViewerAccess } from './useViewerAccess';
import type { DiaryEntry } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { SecurityService } from '../services/securityService';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e1',
  title: 'Title',
  content: 'plain body',
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

const t: TranslationDictionary = {
  notReady: 'time-locked',
  tooManyAttempts: 'too-many',
  privateKeyRequired: 'need-key',
  decryptionFailed: 'wrong-key',
  biometricRestricted: 'no-biometrics',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useViewerAccess', () => {
  it('starts already-reading for an unencrypted entry without a master password', () => {
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry(),
        masterPassword: null,
        isTimeLocked: false,
        t,
      }),
    );
    expect(result.current.viewState).toBe('reading');
    expect(result.current.decrypted).toBe(true);
    expect(result.current.decryptedContent).toBe('plain body');
  });

  it('starts sealed when a master password exists, even on plain text entries', () => {
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry(),
        masterPassword: 'pw',
        isTimeLocked: false,
        t,
      }),
    );
    expect(result.current.viewState).toBe('sealed');
    expect(result.current.decrypted).toBe(false);
    expect(result.current.decryptedContent).toBe('');
  });

  it('handleOpenLetter rejects empty input with privateKeyRequired and shakes', async () => {
    const onShake = vi.fn();
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry(),
        masterPassword: 'master',
        isTimeLocked: false,
        t,
        onShake,
        // Use a tiny lockout so the test can reason about it deterministically.
        lockoutOptions: { maxAttempts: 3, lockoutDurationMs: 1_000 },
      }),
    );

    await act(async () => {
      await result.current.handleOpenLetter();
    });

    expect(result.current.decryptionError).toBe('need-key');
    expect(onShake).toHaveBeenCalled();
    expect(result.current.viewState).toBe('sealed');
  });

  it('handleOpenLetter on a wrong password registers a failure and surfaces the failure copy', async () => {
    const onShake = vi.fn();
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry(),
        masterPassword: 'master',
        isTimeLocked: false,
        t,
        onShake,
        lockoutOptions: { maxAttempts: 3, lockoutDurationMs: 1_000 },
      }),
    );

    act(() => result.current.setDecryptionPassword('not-the-master'));
    await act(async () => {
      await result.current.handleOpenLetter();
    });

    expect(result.current.lockout.failedAttempts).toBe(1);
    expect(result.current.decryptionError).toBe('wrong-key');
    // Sequential failures eventually arm the lockout banner.
    act(() => result.current.setDecryptionPassword('still-not'));
    await act(async () => {
      await result.current.handleOpenLetter();
    });
    act(() => result.current.setDecryptionPassword('and-not'));
    await act(async () => {
      await result.current.handleOpenLetter();
    });
    expect(result.current.lockout.isLockedOut).toBe(true);
    expect(result.current.decryptionError).toBe('too-many');
  });

  it('handleOpenLetter on time-locked entries rejects without consuming an attempt', async () => {
    const onShake = vi.fn();
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry(),
        masterPassword: 'master',
        isTimeLocked: true,
        t,
        onShake,
      }),
    );
    act(() => result.current.setDecryptionPassword('master'));
    await act(async () => {
      await result.current.handleOpenLetter();
    });
    expect(result.current.decryptionError).toBe('time-locked');
    expect(result.current.lockout.failedAttempts).toBe(0);
  });

  it('handleOpenLetter unseals the entry on the correct password', async () => {
    const decryptSpy = vi.spyOn(SecurityService, 'decrypt').mockResolvedValueOnce('decrypted body');
    const { result } = renderHook(() =>
      useViewerAccess({
        entry: baseEntry({ isEncrypted: true, content: 'cipher' }),
        masterPassword: 'master',
        isTimeLocked: false,
        t,
      }),
    );

    act(() => result.current.setDecryptionPassword('master'));
    await act(async () => {
      await result.current.handleOpenLetter();
    });

    // The hook is now in the 1.2s ceremony delay; advance timers to land
    // on the reading state.
    await act(async () => {
      vi.advanceTimersByTime(1_300);
    });

    expect(decryptSpy).toHaveBeenCalledWith('cipher', 'master');
    expect(result.current.viewState).toBe('reading');
    expect(result.current.decrypted).toBe(true);
    expect(result.current.decryptedContent).toBe('decrypted body');
  });
});
