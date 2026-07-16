import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushAppPath, replaceAppPath } from './previewMode';

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
});
