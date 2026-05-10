import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAttachmentBlobUrl } from './useAttachmentBlobUrl';
import { __blobUrlCacheSizeForTests, __resetBlobUrlCacheForTests } from '../lib/blobUrlCache';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

describe('useAttachmentBlobUrl', () => {
  beforeEach(() => {
    __resetBlobUrlCacheForTests();
    let counter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++counter}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetBlobUrlCacheForTests();
  });

  it('returns null for empty input', () => {
    const { result } = renderHook(() => useAttachmentBlobUrl(undefined));
    expect(result.current).toBeNull();
  });

  it('passes through non-data URLs unchanged', () => {
    const { result } = renderHook(() => useAttachmentBlobUrl('https://example.test/x.png'));
    expect(result.current).toBe('https://example.test/x.png');
  });

  it('emits a blob URL after mount for a data URL input', () => {
    const { result } = renderHook(() => useAttachmentBlobUrl(PNG));
    expect(result.current).toMatch(/^blob:mock-\d+$/);
    expect(__blobUrlCacheSizeForTests()).toBe(1);
  });

  it('releases the blob URL on unmount (cache empties when refcount hits zero)', () => {
    const { unmount } = renderHook(() => useAttachmentBlobUrl(PNG));
    expect(__blobUrlCacheSizeForTests()).toBe(1);
    unmount();
    expect(__blobUrlCacheSizeForTests()).toBe(0);
  });

  it('shares the blob URL across two simultaneous mounts', () => {
    const a = renderHook(() => useAttachmentBlobUrl(PNG));
    const b = renderHook(() => useAttachmentBlobUrl(PNG));
    expect(a.result.current).toBe(b.result.current);
    expect(__blobUrlCacheSizeForTests()).toBe(1);
    a.unmount();
    expect(__blobUrlCacheSizeForTests()).toBe(1);
    b.unmount();
    expect(__blobUrlCacheSizeForTests()).toBe(0);
  });

  it('reacquires when the data URL prop changes', () => {
    const { rerender } = renderHook(({ url }) => useAttachmentBlobUrl(url), {
      initialProps: { url: PNG },
    });
    expect(__blobUrlCacheSizeForTests()).toBe(1);
    rerender({ url: 'data:text/plain,hello' });
    expect(__blobUrlCacheSizeForTests()).toBe(1); // old released, new acquired
  });
});
