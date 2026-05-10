import { get, set, del } from 'idb-keyval';
import { DiaryStorageKeys } from './diaryStorage';
import {
  LICENSE_KEYRING,
  verifyLicenseToken,
  type LicensePayload,
  type LicenseVerifyFailure,
} from './licenseToken';
import { generateSecureId } from './idGenerator';

/**
 * Phase 5 §5.1 — `services/licenseStore.ts`
 *
 * Persists the **license token** + **anonymous install id** in
 * IndexedDB and exposes a small CRUD surface the React layer
 * (`hooks/useLicense`) wraps for the Settings UI.
 *
 * # Install id
 *
 * The install id is a random 32-char base32 string generated on
 * the **first** call to `getOrCreateInstallId`. It is:
 *
 *   - **anonymous** (not derived from any user-controlled
 *     identity — no email, no fingerprint).
 *   - **per-device** (different across browser profiles, lost on
 *     "Wipe data").
 *   - **embedded into the license token** as `payload.sub` when
 *     the user goes through Stripe Checkout (Phase 5.2). The
 *     client refuses tokens whose `sub` doesn't match the
 *     install id, so a leaked token is useless on a different
 *     device unless the user manually copies BOTH the token and
 *     their install id.
 *
 * The install id is also displayed in Settings (Phase 5.1 / 5.2
 * UI) so users can paste it into the Stripe Checkout form during
 * the upgrade flow.
 *
 * # License lifecycle
 *
 *   - `loadLicense(installId, now?)` — reads the IDB blob, runs
 *     `verifyLicenseToken` against the embedded keyring, and
 *     additionally checks `payload.sub === installId`. Returns
 *     a tagged result so the UI can show the right error message.
 *   - `saveLicense(token, installId)` — verifies before persisting
 *     and refuses to write a bad token. Returns the verify result.
 *   - `clearLicense()` — explicit "I cancelled my subscription"
 *     wipe. Idempotent.
 *
 * The store is the only consumer of `LICENSE_KEYRING`; everything
 * else (the React hook, the quota service) reads from the store's
 * `loadLicense` result.
 */

const STORAGE_KEY = DiaryStorageKeys.license;
const INSTALL_ID_STORAGE_KEY = 'vector_install_id';

interface StoredLicense {
  token: string;
  installId: string;
  activatedAt: number;
}

const looksLikeStored = (value: unknown): value is StoredLicense => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<StoredLicense>;
  return (
    typeof v.token === 'string' &&
    typeof v.installId === 'string' &&
    typeof v.activatedAt === 'number'
  );
};

/* ------------------------------------------------------------------ */
/*  Install id                                                         */
/* ------------------------------------------------------------------ */

/** Returns the device's anonymous install id, generating one on
 *  first call. Persists to localStorage so the id survives across
 *  IDB wipes (the install id is NOT secret; the license token's
 *  `sub` binding is what makes it useful). */
export const getOrCreateInstallId = (): string => {
  if (typeof window === 'undefined') return 'server-side';
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_STORAGE_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh = generateSecureId('install');
    window.localStorage.setItem(INSTALL_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / Safari ITP fallback — generate a per-session
    // id; the license sub-check will fail on the next reload, but
    // that's the user's call (we don't want to brick the
    // experience just because storage is unavailable).
    return generateSecureId('install');
  }
};

/** For tests — wipe the cached install id so the next call mints
 *  a fresh one. NOT exported through the public surface. */
export const __resetInstallIdForTests = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(INSTALL_ID_STORAGE_KEY);
  } catch {
    // ignore
  }
};

/* ------------------------------------------------------------------ */
/*  License storage                                                    */
/* ------------------------------------------------------------------ */

const readStored = async (): Promise<StoredLicense | null> => {
  try {
    const raw = await get(STORAGE_KEY).catch(() => null);
    if (!looksLikeStored(raw)) return null;
    return raw;
  } catch {
    return null;
  }
};

const writeStored = async (value: StoredLicense): Promise<void> => {
  await set(STORAGE_KEY, value);
};

export type LoadLicenseFailure = LicenseVerifyFailure | 'no-token' | 'install-mismatch';

export type LoadLicenseResult =
  | { ok: true; payload: LicensePayload; activatedAt: number }
  | { ok: false; reason: LoadLicenseFailure };

/** Load + verify the persisted license. Returns `{ ok: false,
 *  reason: 'no-token' }` when the user has never activated a
 *  license; the React hook treats that as the silent default
 *  (no error toast, just keep the user in 'free'). */
export const loadLicense = async (
  installId: string,
  nowSeconds?: number,
): Promise<LoadLicenseResult> => {
  const stored = await readStored();
  if (!stored) return { ok: false, reason: 'no-token' };
  const verify = await verifyLicenseToken({
    token: stored.token,
    publicKeyring: LICENSE_KEYRING,
    nowSeconds,
  });
  if (verify.ok === false) {
    return { ok: false, reason: verify.reason };
  }
  if (verify.payload.sub !== installId) {
    return { ok: false, reason: 'install-mismatch' };
  }
  return { ok: true, payload: verify.payload, activatedAt: stored.activatedAt };
};

export type SaveLicenseResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: LoadLicenseFailure };

/** Verify-then-persist a token. Refuses to write when the token
 *  is invalid (so a paste of garbage doesn't end up in IDB and
 *  cause confusing follow-up errors on next load). */
export const saveLicense = async (
  token: string,
  installId: string,
  nowSeconds?: number,
): Promise<SaveLicenseResult> => {
  const verify = await verifyLicenseToken({
    token,
    publicKeyring: LICENSE_KEYRING,
    nowSeconds,
  });
  if (verify.ok === false) return { ok: false, reason: verify.reason };
  if (verify.payload.sub !== installId) {
    return { ok: false, reason: 'install-mismatch' };
  }
  await writeStored({
    token,
    installId,
    activatedAt: Date.now(),
  });
  return { ok: true, payload: verify.payload };
};

/** Idempotent — wipes the stored license. */
export const clearLicense = async (): Promise<void> => {
  try {
    await del(STORAGE_KEY);
  } catch {
    // best-effort
  }
};

/** For tests — wipe the IDB blob so subsequent loadLicense calls
 *  start clean. */
export const __resetLicenseForTests = async (): Promise<void> => {
  await clearLicense();
};
