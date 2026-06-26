import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLicense } from './useLicense';
import {
  __resetInstallIdForTests,
  __resetLicenseForTests,
  getOrCreateInstallId,
} from '../services/licenseStore';
import { ed } from '../services/edBootstrap';
import { signLicenseToken, type LicensePayload } from '../services/licenseToken';
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

describe('useLicense', () => {
  let secretKey: Uint8Array;
  let publicKey: Uint8Array;
  let originalKeyring: typeof keyringModule.LICENSE_KEYRING;

  beforeEach(async () => {
    await __resetLicenseForTests();
    __resetInstallIdForTests();
    secretKey = ed.utils.randomSecretKey();
    publicKey = await ed.getPublicKeyAsync(secretKey);
    originalKeyring = keyringModule.LICENSE_KEYRING;
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

  it('hydrates with installId, currentTier=free + no failure on a fresh device', async () => {
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.installId).toMatch(/^install-/);
    expect(result.current.currentTier).toBe('free');
    expect(result.current.failure).toBeNull();
    expect(result.current.payload).toBeNull();
  });

  it('activate() persists a valid token and flips currentTier to the paid tier', async () => {
    const installId = getOrCreateInstallId();
    const token = await signLicenseToken({
      payload: validPayload(installId, { tier: 'polaris' }),
      secretKey,
    });
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.activate(token);
    });
    expect(outcome).toBeNull();
    expect(result.current.currentTier).toBe('polaris');
    expect(result.current.payload?.tier).toBe('polaris');
  });

  it('activate() with a bad token sets failure + keeps currentTier=free', async () => {
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.activate('not-a-real-token');
    });
    expect(outcome).toBe('malformed');
    expect(result.current.failure).toBe('malformed');
    expect(result.current.currentTier).toBe('free');
  });

  it('activate() with install-mismatch surfaces the mismatch reason', async () => {
    const token = await signLicenseToken({
      payload: validPayload('install-OTHER'),
      secretKey,
    });
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.activate(token);
    });
    expect(result.current.failure).toBe('install-mismatch');
    expect(result.current.currentTier).toBe('free');
  });

  it('deactivate() drops the token + flips currentTier back to free', async () => {
    const installId = getOrCreateInstallId();
    const token = await signLicenseToken({
      payload: validPayload(installId),
      secretKey,
    });
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.activate(token);
    });
    expect(result.current.currentTier).toBe('stardust');
    await act(async () => {
      await result.current.deactivate();
    });
    expect(result.current.currentTier).toBe('free');
    expect(result.current.payload).toBeNull();
  });

  it('reload() picks up tokens written by another caller', async () => {
    const installId = getOrCreateInstallId();
    const { result } = renderHook(() => useLicense());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentTier).toBe('free');
    const { saveLicense } = await import('../services/licenseStore');
    const token = await signLicenseToken({
      payload: validPayload(installId, { tier: 'owner' }),
      secretKey,
    });
    await saveLicense(token, installId);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.currentTier).toBe('owner');
  });
});
