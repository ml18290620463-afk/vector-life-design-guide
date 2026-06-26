import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShareCardExport } from './useShareCardExport';

// `modern-screenshot` is heavy and ships a `<foreignObject>` SVG
// embed that happy-dom does not implement. Mock the entire module
// so the unit test exercises the *hook contract* (status machine,
// download trigger, blob return value) without wrestling with
// browser-only rasterization internals.
vi.mock('modern-screenshot', () => ({
  domToBlob: vi.fn(async () => new Blob(['fake-png-bytes'], { type: 'image/png' })),
}));

describe('useShareCardExport (Phase 3 §3.h)', () => {
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    appendSpy = vi.spyOn(document.body, 'appendChild');
    removeSpy = vi.spyOn(document.body, 'removeChild');
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    if (!URL.createObjectURL) {
      // happy-dom does not implement URL.createObjectURL by default.
      Object.defineProperty(URL, 'createObjectURL', {
        value: () => 'blob:mock',
        configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true });
    }
    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-share-card');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts idle, transitions to rendering then success, returns the Blob', async () => {
    const { result } = renderHook(() => useShareCardExport());
    expect(result.current.status).toBe('idle');

    const node = document.createElement('div');
    Object.defineProperty(node, 'getBoundingClientRect', {
      value: () => ({ width: 360, height: 640, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    document.body.appendChild(node);

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.exportPng(node, { filename: 'unit-test' });
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('image/png');
    expect(result.current.status).toBe('success');
    expect(result.current.errorMessage).toBeNull();
    // The download flow created an anchor + clicked it + cleaned up.
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('returns null + status=error when the node arg is null', async () => {
    const { result } = renderHook(() => useShareCardExport());
    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.exportPng(null);
    });
    expect(blob).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('SHARE_CARD_EXPORT_NO_NODE');
  });

  it('reset() clears the status + error message back to idle', async () => {
    const { result } = renderHook(() => useShareCardExport());
    await act(async () => {
      await result.current.exportPng(null);
    });
    expect(result.current.status).toBe('error');
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });

  it('catches rasterizer failures and surfaces the message', async () => {
    const ms = await import('modern-screenshot');
    (ms.domToBlob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useShareCardExport());
    const node = document.createElement('div');
    Object.defineProperty(node, 'getBoundingClientRect', {
      value: () => ({ width: 360, height: 640, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    document.body.appendChild(node);

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.exportPng(node);
    });
    expect(blob).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('boom');
  });
});
