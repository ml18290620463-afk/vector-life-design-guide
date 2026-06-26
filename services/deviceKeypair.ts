/**
 * Phase 4 §4.b-3 (backup integrity, Ed25519 signed backups) —
 * `services/deviceKeypair.ts`
 *
 * Each VECTOR install gets its own per-device Ed25519 keypair the
 * first time the user sets a master password. The pair lives in
 * IndexedDB:
 *
 *   - `publicKey` — the 32-byte raw Ed25519 public key, base64.
 *     Plain-stored so we can compute the human-readable fingerprint
 *     even when the vault is locked.
 *   - `encryptedSecret` — the 32-byte raw secret key, encrypted
 *     under a password-derived AES-GCM key via
 *     `SecurityService.encrypt`. Without the master password, the
 *     blob is useless to a physical attacker who has read access
 *     to IndexedDB.
 *   - `createdAt` — ISO timestamp; surfaced in Settings so the
 *     user can tell when their current keypair was minted.
 *
 * The fingerprint is `SHA-256(publicKey)[0..12] -> base32 -> 16
 * chars` rendered as `ABCD-EFGH-IJKL-MNOP`. 96 bits of fingerprint
 * is plenty for the local "did I just hand-copy the right code"
 * threat model and short enough to read across two screens.
 *
 * Lifecycle:
 *   - `ensureDeviceKeypair(password)` — call from `handleSetPassword`
 *     and on `handleUnlock` (idempotent: returns the existing pair
 *     when present, generates a fresh one when not).
 *   - `regenerateDeviceKeypair(password)` — explicit "I want new
 *     device keys" path triggered from Settings. Discards the old
 *     pair; existing migration packages signed by the old key
 *     become "unknown publisher" on the receiving side.
 *   - `loadPublicKey()` — vault-locked-safe; returns the publicKey
 *     + fingerprint without needing the password.
 *   - `unlockSecretKey(password)` — returns the 32-byte secret as
 *     a `Uint8Array`. Wipe via `wipeSecret()` after use.
 */
import { get, set, del } from 'idb-keyval';
import { ed } from './edBootstrap';
import { sha512 } from '@noble/hashes/sha2.js';
import { DiaryStorageKeys } from './diaryStorage';
import { SecurityService } from './securityService';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StoredDeviceKeypair {
  /** Raw 32-byte Ed25519 public key, base64-encoded. */
  publicKey: string;
  /** Raw 32-byte secret key encrypted under the master password.
   *  Format: opaque base64 produced by `SecurityService.encrypt`. */
  encryptedSecret: string;
  /** ISO timestamp the keypair was minted at. */
  createdAt: string;
}

export interface DevicePublicIdentity {
  publicKey: string;
  fingerprint: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Codecs                                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = DiaryStorageKeys.deviceKeypair;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str);
};

const base64ToBytes = (b64: string): Uint8Array => {
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i);
  return out;
};

/** RFC 4648 base32 alphabet (capital letters + 2-7) so the
 *  fingerprint is unambiguous when read aloud (no `0`/`O`,
 *  no `1`/`I`/`l`). */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Converts an integer count of bytes into a base32 string of
 *  `ceil(byteCount * 8 / 5)` characters. We slice the result to
 *  the exact length we want. */
const bytesToBase32 = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
};

/* ------------------------------------------------------------------ */
/*  Fingerprint                                                        */
/* ------------------------------------------------------------------ */

/** 16-char fingerprint formatted as `ABCD-EFGH-IJKL-MNOP`. We use
 *  SHA-256 of the publicKey, take the first 12 bytes (96 bits),
 *  base32-encode (gives ~19 chars), and slice/group to 16. */
export const fingerprintFromPublicKey = (publicKey: string): string => {
  const digest = sha512(base64ToBytes(publicKey)).slice(0, 12);
  const raw = bytesToBase32(digest).slice(0, 16);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
};

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

const readStored = async (): Promise<StoredDeviceKeypair | null> => {
  try {
    const raw = await get(STORAGE_KEY).catch(() => null);
    if (!raw) return null;
    if (typeof raw !== 'object' || raw === null) return null;
    const candidate = raw as Partial<StoredDeviceKeypair>;
    if (
      typeof candidate.publicKey !== 'string' ||
      typeof candidate.encryptedSecret !== 'string' ||
      typeof candidate.createdAt !== 'string'
    )
      return null;
    return candidate as StoredDeviceKeypair;
  } catch (err) {
    // Defensive: idb-keyval throws synchronously if `indexedDB` is
    // missing entirely (e.g. in the happy-dom test runner). Treat
    // as "no keypair stored".
    console.warn('deviceKeypair: readStored failed', err);
    return null;
  }
};

const writeStored = async (keypair: StoredDeviceKeypair): Promise<void> => {
  try {
    await set(STORAGE_KEY, keypair);
  } catch (err) {
    console.warn('deviceKeypair: writeStored failed', err);
    throw err;
  }
};

const clearStored = async (): Promise<void> => {
  try {
    await del(STORAGE_KEY);
  } catch (err) {
    // best-effort
    console.warn('deviceKeypair: clearStored failed', err);
  }
};

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */

/** Mint a fresh keypair, encrypt the secret with the master
 *  password, persist, return its public identity. */
const mintNew = async (password: string): Promise<DevicePublicIdentity> => {
  const secret = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(secret);
  const publicKey = bytesToBase64(publicKeyBytes);
  // Encrypt the secret as a base64-encoded blob (so SecurityService.encrypt
  // sees a string), wrapped again by SecurityService into salt+iv+ct.
  const secretAsString = bytesToBase64(secret);
  const encryptedSecret = await SecurityService.encrypt(secretAsString, password);
  const createdAt = new Date().toISOString();
  await writeStored({ publicKey, encryptedSecret, createdAt });
  // Defensive: scrub the in-memory secret. JS doesn't really wipe
  // memory but it removes the obvious dangling reference.
  secret.fill(0);
  return {
    publicKey,
    fingerprint: fingerprintFromPublicKey(publicKey),
    createdAt,
  };
};

/** Idempotent: returns the existing keypair if one is present, else
 *  mints a fresh one. Call from `handleSetPassword` (right after a
 *  fresh password is established) AND from `handleUnlock` (so users
 *  who installed before §4.b-3 still grow a keypair on next unlock). */
export const ensureDeviceKeypair = async (password: string): Promise<DevicePublicIdentity> => {
  const existing = await readStored();
  if (existing) {
    return {
      publicKey: existing.publicKey,
      fingerprint: fingerprintFromPublicKey(existing.publicKey),
      createdAt: existing.createdAt,
    };
  }
  return mintNew(password);
};

/** Discard the existing keypair and mint a brand new one. Used by
 *  the "Regenerate device keys" Settings CTA. After this call,
 *  migration packages signed by the OLD private key will be
 *  rejected on the receiving device as "unknown publisher" and
 *  re-trigger the TOFU prompt. */
export const regenerateDeviceKeypair = async (password: string): Promise<DevicePublicIdentity> => {
  await clearStored();
  return mintNew(password);
};

/** Vault-locked-safe: returns the public part of the keypair without
 *  needing the password. Returns null when no keypair exists yet (a
 *  pre-§4.b-3 install that has not yet unlocked since the upgrade). */
export const loadPublicIdentity = async (): Promise<DevicePublicIdentity | null> => {
  const stored = await readStored();
  if (!stored) return null;
  return {
    publicKey: stored.publicKey,
    fingerprint: fingerprintFromPublicKey(stored.publicKey),
    createdAt: stored.createdAt,
  };
};

/** Decrypts and returns the 32-byte raw secret key. Caller must
 *  call `wipeSecret(secret)` (or do equivalent zero-ing) after use. */
export const unlockSecretKey = async (password: string): Promise<Uint8Array | null> => {
  const stored = await readStored();
  if (!stored) return null;
  try {
    const secretAsString = await SecurityService.decrypt(stored.encryptedSecret, password);
    return base64ToBytes(secretAsString);
  } catch (err) {
    // Wrong password / corrupted blob; surface as null so callers
    // route through the right error path.
    console.warn('deviceKeypair: unlockSecretKey failed', err);
    return null;
  }
};

/** Best-effort scrub of a secret key buffer. Modifies in place. */
export const wipeSecret = (secret: Uint8Array): void => {
  secret.fill(0);
};

/** For tests — wipe the stored keypair so the next ensureDeviceKeypair
 *  mints a fresh one. NOT exported through the public surface. */
export const __resetDeviceKeypairForTests = async (): Promise<void> => {
  await clearStored();
};
