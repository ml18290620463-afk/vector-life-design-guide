/**
 * Phase 4 §4.b-3 (backup integrity, Ed25519 signed backups) —
 * `services/trustedDevices.ts`
 *
 * TOFU (trust-on-first-use) registry for Ed25519 public keys the
 * user has confirmed belong to one of their own devices.
 *
 * The migration import wizard consults this list on every signed
 * package:
 *
 *   - **Known publicKey** → auto-pass (skip the
 *     "is this your old device?" confirmation).
 *   - **Unknown publicKey** → show the fingerprint to the user,
 *     ask them to read it from their old device's Settings page,
 *     and only proceed when they tap "Yes, this is my device".
 *     On confirm, the key is added to the trust list so future
 *     migrations from the same device skip the prompt.
 *
 * The list is per-install, stored in IndexedDB. Entries can be
 * revoked from Settings (Phase 5+ surface) but the data layer
 * supports it from day one.
 *
 * The whole module is a thin CRUD wrapper around `idb-keyval`. The
 * pure logic (`hydrateTrustedDevices`, `isTrusted`, `addTrust`,
 * `revokeTrust`) is unit-testable without IDB.
 */
import { get, set } from 'idb-keyval';
import { DiaryStorageKeys } from './diaryStorage';
import { fingerprintFromPublicKey } from './deviceKeypair';

export interface TrustedDevice {
  /** Raw 32-byte Ed25519 public key, base64. Identity column. */
  publicKey: string;
  /** Cached fingerprint so the trust-list view doesn't have to
   *  recompute SHA-256 for every row. Always
   *  `fingerprintFromPublicKey(publicKey)`. */
  fingerprint: string;
  /** Optional human label the user typed on confirmation
   *  ("My old iPhone", "Husband's MacBook"). Empty string allowed. */
  label: string;
  /** Epoch ms the user confirmed trust. */
  trustedAt: number;
}

const STORAGE_KEY = DiaryStorageKeys.trustedDevices;

const looksLikeTrustedDevice = (value: unknown): value is TrustedDevice => {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<TrustedDevice>;
  return (
    typeof t.publicKey === 'string' &&
    typeof t.fingerprint === 'string' &&
    typeof t.label === 'string' &&
    typeof t.trustedAt === 'number'
  );
};

/* ------------------------------------------------------------------ */
/*  Pure helpers (testable without IDB)                                */
/* ------------------------------------------------------------------ */

/** Hydrate an unknown blob (from IDB / a backup) into a sanitized
 *  array of `TrustedDevice`. Drops malformed entries. De-dupes by
 *  publicKey, keeping the most recent `trustedAt`. */
export const hydrateTrustedDevices = (raw: unknown): TrustedDevice[] => {
  if (!Array.isArray(raw)) return [];
  const sanitized = raw.filter(looksLikeTrustedDevice);
  // De-dup by publicKey, keep the most recent.
  const map = new Map<string, TrustedDevice>();
  for (const entry of sanitized) {
    const existing = map.get(entry.publicKey);
    if (!existing || entry.trustedAt >= existing.trustedAt) {
      map.set(entry.publicKey, entry);
    }
  }
  return Array.from(map.values());
};

/** Is this publicKey already trusted? */
export const isTrusted = (trusted: readonly TrustedDevice[], publicKey: string): boolean =>
  trusted.some((t) => t.publicKey === publicKey);

/** Pure: add a trust record (or update its label/timestamp if the key
 *  was already trusted). Returns a new array (no in-place mutation). */
export const addTrust = (
  trusted: readonly TrustedDevice[],
  publicKey: string,
  label: string,
  now: number = Date.now(),
): TrustedDevice[] => {
  const fingerprint = fingerprintFromPublicKey(publicKey);
  const without = trusted.filter((t) => t.publicKey !== publicKey);
  return [...without, { publicKey, fingerprint, label: label.slice(0, 80), trustedAt: now }];
};

/** Pure: remove a trust record by publicKey. Idempotent. */
export const revokeTrust = (
  trusted: readonly TrustedDevice[],
  publicKey: string,
): TrustedDevice[] => trusted.filter((t) => t.publicKey !== publicKey);

/** Pure: rename a trust record's `label` without changing
 *  `trustedAt`. Returns the same array reference when the label is
 *  unchanged or the key is absent (cheap no-op for React renders). */
export const relabelTrust = (
  trusted: readonly TrustedDevice[],
  publicKey: string,
  nextLabel: string,
): TrustedDevice[] => {
  const trimmed = nextLabel.slice(0, 80);
  let changed = false;
  const out = trusted.map((entry) => {
    if (entry.publicKey !== publicKey) return entry;
    if (entry.label === trimmed) return entry;
    changed = true;
    return { ...entry, label: trimmed };
  });
  return changed ? out : (trusted as TrustedDevice[]);
};

/* ------------------------------------------------------------------ */
/*  IDB-backed storage                                                 */
/* ------------------------------------------------------------------ */

const readStored = async (): Promise<TrustedDevice[]> => {
  try {
    const raw = await get(STORAGE_KEY).catch(() => null);
    return hydrateTrustedDevices(raw);
  } catch (err) {
    console.warn('trustedDevices: readStored failed', err);
    return [];
  }
};

const writeStored = async (next: readonly TrustedDevice[]): Promise<void> => {
  try {
    await set(STORAGE_KEY, [...next]);
  } catch (err) {
    console.warn('trustedDevices: writeStored failed', err);
    throw err;
  }
};

/** List all currently-trusted devices, most-recently-trusted first. */
export const listTrustedDevices = async (): Promise<TrustedDevice[]> => {
  const all = await readStored();
  return all.sort((a, b) => b.trustedAt - a.trustedAt);
};

/** Returns true when `publicKey` is in the trust store. */
export const isPublicKeyTrusted = async (publicKey: string): Promise<boolean> => {
  const all = await readStored();
  return isTrusted(all, publicKey);
};

/** Persist a trust record. Returns the resulting list. */
export const trustPublicKey = async (
  publicKey: string,
  label: string = '',
  now: number = Date.now(),
): Promise<TrustedDevice[]> => {
  const all = await readStored();
  const next = addTrust(all, publicKey, label, now);
  await writeStored(next);
  return next;
};

/** Revoke a trust record by publicKey. Returns the resulting list.
 *  Idempotent: revoking a key that wasn't trusted is a no-op. */
export const revokeTrustedPublicKey = async (publicKey: string): Promise<TrustedDevice[]> => {
  const all = await readStored();
  if (!isTrusted(all, publicKey)) return all;
  const next = revokeTrust(all, publicKey);
  await writeStored(next);
  return next;
};

/** Persist a label edit. Returns the resulting list. No-op when the
 *  key is absent or the label hasn't changed. */
export const relabelTrustedPublicKey = async (
  publicKey: string,
  nextLabel: string,
): Promise<TrustedDevice[]> => {
  const all = await readStored();
  const next = relabelTrust(all, publicKey, nextLabel);
  if (next === all) return all;
  await writeStored(next);
  return next;
};

/** For tests — wipe the trust store. NOT exported through public APIs. */
export const __resetTrustedDevicesForTests = async (): Promise<void> => {
  await writeStored([]);
};
