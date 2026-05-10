import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireBlobUrl,
  __blobUrlCacheSizeForTests,
  __resetBlobUrlCacheForTests,
} from './blobUrlCache';

const SAMPLE_PNG_DATA_URL =
  // 1×1 transparent PNG, base64.
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
const SAMPLE_TEXT_DATA_URL = 'data:text/plain,hello%20world';

describe('acquireBlobUrl', () => {
  let createSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetBlobUrlCacheForTests();
    let counter = 0;
    createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++counter}`);
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    __resetBlobUrlCacheForTests();
  });

  it('passes through non-data URLs unchanged with a no-op release', () => {
    const handle = acquireBlobUrl('https://example.test/foo.png');
    expect(handle.url).toBe('https://example.test/foo.png');
    handle.release();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('returns empty string for null / undefined input', () => {
    expect(acquireBlobUrl(null).url).toBe('');
    expect(acquireBlobUrl(undefined).url).toBe('');
    expect(acquireBlobUrl('').url).toBe('');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('decodes a base64 data URL into a blob URL', () => {
    const handle = acquireBlobUrl(SAMPLE_PNG_DATA_URL);
    expect(handle.url).toBe('blob:mock-1');
    expect(createSpy).toHaveBeenCalledTimes(1);
    const blobArg = createSpy.mock.calls[0]![0] as Blob;
    expect(blobArg.type).toBe('image/png');
    handle.release();
  });

  it('reuses the same blob URL for repeated acquisitions of the same data URL (refcount)', () => {
    const a = acquireBlobUrl(SAMPLE_PNG_DATA_URL);
    const b = acquireBlobUrl(SAMPLE_PNG_DATA_URL);
    expect(a.url).toBe(b.url);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(__blobUrlCacheSizeForTests()).toBe(1);

    a.release();
    expect(revokeSpy).not.toHaveBeenCalled(); // still 1 ref
    b.release();
    expect(revokeSpy).toHaveBeenCalledTimes(1); // 0 refs → revoked
    expect(__blobUrlCacheSizeForTests()).toBe(0);
  });

  it('release() is idempotent — calling twice does not double-revoke', () => {
    const handle = acquireBlobUrl(SAMPLE_PNG_DATA_URL);
    handle.release();
    handle.release();
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it('decodes percent-encoded text data URLs (no base64 segment)', () => {
    const handle = acquireBlobUrl(SAMPLE_TEXT_DATA_URL);
    expect(handle.url).toBe('blob:mock-1');
    const blobArg = createSpy.mock.calls[0]![0] as Blob;
    expect(blobArg.type).toBe('text/plain');
    handle.release();
  });

  it('returns the input unchanged when the data URL is malformed', () => {
    const garbage = 'data:image/png;base64,!@#$%not-base64!!!';
    const handle = acquireBlobUrl(garbage);
    expect(handle.url).toBe(garbage);
    handle.release();
  });

  it('different data URLs allocate different blob URLs', () => {
    const a = acquireBlobUrl(SAMPLE_PNG_DATA_URL);
    const b = acquireBlobUrl(SAMPLE_TEXT_DATA_URL);
    expect(a.url).not.toBe(b.url);
    expect(__blobUrlCacheSizeForTests()).toBe(2);
    a.release();
    b.release();
    expect(__blobUrlCacheSizeForTests()).toBe(0);
  });
});
