import { describe, expect, it } from 'vitest';
import { ed } from '../services/edBootstrap';
import { createMinter, ttlSecondsForPeriod } from './licenseMinter';
import { verifyLicenseToken } from '../services/licenseToken';

const KID = 'test-master-2026';
const INSTALL = 'install-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const buildConfig = async () => {
  const secret = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secret);
  // base64 (using Buffer is fine in Node test env).
  const secretKeyBase64 = Buffer.from(secret).toString('base64');
  return { secretKeyBase64, publicKey };
};

describe('server/licenseMinter', () => {
  describe('createMinter validation', () => {
    it('throws when secretKeyBase64 is missing', () => {
      expect(() => createMinter({ secretKeyBase64: '', kid: KID })).toThrow(/required/);
    });

    it('throws when kid is missing', async () => {
      const { secretKeyBase64 } = await buildConfig();
      expect(() => createMinter({ secretKeyBase64, kid: '' })).toThrow(/required/);
    });

    it('throws when secret key decodes to a non-32-byte buffer', () => {
      const tooShort = Buffer.from(new Uint8Array(16)).toString('base64');
      expect(() => createMinter({ secretKeyBase64: tooShort, kid: KID })).toThrow(/32 bytes/);
    });
  });

  describe('mintToken', () => {
    it('produces a token that verifies against the matching public key', async () => {
      const { secretKeyBase64, publicKey } = await buildConfig();
      const minter = createMinter({ secretKeyBase64, kid: KID });
      const token = await minter.mintToken({
        tier: 'stardust',
        installId: INSTALL,
        ttlSeconds: ttlSecondsForPeriod('monthly'),
      });
      expect(token.startsWith('vector-license-v1.')).toBe(true);
      const verify = await verifyLicenseToken({
        token,
        publicKeyring: { [KID]: publicKey },
      });
      expect(verify.ok).toBe(true);
      if (verify.ok) {
        expect(verify.payload.tier).toBe('stardust');
        expect(verify.payload.sub).toBe(INSTALL);
        expect(verify.payload.kid).toBe(KID);
      }
    });

    it('respects ttlSeconds — exp is now + ttl', async () => {
      const { secretKeyBase64, publicKey } = await buildConfig();
      const minter = createMinter({ secretKeyBase64, kid: KID });
      const ttl = 7 * 86400;
      const before = Math.floor(Date.now() / 1000);
      const token = await minter.mintToken({
        tier: 'polaris',
        installId: INSTALL,
        ttlSeconds: ttl,
      });
      const verify = await verifyLicenseToken({
        token,
        publicKeyring: { [KID]: publicKey },
      });
      if (!verify.ok) throw new Error('expected ok');
      const exp = verify.payload.exp;
      // Allow a 5-second wall-clock fudge between mint and assert.
      expect(exp).toBeGreaterThanOrEqual(before + ttl);
      expect(exp).toBeLessThanOrEqual(before + ttl + 5);
    });

    it('throws when installId is empty', async () => {
      const { secretKeyBase64 } = await buildConfig();
      const minter = createMinter({ secretKeyBase64, kid: KID });
      await expect(
        minter.mintToken({ tier: 'stardust', installId: '', ttlSeconds: 100 }),
      ).rejects.toThrow(/installId/);
    });

    it('throws when ttlSeconds is non-positive', async () => {
      const { secretKeyBase64 } = await buildConfig();
      const minter = createMinter({ secretKeyBase64, kid: KID });
      await expect(
        minter.mintToken({ tier: 'stardust', installId: INSTALL, ttlSeconds: 0 }),
      ).rejects.toThrow(/ttl/i);
      await expect(
        minter.mintToken({ tier: 'stardust', installId: INSTALL, ttlSeconds: -1 }),
      ).rejects.toThrow(/ttl/i);
    });
  });

  describe('getPublicKey', () => {
    it('returns the 32-byte public key matched to the secret', async () => {
      const { secretKeyBase64, publicKey } = await buildConfig();
      const minter = createMinter({ secretKeyBase64, kid: KID });
      const got = await minter.getPublicKey();
      expect(got.length).toBe(32);
      expect(Buffer.from(got).toString('base64')).toBe(Buffer.from(publicKey).toString('base64'));
    });
  });

  describe('ttlSecondsForPeriod', () => {
    it('monthly = 32 days (30 + 2 grace)', () => {
      expect(ttlSecondsForPeriod('monthly')).toBe(32 * 86400);
    });
    it('annual = 380 days (365 + 15 grace)', () => {
      expect(ttlSecondsForPeriod('annual')).toBe(380 * 86400);
    });
    it('lifetime = ~100 years', () => {
      expect(ttlSecondsForPeriod('lifetime')).toBe(100 * 365 * 86400);
    });
  });
});
