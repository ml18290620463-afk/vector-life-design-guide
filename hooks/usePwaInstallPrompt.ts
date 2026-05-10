import { useCallback, useEffect, useState } from 'react';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';

/** Subset of the `BeforeInstallPromptEvent` we actually need. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PwaInstallPrompt {
  /** True when the browser has fired `beforeinstallprompt` AND the user
   *  has neither already installed nor permanently dismissed the
   *  banner in this app. The Dashboard renders its banner only when
   *  this is true. */
  isAvailable: boolean;
  /** True after `prompt()` resolves with `outcome === 'accepted'`. */
  isInstalled: boolean;
  /** Trigger the native install prompt. No-op when `isAvailable` is
   *  false. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** "Not now" — hides the banner for `dismissalDays` (default 30 d). */
  dismiss: () => void;
}

const DEFAULT_DISMISSAL_DAYS = 30;

const isDismissalActive = (dismissalDays: number): boolean => {
  const raw = getStoredString(AppStorageKeys.pwaInstallDismissedAt);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  const elapsed = Date.now() - dismissedAt;
  return elapsed < dismissalDays * 24 * 60 * 60 * 1000;
};

/**
 * Captures the native `beforeinstallprompt` event, persists the
 * user's "not now" dismissal so we don't nag every visit, and
 * exposes a tiny API the Dashboard banner consumes.
 *
 * Pulled out as part of Phase 3 §3.g. Consumers should call
 * `promptInstall()` from a user-gesture handler (the browser only
 * honours the prompt inside one).
 */
export const usePwaInstallPrompt = (
  dismissalDays: number = DEFAULT_DISMISSAL_DAYS,
): PwaInstallPrompt => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => isDismissalActive(dismissalDays));

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      // Stop the browser's automatic mini-infobar — we'll surface it
      // via our own banner so it can carry the brand voice.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      // The event is single-shot; clear it so we don't re-prompt.
      setDeferredPrompt(null);
      return choice.outcome;
    } catch (err) {
      console.warn('PWA install prompt failed:', err);
      setDeferredPrompt(null);
      return 'dismissed';
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setStoredString(AppStorageKeys.pwaInstallDismissedAt, String(Date.now()));
    setIsDismissed(true);
  }, []);

  const isAvailable = !!deferredPrompt && !isInstalled && !isDismissed;

  return { isAvailable, isInstalled, promptInstall, dismiss };
};
