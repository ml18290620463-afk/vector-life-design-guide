import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FRAME_SCHEMES,
  ALLOWED_IMAGE_SCHEMES,
  ALLOWED_LINK_SCHEMES,
  ALLOWED_MEDIA_SCHEMES,
  isSchemeAllowed,
} from './markdownSchemes';

describe('isSchemeAllowed', () => {
  it('allows http(s) and mailto links by default', () => {
    expect(isSchemeAllowed('https://example.com', ALLOWED_LINK_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('http://example.com', ALLOWED_LINK_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('mailto:hi@example.com', ALLOWED_LINK_SCHEMES)).toBe(true);
  });

  it('blocks dangerous schemes for links', () => {
    expect(isSchemeAllowed('javascript:alert(1)', ALLOWED_LINK_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('data:text/html,<script>x</script>', ALLOWED_LINK_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('vbscript:msgbox', ALLOWED_LINK_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('file:///etc/passwd', ALLOWED_LINK_SCHEMES)).toBe(false);
  });

  it('treats relative URLs and anchors as safe', () => {
    expect(isSchemeAllowed('/foo', ALLOWED_LINK_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('./bar', ALLOWED_LINK_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('../baz', ALLOWED_LINK_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('#anchor', ALLOWED_LINK_SCHEMES)).toBe(true);
  });

  it('rejects empty or whitespace-only values', () => {
    expect(isSchemeAllowed('', ALLOWED_LINK_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('   ', ALLOWED_LINK_SCHEMES)).toBe(false);
    expect(isSchemeAllowed(undefined, ALLOWED_LINK_SCHEMES)).toBe(false);
  });

  it('only permits image data URLs that are not SVG', () => {
    expect(isSchemeAllowed('data:image/png;base64,abc', ALLOWED_IMAGE_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('data:image/svg+xml;base64,abc', ALLOWED_IMAGE_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('data:application/pdf;base64,abc', ALLOWED_IMAGE_SCHEMES)).toBe(false);
    expect(isSchemeAllowed('data:image/png;base64,abc', ALLOWED_FRAME_SCHEMES)).toBe(false);
  });

  it('allows blob URLs for media and frames', () => {
    expect(isSchemeAllowed('blob:https://app/abc', ALLOWED_MEDIA_SCHEMES)).toBe(true);
    expect(isSchemeAllowed('blob:https://app/abc', ALLOWED_FRAME_SCHEMES)).toBe(true);
  });
});
