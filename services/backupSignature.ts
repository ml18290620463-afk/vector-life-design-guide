/**
 * Phase 4 §4.b-3 (backup integrity, Ed25519 signed backups) —
 * `services/backupSignature.ts`
 *
 * Signing strategy (read this before changing anything below):
 *
 * The migration package is a JSON file with `signature` + `publicKey`
 * fields nested at the top level (alongside `entries`, `customPersonas`,
 * etc). Signing happens AFTER `buildBackupExport` produces the
 * unsigned body. We then:
 *
 *   1. Compute `signature = Ed25519.sign(secretKey, encode(body))`
 *      where `body` is the unsigned JSON string from
 *      `buildBackupExport`.
 *   2. Re-emit the file with the same body + the two new fields
 *      injected as a sibling.
 *
 * Verifying:
 *
 *   1. Parse the file.
 *   2. Capture `signature` + `publicKey`.
 *   3. **Re-serialize the rest as the canonical body** by
 *      stripping the two fields from the parsed object then
 *      JSON.stringify-ing with the same `2`-space indent the
 *      exporter used.
 *   4. `Ed25519.verify(publicKey, encode(body), signature)`.
 *
 * Why this works without a formal canonicalization (JCS / RFC 8785):
 *
 *   - V8 / JSC / SpiderMonkey all preserve insertion order on
 *     object literals (mandated by ECMAScript since ES2015 for
 *     string keys), so `JSON.stringify` is deterministic for the
 *     payload shapes we ship.
 *   - We control BOTH ends of the wire (the same codebase signs
 *     and verifies), so the only attacks worth defending against
 *     are byte-for-byte file mutations — those any signature
 *     scheme catches.
 *
 * If we ever needed to interop with a non-VECTOR signer, switching
 * to JCS would be a one-line replacement of `canonicalizeForSigning`.
 */
import { ed } from './edBootstrap';

const SIGNATURE_FIELD = 'signature';
const PUBLIC_KEY_FIELD = 'publicKey';

const TEXT_ENCODER = new TextEncoder();

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

/* ------------------------------------------------------------------ */
/*  Sign                                                               */
/* ------------------------------------------------------------------ */

export interface SignBackupArgs {
  /** The unsigned canonical body JSON string (output of
   *  `buildBackupExport().content`). MUST be the exact bytes you
   *  intend to embed unmodified in the final file — sign / re-emit
   *  paths must agree on whitespace + indentation. */
  unsignedBody: string;
  /** The 32-byte raw Ed25519 secret key from
   *  `deviceKeypair.unlockSecretKey`. */
  secretKey: Uint8Array;
  /** The 32-byte raw Ed25519 public key, base64-encoded. Embedded
   *  alongside the signature so the verifier can run end-to-end
   *  without an out-of-band public-key delivery. */
  publicKey: string;
}

export interface SignBackupResult {
  /** The full signed file body, ready to write to disk / upload /
   *  hand to the user. JSON-formatted with 2-space indentation
   *  (matches `dashboardExport.buildBackupExport`). */
  signedBody: string;
  /** Just the signature, base64. Useful for tests / out-of-band
   *  delivery. */
  signature: string;
}

/** Produce a signed file body from an unsigned canonical body. */
export const signBackup = async ({
  unsignedBody,
  secretKey,
  publicKey,
}: SignBackupArgs): Promise<SignBackupResult> => {
  const sigBytes = await ed.signAsync(TEXT_ENCODER.encode(unsignedBody), secretKey);
  const signature = bytesToBase64(sigBytes);
  // Inject signature + publicKey as sibling top-level fields.
  // We parse, splice, and re-stringify — JSON.stringify preserves
  // insertion order, which is what the verifier will see.
  const parsed = JSON.parse(unsignedBody) as Record<string, unknown>;
  const reassembled: Record<string, unknown> = {};
  // Keep the two discriminator fields up-front so legacy parsers
  // still see them first when scanning.
  if ('type' in parsed) reassembled.type = parsed.type;
  if ('schemaVersion' in parsed) reassembled.schemaVersion = parsed.schemaVersion;
  // Inject the new fields here so they sit between schema metadata
  // and content blocks.
  reassembled[SIGNATURE_FIELD] = signature;
  reassembled[PUBLIC_KEY_FIELD] = publicKey;
  // Append every other field in its original order.
  for (const k of Object.keys(parsed)) {
    if (k === 'type' || k === 'schemaVersion') continue;
    reassembled[k] = parsed[k];
  }
  const signedBody = JSON.stringify(reassembled, null, 2);
  return { signedBody, signature };
};

/* ------------------------------------------------------------------ */
/*  Verify                                                             */
/* ------------------------------------------------------------------ */

export type VerifyBackupOutcome =
  | { ok: true; publicKey: string }
  | {
      ok: false;
      reason: 'unsigned' | 'malformed-signature' | 'malformed-public-key' | 'signature-invalid';
    };

/** Verify a signed file body. Returns the embedded `publicKey` on
 *  success so the caller can route to TOFU / trusted-devices logic. */
export const verifyBackup = async (signedBody: string): Promise<VerifyBackupOutcome> => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(signedBody) as Record<string, unknown>;
  } catch {
    // Pre-JSON failures land in dashboardImport's own validators
    // before we ever call verifyBackup; treating as unsigned here
    // keeps the wizard's error surface clean.
    return { ok: false, reason: 'unsigned' };
  }
  const signature = parsed[SIGNATURE_FIELD];
  const publicKey = parsed[PUBLIC_KEY_FIELD];
  if (typeof signature !== 'string' || signature.length === 0) {
    return { ok: false, reason: 'unsigned' };
  }
  if (typeof publicKey !== 'string' || publicKey.length === 0) {
    return { ok: false, reason: 'malformed-public-key' };
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64ToBytes(signature);
    if (sigBytes.length !== 64) throw new Error('wrong-length');
  } catch {
    return { ok: false, reason: 'malformed-signature' };
  }
  let pkBytes: Uint8Array;
  try {
    pkBytes = base64ToBytes(publicKey);
    if (pkBytes.length !== 32) throw new Error('wrong-length');
  } catch {
    return { ok: false, reason: 'malformed-public-key' };
  }
  // Reconstruct the canonical unsigned body the signer saw.
  const reassembled: Record<string, unknown> = {};
  for (const k of Object.keys(parsed)) {
    if (k === SIGNATURE_FIELD || k === PUBLIC_KEY_FIELD) continue;
    reassembled[k] = parsed[k];
  }
  const unsignedBody = JSON.stringify(reassembled, null, 2);
  let valid = false;
  try {
    valid = await ed.verifyAsync(sigBytes, TEXT_ENCODER.encode(unsignedBody), pkBytes);
  } catch (err) {
    console.warn('backupSignature: verifyAsync threw', err);
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'signature-invalid' };
  return { ok: true, publicKey };
};

/** Convenience: did this file even claim to be signed? Used by the
 *  wizard to differentiate "v4 unsigned migration" from "v5 signed
 *  migration with a broken signature". */
export const isBodySigned = (signedBody: string): boolean => {
  try {
    const parsed = JSON.parse(signedBody) as Record<string, unknown>;
    return (
      typeof parsed[SIGNATURE_FIELD] === 'string' && typeof parsed[PUBLIC_KEY_FIELD] === 'string'
    );
  } catch {
    return false;
  }
};
