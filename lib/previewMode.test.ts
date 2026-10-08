import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushAppPath, removeObsoletePreviewQuery, replaceAppPath } from './previewMode';

describe('previewMode navigation helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('does not throw when replaceState is blocked by the browser shell', () => {
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => replaceAppPath('/past')).not.toThrow();
  });

  it('does not throw when pushState is blocked by the browser shell', () => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => pushAppPath('/past')).not.toThrow();
  });

  it('cleans retired preview links without dropping unrelated URL state', () => {
    window.history.replaceState({ from: 'test' }, '', '/?preview=recovered-draft&screen=now&lang=zh#notes');

    removeObsoletePreviewQuery();

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/?lang=zh#notes');
    expect(window.history.state).toEqual({ from: 'test' });
  });

  it('preserves the supported web and mobile preview modes', () => {
    for (const mode of ['web', 'mobile']) {
      window.history.replaceState({}, '', `/?preview=${mode}&screen=now`);
      removeObsoletePreviewQuery();
      expect(window.location.search).toBe(`?preview=${mode}&screen=now`);
    }
  });
});
