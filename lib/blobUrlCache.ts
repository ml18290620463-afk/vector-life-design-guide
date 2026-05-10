/**
 * W3.3 — Reference-counted Blob URL cache for diary attachments.
 *
 * Why this exists:
 *   - We persist attachments as base64 data URLs (portable across
 *     IndexedDB / backup JSON / share-card export).
 *   - Browsers parse the entire base64 string on every paint when
 *     given a data URL as `src`. For a 4 MiB image / PDF / mp3
 *     that's 5 MB+ of base64 plus a multi-MB Blob the browser still
 *     synthesises internally, repeated on every layout pass.
 *   - Converting to a `blob:` URL once and reusing it is dramatically
 *     cheaper (one Blob, one URL handle, near-zero per-paint cost),
 *     AND lets PDF / video tags stream partial bytes instead of
 *     waiting for the full base64 to decode.
 *
 * What this gives us:
 *   - `acquireBlobUrl(dataUrl)` returns `{ url, release }`. Reuses
 *     the same blob URL across multiple render targets (e.g. a
 *     ShareCard preview AND the main viewer rendering the same
 *     attachment) via a Map<dataUrl, refCount> cache.
 *   - `release()` decrements the refcount; on 0, the blob URL is
 *     revoked so the underlying ArrayBuffer can be garbage
 *     collected.
 *
 * Tested via the companion `lib/blobUrlCache.test.ts` (see also
 * `hooks/useAttachmentBlobUrl.test.ts` for the React-binding
 * lifecycle).
 *
 * Failure mode:
 *   - If the input is NOT a `data:...;base64,...` URL (e.g. the
 *     legacy code path passes through an http URL), the helper
 *     returns the input unchanged with a no-op release. Lets
 *     consumers be fully agnostic.
 */

interface CacheEntry {
  blobUrl: string;
  refCount: number;
}

const cache = new Map<string, CacheEntry>();

const dataUrlPattern = /^data:([^;,]+)(?:;base64)?,/;

/**
 * Decode a base64 data URL into a Blob WITHOUT going through
 * `fetch(dataUrl)`. The fetch path:
 *   - Allocates twice (once to copy the base64 into the response
 *     body, once for the resulting blob)
 *   - Is async, forcing the consumer to wait a microtask before
 *     setting the `src`
 * The manual decode below is fully synchronous and allocates a
 * single Uint8Array.
 */
const decodeDataUrlToBlob = (dataUrl: string): Blob | null => {
  const match = dataUrlPattern.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const headerLength = dataUrl.indexOf(',') + 1;
  if (headerLength <= 0) return null;
  const isBase64 = dataUrl.slice(0, headerLength).includes(';base64');
  const payload = dataUrl.slice(headerLength);

  let bytes: Uint8Array;
  if (isBase64) {
    try {
      const binary = atob(payload);
      const len = binary.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } catch {
      return null;
    }
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  return new Blob([bytes], { type: mimeType });
};

export interface BlobUrlHandle {
  /** The URL safe to assign to `<img src>`, `<video src>` etc. */
  url: string;
  /**
   * MUST be called when the consumer no longer needs the URL
   * (e.g. component unmount). When the refcount reaches zero, the
   * URL is revoked and the underlying buffer becomes GC-eligible.
   * Idempotent — calling release() twice is a no-op.
   */
  release: () => void;
}

/**
 * Bypass the cache when the input clearly isn't a base64 data URL
 * (already a `blob:` / `http(s):` / relative path) — return as-is.
 */
export const acquireBlobUrl = (input: string | undefined | null): BlobUrlHandle => {
  if (!input || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return { url: input ?? '', release: () => {} };
  }
  if (!input.startsWith('data:')) {
    return { url: input, release: () => {} };
  }

  const existing = cache.get(input);
  if (existing) {
    existing.refCount += 1;
    let released = false;
    return {
      url: existing.blobUrl,
      release: () => {
        if (released) return;
        released = true;
        const live = cache.get(input);
        if (!live) return;
        live.refCount -= 1;
        if (live.refCount <= 0) {
          URL.revokeObjectURL(live.blobUrl);
          cache.delete(input);
        }
      },
    };
  }

  const blob = decodeDataUrlToBlob(input);
  if (!blob) {
    return { url: input, release: () => {} };
  }
  const blobUrl = URL.createObjectURL(blob);
  const entry: CacheEntry = { blobUrl, refCount: 1 };
  cache.set(input, entry);

  let released = false;
  return {
    url: blobUrl,
    release: () => {
      if (released) return;
      released = true;
      const live = cache.get(input);
      if (!live) return;
      live.refCount -= 1;
      if (live.refCount <= 0) {
        URL.revokeObjectURL(live.blobUrl);
        cache.delete(input);
      }
    },
  };
};

/** Test-only: drop everything in the cache. Production never calls this. */
export const __resetBlobUrlCacheForTests = () => {
  for (const entry of cache.values()) {
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch {
      // Ignore — happens when the test harness has already torn down
      // the URL implementation.
    }
  }
  cache.clear();
};

/** Test-only: peek at the live cache size. */
export const __blobUrlCacheSizeForTests = () => cache.size;
