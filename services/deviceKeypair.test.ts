import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetDeviceKeypairForTests,
  ensureDeviceKeypair,
  fingerprintFromPublicKey,
  loadPublicIdentity,
  regenerateDeviceKeypair,
  unlockSecretKey,
} from './deviceKeypair';

const PASSWORD = 'correct-horse-battery-staple';

describe('services/deviceKeypair', () => {
  beforeEach(async () => {
    await __resetDeviceKeypairForTests();
  });
  afterEach(async () => {
    await __resetDeviceKeypairForTests();
  });

  describe('ensureDeviceKeypair', () => {
    it('mints a fresh keypair on first call', async () => {
      const identity = await ensureDeviceKeypair(PASSWORD);
      expect(identity.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(identity.publicKey.length).toBeGreaterThanOrEqual(40);
      expect(identity.fingerprint).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
      expect(identity.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('is idempotent — second call returns the same identity', async () => {
      const first = await ensureDeviceKeypair(PASSWORD);
      const second = await ensureDeviceKeypair(PASSWORD);
      expect(second.publicKey).toBe(first.publicKey);
      expect(second.fingerprint).toBe(first.fingerprint);
      expect(second.createdAt).toBe(first.createdAt);
    });
  });

  describe('regenerateDeviceKeypair', () => {
    it('replaces the existing keypair with a new one', async () => {
      const first = await ensureDeviceKeypair(PASSWORD);
      const next = await regenerateDeviceKeypair(PASSWORD);
      expect(next.publicKey).not.toBe(first.publicKey);
      expect(next.fingerprint).not.toBe(first.fingerprint);
    });
  });

  describe('loadPublicIdentity', () => {
    it('returns null when no keypair has ever been minted', async () => {
      const identity = await loadPublicIdentity();
      expect(identity).toBeNull();
    });

    it('returns the public identity without needing the password', async () => {
      const minted = await ensureDeviceKeypair(PASSWORD);
      const loaded = await loadPublicIdentity();
      expect(loaded?.publicKey).toBe(minted.publicKey);
      expect(loaded?.fingerprint).toBe(minted.fingerprint);
    });
  });

  describe('unlockSecretKey', () => {
    it('returns null when no keypair exists', async () => {
      expect(await unlockSecretKey(PASSWORD)).toBeNull();
    });

    it('round-trips a 32-byte secret with the correct password', async () => {
      await ensureDeviceKeypair(PASSWORD);
      const secret = await unlockSecretKey(PASSWORD);
      expect(secret).toBeInstanceOf(Uint8Array);
      expect(secret).toHaveLength(32);
    });

    it('returns null when the password is wrong (does not throw)', async () => {
      await ensureDeviceKeypair(PASSWORD);
      const result = await unlockSecretKey('totally-wrong-password');
      expect(result).toBeNull();
    });
  });

  describe('fingerprintFromPublicKey', () => {
    it('is stable for a given input', () => {
      // 32-byte raw key, base64-encoded.
      const pk = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
      const fp1 = fingerprintFromPublicKey(pk);
      const fp2 = fingerprintFromPublicKey(pk);
      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    });

    it('changes when the input changes', () => {
      const a = fingerprintFromPublicKey('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=');
      const b = fingerprintFromPublicKey('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHiA=');
      expect(a).not.toBe(b);
    });
  });
});
