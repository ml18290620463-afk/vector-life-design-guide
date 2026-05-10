import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isBodySigned, signBackup, verifyBackup } from './backupSignature';
import { ed } from './edBootstrap';
import {
  __resetDeviceKeypairForTests,
  ensureDeviceKeypair,
  unlockSecretKey,
} from './deviceKeypair';

const PASSWORD = 'pw-for-tests';

const buildUnsignedBody = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify(
    {
      type: 'vector-vault-backup',
      schemaVersion: 5,
      version: 'v1.2.3',
      exportedAt: '2026-05-01T10:20:30.000Z',
      entryCount: 0,
      entries: [],
      ...extra,
    },
    null,
    2,
  );

describe('services/backupSignature', () => {
  beforeEach(async () => {
    await __resetDeviceKeypairForTests();
  });
  afterEach(async () => {
    await __resetDeviceKeypairForTests();
  });

  describe('signBackup → verifyBackup roundtrip', () => {
    it('a freshly-signed body verifies', async () => {
      const identity = await ensureDeviceKeypair(PASSWORD);
      const secret = await unlockSecretKey(PASSWORD);
      if (!secret) throw new Error('expected secret');
      const unsigned = buildUnsignedBody();
      const { signedBody, signature } = await signBackup({
        unsignedBody: unsigned,
        secretKey: secret,
        publicKey: identity.publicKey,
      });
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
      const result = await verifyBackup(signedBody);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.publicKey).toBe(identity.publicKey);
    });

    it('signed body is fresh JSON with `signature` + `publicKey` injected after the discriminators', async () => {
      const identity = await ensureDeviceKeypair(PASSWORD);
      const secret = await unlockSecretKey(PASSWORD);
      if (!secret) throw new Error('expected secret');
      const { signedBody } = await signBackup({
        unsignedBody: buildUnsignedBody(),
        secretKey: secret,
        publicKey: identity.publicKey,
      });
      const keys = Object.keys(JSON.parse(signedBody));
      expect(keys.slice(0, 4)).toEqual(['type', 'schemaVersion', 'signature', 'publicKey']);
    });

    it('a tampered body fails verification', async () => {
      const identity = await ensureDeviceKeypair(PASSWORD);
      const secret = await unlockSecretKey(PASSWORD);
      if (!secret) throw new Error('expected secret');
      const { signedBody } = await signBackup({
        unsignedBody: buildUnsignedBody(),
        secretKey: secret,
        publicKey: identity.publicKey,
      });
      // Inject a fake entry into the signed body.
      const parsed = JSON.parse(signedBody);
      parsed.entries = [{ id: 'fake', title: 'evil', content: 'evil', createdAt: 1, tags: [] }];
      parsed.entryCount = 1;
      const tampered = JSON.stringify(parsed, null, 2);
      const result = await verifyBackup(tampered);
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('signature-invalid');
    });

    it('a body signed by device A and presented under device B public key fails', async () => {
      // Device A signs.
      const identityA = await ensureDeviceKeypair(PASSWORD);
      const secretA = await unlockSecretKey(PASSWORD);
      if (!secretA) throw new Error('expected secret');
      const { signedBody } = await signBackup({
        unsignedBody: buildUnsignedBody(),
        secretKey: secretA,
        publicKey: identityA.publicKey,
      });
      // Replace publicKey field with a different real key (so format is right but key wrong).
      const otherSecret = ed.utils.randomSecretKey();
      const otherPub = await ed.getPublicKeyAsync(otherSecret);
      let otherPubB64 = '';
      for (let i = 0; i < otherPub.length; i += 1) otherPubB64 += String.fromCharCode(otherPub[i]);
      otherPubB64 = btoa(otherPubB64);
      const swapped = signedBody.replace(identityA.publicKey, otherPubB64);
      const result = await verifyBackup(swapped);
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('signature-invalid');
    });
  });

  describe('verifyBackup error reasons', () => {
    it('returns `unsigned` for a body with no signature field', async () => {
      const result = await verifyBackup(buildUnsignedBody());
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('unsigned');
    });

    it('returns `unsigned` for a non-JSON body', async () => {
      const result = await verifyBackup('not json');
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('unsigned');
    });

    it('returns `malformed-signature` for a wrong-length signature', async () => {
      const body = JSON.stringify(
        { type: 'vector-vault-backup', signature: 'short', publicKey: 'x'.repeat(44) },
        null,
        2,
      );
      const result = await verifyBackup(body);
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('malformed-signature');
    });

    it('returns `malformed-public-key` for a wrong-length public key', async () => {
      // base64-encoded 64 bytes of 0x00 → 'AAAA..A=' (88 chars w/ '=' padding).
      const fakeSig = btoa(String.fromCharCode.apply(null, new Array(64).fill(0)));
      const body = JSON.stringify(
        { type: 'vector-vault-backup', signature: fakeSig, publicKey: 'tooshort' },
        null,
        2,
      );
      const result = await verifyBackup(body);
      if (result.ok !== false) throw new Error('expected failure');
      expect(result.reason).toBe('malformed-public-key');
    });
  });

  describe('isBodySigned', () => {
    it('returns true for a signed body', async () => {
      const identity = await ensureDeviceKeypair(PASSWORD);
      const secret = await unlockSecretKey(PASSWORD);
      if (!secret) throw new Error('expected secret');
      const { signedBody } = await signBackup({
        unsignedBody: buildUnsignedBody(),
        secretKey: secret,
        publicKey: identity.publicKey,
      });
      expect(isBodySigned(signedBody)).toBe(true);
    });
    it('returns false for an unsigned body', () => {
      expect(isBodySigned(buildUnsignedBody())).toBe(false);
    });
    it('returns false for non-JSON', () => {
      expect(isBodySigned('not json')).toBe(false);
    });
  });
});
