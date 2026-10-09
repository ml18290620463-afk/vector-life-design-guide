import { describe, expect, it } from 'vitest';
import {
  classifyMaterialReference,
  normalizeWebMaterialUrl,
  summarizeMaterialReferences,
} from './materialPersistence';

describe('material persistence', () => {
  it('separates embedded bytes from address-only and unstable references', () => {
    expect(classifyMaterialReference('data:image/png;base64,AAAA')).toBe('embedded');
    expect(classifyMaterialReference('https://example.com/proof')).toBe('external-link');
    expect(classifyMaterialReference('blob:temporary')).toBe('unstable-reference');
    expect(classifyMaterialReference('file:///private/photo.jpg')).toBe('unstable-reference');
    expect(
      summarizeMaterialReferences(['data:text/plain,proof', 'https://example.com', '']),
    ).toEqual({
      embedded: 1,
      externalLink: 1,
      unstableReference: 1,
    });
  });

  it('normalizes only web URLs suitable for link materials', () => {
    expect(normalizeWebMaterialUrl('example.com/proof')).toBe('https://example.com/proof');
    expect(normalizeWebMaterialUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeWebMaterialUrl('file:///private/proof')).toBeNull();
  });
});
