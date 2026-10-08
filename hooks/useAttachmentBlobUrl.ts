import { useEffect, useState } from 'react';
import { acquireBlobUrl } from '../lib/blobUrlCache';

/**
 * W3.3 — Hook that converts an attachment's persisted base64 data
 * URL into a runtime `blob:` URL via the reference-counted cache in
 * `lib/blobUrlCache.ts`.
 *
 * Lifecycle:
 *   - On mount (or whenever `dataUrl` changes), acquire a blob URL.
 *   - Return the blob URL string for the consumer to bind to
 *     `<img src>` / `<video src>` / `<iframe src>` / etc.
 *   - On unmount (or when `dataUrl` changes), release the handle so
 *     the cache can revoke the blob URL when no other consumer
 *     holds it.
 *
 * Pass-through: if `dataUrl` is empty / null / already a `blob:` /
 * `http(s):` URL, the hook returns it unchanged with no allocation.
 *
 * Returns null when input is empty so consumers can render a
 * placeholder without binding a meaningless empty src.
 */
export const useAttachmentBlobUrl = (dataUrl: string | undefined | null): string | null => {
  const [url, setUrl] = useState<string | null>(() => {
    if (!dataUrl) return null;
    if (typeof window === 'undefined') return dataUrl;
    return null; // Will be filled by the effect below to avoid SSR mismatch.
  });

  useEffect(() => {
    if (!dataUrl) {
      setUrl(null);
      return;
    }
    const handle = acquireBlobUrl(dataUrl);
    setUrl(handle.url);
    return () => {
      handle.release();
    };
  }, [dataUrl]);

  return url;
};
