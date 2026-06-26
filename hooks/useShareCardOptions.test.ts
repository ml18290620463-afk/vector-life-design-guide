import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppStorageKeys } from '../services/appSettings';
import { SHARE_CARD_DEFAULT_OPTIONS, useShareCardOptions } from './useShareCardOptions';

describe('useShareCardOptions (Phase 3 §3.h)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('hydrates with privacy-on defaults when no localStorage entry exists', () => {
    const { result } = renderHook(() => useShareCardOptions());
    expect(result.current.options).toEqual(SHARE_CARD_DEFAULT_OPTIONS);
    expect(result.current.options.showBody).toBe(false);
  });

  it('persists option updates to localStorage immediately', () => {
    const { result } = renderHook(() => useShareCardOptions());
    act(() => {
      result.current.updateOption('showBody', true);
    });
    expect(result.current.options.showBody).toBe(true);

    const stored = JSON.parse(localStorage.getItem(AppStorageKeys.shareCardOptions) ?? '{}');
    expect(stored.showBody).toBe(true);
    expect(stored.showTags).toBe(true); // unchanged
  });

  it('replaces the entire options blob via setOptions', () => {
    const { result } = renderHook(() => useShareCardOptions());
    act(() => {
      result.current.setOptions({
        showBody: true,
        showTags: false,
        showAttachmentBadge: false,
        theme: 'light',
      });
    });
    expect(result.current.options).toEqual({
      showBody: true,
      showTags: false,
      showAttachmentBadge: false,
      theme: 'light',
    });
  });

  it('hydrates from a previously persisted blob on next mount', () => {
    localStorage.setItem(
      AppStorageKeys.shareCardOptions,
      JSON.stringify({
        showBody: true,
        showTags: false,
        showAttachmentBadge: true,
        theme: 'light',
      }),
    );
    const { result } = renderHook(() => useShareCardOptions());
    expect(result.current.options.showBody).toBe(true);
    expect(result.current.options.showTags).toBe(false);
    expect(result.current.options.theme).toBe('light');
  });

  it('falls back to the privacy-on defaults when the stored blob is malformed', () => {
    localStorage.setItem(AppStorageKeys.shareCardOptions, '{"showBody":"yes-please"}');
    const { result } = renderHook(() => useShareCardOptions());
    expect(result.current.options).toEqual(SHARE_CARD_DEFAULT_OPTIONS);
  });

  it('resetToDefaults restores the privacy-on defaults and persists them', () => {
    const { result } = renderHook(() => useShareCardOptions());
    act(() => {
      result.current.updateOption('showBody', true);
      result.current.updateOption('theme', 'light');
    });
    act(() => {
      result.current.resetToDefaults();
    });
    expect(result.current.options).toEqual(SHARE_CARD_DEFAULT_OPTIONS);
    const stored = JSON.parse(localStorage.getItem(AppStorageKeys.shareCardOptions) ?? '{}');
    expect(stored).toEqual(SHARE_CARD_DEFAULT_OPTIONS);
  });
});
