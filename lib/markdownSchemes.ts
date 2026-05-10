export const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:'] as const;
export const ALLOWED_MEDIA_SCHEMES = ['http:', 'https:', 'blob:'] as const;
export const ALLOWED_IMAGE_SCHEMES = [...ALLOWED_MEDIA_SCHEMES, 'data:'] as const;
export const ALLOWED_FRAME_SCHEMES = ['http:', 'https:', 'blob:'] as const;

const PLACEHOLDER_BASE = 'https://example.invalid';

const isRelativePath = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('./') ||
  value.startsWith('../') ||
  value.startsWith('#');

const isSafeImageDataUrl = (parsed: URL): boolean => {
  if (parsed.protocol !== 'data:') return false;
  const mediaType = parsed.pathname.split(',', 1)[0]?.split(';', 1)[0]?.toLowerCase() ?? '';
  return mediaType.startsWith('image/') && !mediaType.includes('svg');
};

/**
 * Returns true when the given href/src is safe to render against the supplied
 * scheme allow list. Relative URLs (same-origin) are always permitted; data:
 * URLs are only permitted when the bucket explicitly allows `data:` and the
 * payload is an image (never SVG, which can execute JS).
 */
export const isSchemeAllowed = (raw: string | undefined, allowed: readonly string[]): boolean => {
  if (!raw) return false;
  const value = raw.trim();
  if (!value) return false;
  if (isRelativePath(value)) return true;

  let parsed: URL;
  try {
    parsed = new URL(value, PLACEHOLDER_BASE);
  } catch {
    return false;
  }

  if (parsed.protocol === 'data:') {
    if (!allowed.includes('data:')) return false;
    return isSafeImageDataUrl(parsed);
  }

  return allowed.includes(parsed.protocol);
};
