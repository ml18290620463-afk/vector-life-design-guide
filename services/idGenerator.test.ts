import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateSecureId } from './idGenerator';

describe('idGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a prefixed UUID when randomUUID is available', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '123e4567-e89b-12d3-a456-426614174000',
    );

    expect(generateSecureId('entry')).toBe('entry-123e4567-e89b-12d3-a456-426614174000');
  });

  it('returns unique ids across calls', () => {
    const first = generateSecureId('entry');
    const second = generateSecureId('entry');

    expect(first).not.toBe(second);
    expect(first.startsWith('entry-')).toBe(true);
    expect(second.startsWith('entry-')).toBe(true);
  });
});
