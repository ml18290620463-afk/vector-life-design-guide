import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetTrustedDevicesForTests,
  addTrust,
  hydrateTrustedDevices,
  isPublicKeyTrusted,
  isTrusted,
  listTrustedDevices,
  relabelTrust,
  relabelTrustedPublicKey,
  revokeTrust,
  revokeTrustedPublicKey,
  trustPublicKey,
} from './trustedDevices';

const KEY_A = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const KEY_B = 'IiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QA==';

describe('services/trustedDevices', () => {
  beforeEach(async () => {
    await __resetTrustedDevicesForTests();
  });
  afterEach(async () => {
    await __resetTrustedDevicesForTests();
  });

  /* ----- Pure helpers ------------------------------------------- */

  describe('hydrateTrustedDevices', () => {
    it('drops malformed entries', () => {
      const result = hydrateTrustedDevices([
        { publicKey: KEY_A, fingerprint: 'fp1', label: '', trustedAt: 1 },
        { foo: 'bar' },
        null,
        'a string',
        { publicKey: KEY_B, fingerprint: 'fp2', label: 'x', trustedAt: 2 },
      ]);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.publicKey)).toEqual([KEY_A, KEY_B]);
    });

    it('returns [] for non-array input', () => {
      expect(hydrateTrustedDevices(null)).toEqual([]);
      expect(hydrateTrustedDevices('string')).toEqual([]);
      expect(hydrateTrustedDevices({ a: 1 })).toEqual([]);
    });

    it('de-dupes by publicKey, keeping the most recent', () => {
      const result = hydrateTrustedDevices([
        { publicKey: KEY_A, fingerprint: 'fp1', label: 'old', trustedAt: 1 },
        { publicKey: KEY_A, fingerprint: 'fp1', label: 'new', trustedAt: 5 },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('new');
      expect(result[0].trustedAt).toBe(5);
    });
  });

  describe('addTrust', () => {
    it('appends a new key', () => {
      const next = addTrust([], KEY_A, 'iPhone 15');
      expect(next).toHaveLength(1);
      expect(next[0].publicKey).toBe(KEY_A);
      expect(next[0].label).toBe('iPhone 15');
      expect(next[0].fingerprint).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    });

    it('updates label/timestamp when key already exists (no duplicate)', () => {
      const first = addTrust([], KEY_A, 'old', 100);
      const second = addTrust(first, KEY_A, 'new', 200);
      expect(second).toHaveLength(1);
      expect(second[0].label).toBe('new');
      expect(second[0].trustedAt).toBe(200);
    });

    it('truncates long labels to 80 characters', () => {
      const long = 'x'.repeat(200);
      const next = addTrust([], KEY_A, long);
      expect(next[0].label.length).toBe(80);
    });
  });

  describe('isTrusted', () => {
    it('returns true for a present key', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: '', trustedAt: 1 }];
      expect(isTrusted(list, KEY_A)).toBe(true);
    });
    it('returns false for an absent key', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: '', trustedAt: 1 }];
      expect(isTrusted(list, KEY_B)).toBe(false);
    });
  });

  describe('revokeTrust', () => {
    it('removes the matching key', () => {
      const list = [
        { publicKey: KEY_A, fingerprint: 'fpA', label: '', trustedAt: 1 },
        { publicKey: KEY_B, fingerprint: 'fpB', label: '', trustedAt: 2 },
      ];
      const next = revokeTrust(list, KEY_A);
      expect(next).toHaveLength(1);
      expect(next[0].publicKey).toBe(KEY_B);
    });
    it('is a no-op for absent keys', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: '', trustedAt: 1 }];
      expect(revokeTrust(list, KEY_B)).toEqual(list);
    });
  });

  /* ----- IDB-backed wrappers ------------------------------------ */

  describe('trustPublicKey + isPublicKeyTrusted', () => {
    it('round-trips via IDB', async () => {
      expect(await isPublicKeyTrusted(KEY_A)).toBe(false);
      await trustPublicKey(KEY_A, 'Old phone');
      expect(await isPublicKeyTrusted(KEY_A)).toBe(true);
    });

    it('listTrustedDevices returns most-recent-first', async () => {
      await trustPublicKey(KEY_A, 'A', 100);
      await trustPublicKey(KEY_B, 'B', 200);
      const list = await listTrustedDevices();
      expect(list[0].publicKey).toBe(KEY_B);
      expect(list[1].publicKey).toBe(KEY_A);
    });
  });

  describe('revokeTrustedPublicKey', () => {
    it('removes the key + persists the change', async () => {
      await trustPublicKey(KEY_A, 'Old phone');
      expect(await isPublicKeyTrusted(KEY_A)).toBe(true);
      await revokeTrustedPublicKey(KEY_A);
      expect(await isPublicKeyTrusted(KEY_A)).toBe(false);
    });
    it('is a no-op for unknown keys (no throw)', async () => {
      await expect(revokeTrustedPublicKey(KEY_B)).resolves.toEqual([]);
    });
  });

  /* ----- §4.b-3 follow-up K1 — relabel ----------------------------- */

  describe('relabelTrust', () => {
    it('updates label without changing trustedAt', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: 'old', trustedAt: 100 }];
      const next = relabelTrust(list, KEY_A, 'new label');
      expect(next).toHaveLength(1);
      expect(next[0].label).toBe('new label');
      expect(next[0].trustedAt).toBe(100);
    });
    it('returns the same array reference for an unchanged label (no-op)', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: 'same', trustedAt: 1 }];
      expect(relabelTrust(list, KEY_A, 'same')).toBe(list);
    });
    it('returns the same array reference when the key is absent', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: 'a', trustedAt: 1 }];
      expect(relabelTrust(list, KEY_B, 'whatever')).toBe(list);
    });
    it('truncates new labels to 80 characters', () => {
      const list = [{ publicKey: KEY_A, fingerprint: 'fp', label: 'a', trustedAt: 1 }];
      const next = relabelTrust(list, KEY_A, 'x'.repeat(200));
      expect(next[0].label.length).toBe(80);
    });
  });

  describe('relabelTrustedPublicKey', () => {
    it('persists label edits via IDB', async () => {
      await trustPublicKey(KEY_A, 'old');
      await relabelTrustedPublicKey(KEY_A, 'new');
      const list = await listTrustedDevices();
      expect(list[0].label).toBe('new');
    });
    it('is a no-op for unknown keys (returns existing list)', async () => {
      await trustPublicKey(KEY_A, 'a');
      const before = await listTrustedDevices();
      const after = await relabelTrustedPublicKey(KEY_B, 'whatever');
      expect(after).toEqual(before);
    });
  });
});
