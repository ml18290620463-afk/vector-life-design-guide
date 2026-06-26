import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardFullscreen } from './useDashboardFullscreen';

describe('useDashboardFullscreen', () => {
  let originalRequest: typeof document.documentElement.requestFullscreen;
  let originalExit: typeof document.exitFullscreen;

  beforeEach(() => {
    originalRequest = document.documentElement.requestFullscreen;
    originalExit = document.exitFullscreen;
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    document.documentElement.requestFullscreen = originalRequest;
    document.exitFullscreen = originalExit;
    vi.restoreAllMocks();
  });

  const setFullscreenElement = (target: Element | null) => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: target,
      configurable: true,
      writable: true,
    });
  };

  it('initialises from document.fullscreenElement', () => {
    setFullscreenElement(document.documentElement);
    const { result } = renderHook(() => useDashboardFullscreen());
    expect(result.current.isFullscreen).toBe(true);
  });

  it('defaults to false when no fullscreenElement is present', () => {
    setFullscreenElement(null);
    const { result } = renderHook(() => useDashboardFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('toggleFullScreen requests fullscreen when nothing is active', async () => {
    setFullscreenElement(null);
    const request = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = request;
    const { result } = renderHook(() => useDashboardFullscreen());

    await act(async () => {
      result.current.toggleFullScreen();
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('toggleFullScreen exits when something is already active', async () => {
    setFullscreenElement(document.documentElement);
    const exit = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exit;
    const { result } = renderHook(() => useDashboardFullscreen());

    await act(async () => {
      result.current.toggleFullScreen();
      await Promise.resolve();
    });

    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('exitFullscreen is a no-op when not in fullscreen', () => {
    setFullscreenElement(null);
    const exit = vi.fn();
    document.exitFullscreen = exit;
    const { result } = renderHook(() => useDashboardFullscreen());

    act(() => result.current.exitFullscreen());
    expect(exit).not.toHaveBeenCalled();
  });

  it('reflects external fullscreenchange events back into state', () => {
    setFullscreenElement(null);
    const { result } = renderHook(() => useDashboardFullscreen());
    expect(result.current.isFullscreen).toBe(false);

    setFullscreenElement(document.documentElement);
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(true);

    setFullscreenElement(null);
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(false);
  });
});
