import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePwaInstallPrompt } from './usePwaInstallPrompt';
import { AppStorageKeys } from '../services/appSettings';
import { removeStoredValue, setStoredString } from '../services/browserStorage';

const dispatchBeforeInstallPrompt = (handlers: {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}) => {
  const event = new Event('beforeinstallprompt') as unknown as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    platforms: string[];
  };
  // Wire the event with the BeforeInstallPromptEvent surface the hook
  // consumes. We don't set `preventDefault` because the hook calls it
  // through the standard Event interface (default impl is a no-op).
  Object.assign(event, {
    prompt: handlers.prompt,
    userChoice: handlers.userChoice,
    platforms: ['web'],
  });
  window.dispatchEvent(event);
};

beforeEach(() => {
  removeStoredValue(AppStorageKeys.pwaInstallDismissedAt);
});

afterEach(() => {
  vi.restoreAllMocks();
  removeStoredValue(AppStorageKeys.pwaInstallDismissedAt);
});

describe('usePwaInstallPrompt', () => {
  it('starts unavailable until the browser fires beforeinstallprompt', () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('flips isAvailable=true once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
    });
    expect(result.current.isAvailable).toBe(true);
  });

  it('promptInstall returns "unavailable" when no event has fired yet', async () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe('unavailable');
  });

  it('promptInstall("accepted") flips isInstalled and clears availability', async () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });
    });
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe('accepted');
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isAvailable).toBe(false);
  });

  it('dismiss() persists the timestamp and hides the banner immediately', () => {
    const { result } = renderHook(() => usePwaInstallPrompt(30));
    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
    });
    expect(result.current.isAvailable).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.isAvailable).toBe(false);
  });

  it('a fresh mount inside the dismissal window stays hidden', () => {
    setStoredString(AppStorageKeys.pwaInstallDismissedAt, String(Date.now() - 1_000));
    const { result } = renderHook(() => usePwaInstallPrompt(30));
    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
    });
    expect(result.current.isAvailable).toBe(false);
  });

  it('a fresh mount past the dismissal window shows the banner again', () => {
    setStoredString(
      AppStorageKeys.pwaInstallDismissedAt,
      String(Date.now() - 31 * 24 * 60 * 60 * 1000),
    );
    const { result } = renderHook(() => usePwaInstallPrompt(30));
    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
    });
    expect(result.current.isAvailable).toBe(true);
  });
});
