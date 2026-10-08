import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ed } from './edBootstrap';
import {
  __resetInstallIdForTests,
  __resetLicenseForTests,
  getOrCreateInstallId,
  loadLicense,
  saveLicense,
  clearLicense,
} from './licenseStore';
import { signLicenseToken, type LicensePayload } from './licenseToken';
import * as keyringModule from '../lib/licenseKeyring';

const NOW_S = Math.floor(Date.UTC(2026, 4, 1) / 1000);

const validPayload = (
  installId: string,
  overrides: Partial<LicensePayload> = {},
): LicensePayload => ({
  tier: 'stardust',
  sub: installId,
  iat: NOW_S - 3600,
  exp: NOW_S + 30 * 86400,
  kid: 'test-kid',
  ...overrides,
});

describe('services/licenseStore', () => {
  let secretKey: Uint8Array;
  let publicKey: Uint8Array;
  /** Snapshot the embedded keyring so we can swap it for a
   *  test keypair. */
  let originalKeyring: typeof keyringModule.LICENSE_KEYRING;

  beforeEach(async () => {
    await __resetLicenseForTests();
    __resetInstallIdForTests();
    secretKey = ed.utils.randomSecretKey();
    publicKey = await ed.getPublicKeyAsync(secretKey);
    originalKeyring = keyringModule.LICENSE_KEYRING;
    // Mutate the exported map so loadLicense / saveLicense pick up
    // our test public key under a stable kid.
    Object.defineProperty(keyringModule, 'LICENSE_KEYRING', {
      configurable: true,
      get: () => ({ 'test-kid': publicKey }),
    });
  });

  afterEach(async () => {
    await __resetLicenseForTests();
    __resetInstallIdForTests();
    Object.defineProperty(keyringModule, 'LICENSE_KEYRING', {
      configurable: true,
      get: () => originalKeyring,
    });
  });

  describe('getOrCreateInstallId', () => {
    it('mints a fresh id on first call and reuses it on subsequent calls', () => {
      const a = getOrCreateInstallId();
      expect(a).toMatch(/^install-/);
      const b = getOrCreateInstallId();
      expect(b).toBe(a);
    });
  });

  describe('saveLicense', () => {
    it('persists a valid token', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload(installId),
        secretKey,
      });
      const result = await saveLicense(token, installId, NOW_S);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.payload.tier).toBe('stardust');
    });

    it('refuses an expired token (does NOT persist)', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload(installId, { exp: NOW_S - 60 }),
        secretKey,
      });
      const result = await saveLicense(token, installId, NOW_S);
      expect(result.ok).toBe(false);
      if (result.ok !== false) throw new Error('expected fail');
      expect(result.reason).toBe('expired');
      // Verify nothing was persisted.
      const loaded = await loadLicense(installId, NOW_S);
      if (loaded.ok !== false) throw new Error('expected fail');
      expect(loaded.reason).toBe('no-token');
    });

    it('refuses a token whose sub does not match the install id', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload('install-OTHER'),
        secretKey,
      });
      const result = await saveLicense(token, installId, NOW_S);
      if (result.ok !== false) throw new Error('expected fail');
      expect(result.reason).toBe('install-mismatch');
    });
  });

  describe('loadLicense', () => {
    it('returns no-token on a fresh install', async () => {
      const installId = getOrCreateInstallId();
      const result = await loadLicense(installId, NOW_S);
      if (result.ok !== false) throw new Error('expected fail');
      expect(result.reason).toBe('no-token');
    });

    it('round-trips a freshly-saved token', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload(installId, { tier: 'polaris' }),
        secretKey,
      });
      await saveLicense(token, installId, NOW_S);
      const loaded = await loadLicense(installId, NOW_S);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) expect(loaded.payload.tier).toBe('polaris');
    });

    it('returns expired when wall clock has moved past payload.exp', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload(installId, { exp: NOW_S + 60 }),
        secretKey,
      });
      await saveLicense(token, installId, NOW_S);
      // Re-load with a clock 2 minutes later.
      const loaded = await loadLicense(installId, NOW_S + 120);
      if (loaded.ok !== false) throw new Error('expected fail');
      expect(loaded.reason).toBe('expired');
    });
  });

  describe('clearLicense', () => {
    it('wipes the stored token', async () => {
      const installId = getOrCreateInstallId();
      const token = await signLicenseToken({
        payload: validPayload(installId),
        secretKey,
      });
      await saveLicense(token, installId, NOW_S);
      await clearLicense();
      const loaded = await loadLicense(installId, NOW_S);
      if (loaded.ok !== false) throw new Error('expected fail');
      expect(loaded.reason).toBe('no-token');
    });

    it('is idempotent', async () => {
      await expect(clearLicense()).resolves.toBeUndefined();
      await expect(clearLicense()).resolves.toBeUndefined();
    });
  });
});
