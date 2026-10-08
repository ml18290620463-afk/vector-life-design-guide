import { describe, expect, it } from 'vitest';
import { ed } from './edBootstrap';
import { signLicenseToken, verifyLicenseToken, type LicensePayload } from './licenseToken';

const NOW_S = Math.floor(Date.UTC(2026, 4, 1) / 1000); // 2026-05-01

const buildKeyring = async () => {
  const secretA = ed.utils.randomSecretKey();
  const publicA = await ed.getPublicKeyAsync(secretA);
  const secretB = ed.utils.randomSecretKey();
  const publicB = await ed.getPublicKeyAsync(secretB);
  return {
    secretA,
    publicA,
    secretB,
    publicB,
    keyring: { 'kid-A': publicA, 'kid-B': publicB } as Record<string, Uint8Array>,
  };
};

const validPayload = (overrides: Partial<LicensePayload> = {}): LicensePayload => ({
  tier: 'stardust',
  sub: 'install-uuid-1',
  iat: NOW_S - 3600,
  exp: NOW_S + 30 * 86400,
  kid: 'kid-A',
  ...overrides,
});

describe('services/licenseToken', () => {
  /* ----- Sign + verify roundtrip --------------------------------- */

  describe('sign + verify roundtrip', () => {
    it('a freshly signed token verifies with the matching public key', async () => {
      const { secretA, keyring } = await buildKeyring();
      const token = await signLicenseToken({
        payload: validPayload(),
        secretKey: secretA,
      });
      const result = await verifyLicenseToken({
        token,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.tier).toBe('stardust');
        expect(result.payload.sub).toBe('install-uuid-1');
      }
    });

    it('all three tiers round-trip', async () => {
      const { secretA, keyring } = await buildKeyring();
      for (const tier of ['stardust', 'polaris', 'owner'] as const) {
        const token = await signLicenseToken({
          payload: validPayload({ tier }),
          secretKey: secretA,
        });
        const result = await verifyLicenseToken({
          token,
          publicKeyring: keyring,
          nowSeconds: NOW_S,
        });
        if (!result.ok) throw new Error(`unexpected fail for ${tier}`);
        expect(result.payload.tier).toBe(tier);
      }
    });

    it('produces a base64url-friendly token (no +, /, =)', async () => {
      const { secretA } = await buildKeyring();
      const token = await signLicenseToken({
        payload: validPayload(),
        secretKey: secretA,
      });
      expect(token).not.toMatch(/[+/=]/);
      expect(token.startsWith('vector-license-v1.')).toBe(true);
    });
  });

  /* ----- Failure reasons ------------------------------------------ */

  describe('verifyLicenseToken — failure modes', () => {
    it('rejects malformed (wrong segment count)', async () => {
      const { keyring } = await buildKeyring();
      const result = await verifyLicenseToken({
        token: 'only-one-segment',
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('malformed');
    });

    it('rejects wrong-prefix tokens', async () => {
      const { secretA, keyring } = await buildKeyring();
      const good = await signLicenseToken({
        payload: validPayload(),
        secretKey: secretA,
      });
      const swapped = good.replace('vector-license-v1.', 'someone-else-v1.');
      const result = await verifyLicenseToken({
        token: swapped,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('wrong-prefix');
    });

    it('rejects tokens with bad-length signature', async () => {
      const result = await verifyLicenseToken({
        token: 'vector-license-v1.eyJ0aWVyIjoic3RhcmR1c3QifQ.shortsig',
        publicKeyring: {},
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('invalid-base64');
    });

    it('rejects payloads that are not JSON', async () => {
      const { secretA, keyring } = await buildKeyring();
      // Sign a junk payload manually so the signature passes but the
      // JSON parse step fails.
      const TEXT = new TextEncoder();
      const payloadB64 = btoa('not json at all')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
      const signing = `vector-license-v1.${payloadB64}`;
      const sig = await ed.signAsync(TEXT.encode(signing), secretA);
      const sigB64 = btoa(String.fromCharCode(...sig))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
      const result = await verifyLicenseToken({
        token: `vector-license-v1.${payloadB64}.${sigB64}`,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('invalid-payload-json');
    });

    it('rejects payloads with the wrong shape (missing tier)', async () => {
      const { secretA, keyring } = await buildKeyring();
      const TEXT = new TextEncoder();
      const json = JSON.stringify({ sub: 'x', iat: 1, exp: 2, kid: 'kid-A' });
      const payloadB64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const signing = `vector-license-v1.${payloadB64}`;
      const sig = await ed.signAsync(TEXT.encode(signing), secretA);
      const sigB64 = btoa(String.fromCharCode(...sig))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
      const result = await verifyLicenseToken({
        token: `vector-license-v1.${payloadB64}.${sigB64}`,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('invalid-payload-shape');
    });

    it('rejects unknown kid', async () => {
      const { secretA, keyring } = await buildKeyring();
      const token = await signLicenseToken({
        payload: validPayload({ kid: 'kid-NOT-IN-RING' }),
        secretKey: secretA,
      });
      const result = await verifyLicenseToken({
        token,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('unknown-kid');
    });

    it('rejects a token signed by a different secret than the kid claims', async () => {
      const { secretB, keyring } = await buildKeyring();
      // Claim kid-A but sign with secretB.
      const token = await signLicenseToken({
        payload: validPayload({ kid: 'kid-A' }),
        secretKey: secretB,
      });
      const result = await verifyLicenseToken({
        token,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('invalid-signature');
    });

    it('rejects an expired token', async () => {
      const { secretA, keyring } = await buildKeyring();
      const token = await signLicenseToken({
        payload: validPayload({ exp: NOW_S - 60 }),
        secretKey: secretA,
      });
      const result = await verifyLicenseToken({
        token,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('expired');
    });

    it('rejects a tampered payload (signature still over old payload)', async () => {
      const { secretA, keyring } = await buildKeyring();
      const token = await signLicenseToken({
        payload: validPayload({ tier: 'stardust' }),
        secretKey: secretA,
      });
      // Swap the payload segment for a hand-crafted "owner" payload.
      const TEXT = new TextEncoder();
      void TEXT;
      const tamperedJson = JSON.stringify(validPayload({ tier: 'owner' }));
      const tamperedB64 = btoa(tamperedJson)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
      const sig = token.split('.')[2];
      const tampered = `vector-license-v1.${tamperedB64}.${sig}`;
      const result = await verifyLicenseToken({
        token: tampered,
        publicKeyring: keyring,
        nowSeconds: NOW_S,
      });
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('invalid-signature');
    });
  });
});
