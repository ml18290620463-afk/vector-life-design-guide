import { useCallback, useEffect, useState } from 'react';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredJson, setStoredJson } from '../services/browserStorage';
import type { ShareCardTheme } from '../lib/shareCardPalette';

export interface ShareCardOptions {
  /** Reveal the entry body inside the card. **Default false** —
   *  privacy-by-default so an accidental "Share Card" tap on a
   *  sensitive entry never leaks raw content. The user must
   *  explicitly opt in for each session-stored decision. */
  showBody: boolean;
  /** Render the entry's tag chips below the title. Default true
   *  (tags are usually safe to share — they're already meant to
   *  categorise without revealing content). */
  showTags: boolean;
  /** Render the "📎 attachment" badge when the entry has one
   *  (without leaking the attachment itself). Default true. */
  showAttachmentBadge: boolean;
  /** Card surface theme — independent of the user's app theme so
   *  power users can ship a dark card from a light app and vice
   *  versa. Defaults to `dark` because that matches the app's
   *  primary brand expression. */
  theme: ShareCardTheme;
}

export const SHARE_CARD_DEFAULT_OPTIONS: ShareCardOptions = {
  showBody: false,
  showTags: true,
  showAttachmentBadge: true,
  theme: 'dark',
};

const isShareCardOptions = (value: unknown): value is ShareCardOptions => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.showBody === 'boolean' &&
    typeof candidate.showTags === 'boolean' &&
    typeof candidate.showAttachmentBadge === 'boolean' &&
    (candidate.theme === 'dark' || candidate.theme === 'light')
  );
};

const readStored = (): ShareCardOptions => {
  const stored = getStoredJson<unknown>(AppStorageKeys.shareCardOptions);
  if (isShareCardOptions(stored)) return stored;
  return SHARE_CARD_DEFAULT_OPTIONS;
};

export interface UseShareCardOptionsResult {
  options: ShareCardOptions;
  /** Replace the entire options object (e.g. after a UI form). */
  setOptions: (next: ShareCardOptions) => void;
  /** Patch a subset; the rest of the options keep their value.
   *  The hook persists immediately, so reopening the modal in the
   *  same session restores the latest toggles. */
  updateOption: <K extends keyof ShareCardOptions>(key: K, value: ShareCardOptions[K]) => void;
  /** Restore the privacy-on defaults; useful when sharing a brand
   *  new entry where the previous-session toggles might be too
   *  permissive. */
  resetToDefaults: () => void;
}

/**
 * Phase 3 §3.h — manages persisted privacy options for the
 * share-card export flow. Hook contract:
 *
 *   1. On mount, hydrate from `localStorage`. Schema-validate so
 *      a user with an older / corrupted blob falls back to the
 *      privacy-on defaults instead of opening the card with body
 *      content visible.
 *   2. Every `updateOption` / `setOptions` writes the full object
 *      back to `localStorage`. There is no debounce — toggles are
 *      cheap and the modal already debounces re-renders via React
 *      reconciliation.
 *   3. Defaults are deliberately conservative: body MASKED by
 *      default, theme dark by default. The user explicitly opts
 *      in to each disclosure.
 */
export const useShareCardOptions = (): UseShareCardOptionsResult => {
  const [options, setOptionsState] = useState<ShareCardOptions>(SHARE_CARD_DEFAULT_OPTIONS);

  // Hydrate once on mount; localStorage is browser-only so the
  // initial useState above stays SSR-safe (every server render
  // sees the privacy-on defaults).
  useEffect(() => {
    setOptionsState(readStored());
  }, []);

  const setOptions = useCallback((next: ShareCardOptions) => {
    setOptionsState(next);
    setStoredJson(AppStorageKeys.shareCardOptions, next);
  }, []);

  const updateOption = useCallback(
    <K extends keyof ShareCardOptions>(key: K, value: ShareCardOptions[K]) => {
      setOptionsState((prev) => {
        const next = { ...prev, [key]: value };
        setStoredJson(AppStorageKeys.shareCardOptions, next);
        return next;
      });
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setOptions(SHARE_CARD_DEFAULT_OPTIONS);
  }, [setOptions]);

  return { options, setOptions, updateOption, resetToDefaults };
};
