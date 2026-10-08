/**
 * Phase 5 §5.1 — `services/licenseToken.ts`
 *
 * Wire-format and verifier for VECTOR's offline license tokens.
 *
 * # Why offline tokens
 *
 * Our zero-knowledge tenet says we never want a server-side
 * "is this user allowed?" check before serving the local UI. So
 * the billing flow is:
 *
 *   1. User pays via Stripe Checkout (Phase 5.2).
 *   2. Stripe webhook hits a tiny VECTOR-team-operated **minter
 *      service** that holds an Ed25519 master private key.
 *   3. Minter signs a JSON `LicensePayload` and returns the
 *      serialised token to the browser.
 *   4. Client stores the token in IDB, verifies it locally
 *      against an embedded master public key, and uses the
 *      decoded `tier` for `quotaService` paywall checks.
 *
 * After step 4 the client never talks to the licensing layer
 * again until the token expires. Renewal is a fresh checkout in
 * Phase 5.3 (Customer Portal). Revocation: see `revoked` flag in
 * Phase 5.3 — for v1 we rely on `exp`.
 *
 * # Wire format
 *
 *   `vector-license-v1.<base64url-payload>.<base64url-signature>`
 *
 * - Three dot-separated segments, mirroring JWT but without the
 *   header (we hard-code Ed25519 for v1; if we ever rotate to a
 *   different curve, the version prefix bumps to
 *   `vector-license-v2.…`).
 * - `base64url` (RFC 4648 §5) — `+` → `-`, `/` → `_`, no padding —
 *   so tokens are URL-safe and can be pasted into a Settings text
 *   field without escaping.
 *
 * # Payload shape
 *
 *   ```json
 *   {
 *     "tier": "stardust" | "polaris" | "owner",
 *     "sub": "anonymous-installation-uuid",
 *     "iat": 1714521600,
 *     "exp": 1746057600,
 *     "kid": "vector-master-2026"
 *   }
 *   ```
 *
 * - `sub` is **the user's anonymous install id**, not an email.
 *   We don't want to learn the user's identity; the install id
 *   is what the user types in the Settings → Activate license
 *   form (or, in Phase 5.2, what Stripe passes in metadata).
 * - `kid` is the master-key id — when we rotate the signing key,
 *   we ship a NEW public key in the client and old tokens with
 *   the old `kid` continue to verify against the old key for a
 *   grace window.
 *
 * # Out of scope for v1
 *
 * - Online revocation list (CRL). Future phase.
 * - Signed quota envelopes (server-side per-token quota counter
 *   lands as Phase 5.4).
 * - Refund-driven instant revocation (Phase 5.3 deals with this).
 */
import { ed } from './edBootstrap';

const TOKEN_PREFIX = 'vector-license-v1';

export type LicenseTier = 'stardust' | 'polaris' | 'owner';

export interface LicensePayload {
  /** Tier the token grants. Note: 'free' is NEVER a token —
   *  free is the no-license default. */
  tier: LicenseTier;
  /** Anonymous installation id the token is bound to. Lets the
   *  client refuse a token that was signed for a different
   *  install (defence-in-depth against token sharing). */
  sub: string;
  /** Issued-at timestamp, **seconds** since the unix epoch
   *  (matches JWT convention so future log analysis is uniform). */
  iat: number;
  /** Expiry timestamp, seconds since the unix epoch. */
  exp: number;
  /** Master-key id. The client looks up the public key by `kid`
   *  in its embedded keyring; missing-key means the token was
   *  signed by a key the client doesn't trust (e.g. a forged
   *  test minter). */
  kid: string;
}

/* ------------------------------------------------------------------ */
/*  Codecs                                                             */
/* ------------------------------------------------------------------ */

const TEXT = new TextEncoder();
const TEXT_DECODE = new TextDecoder();

/** RFC 4648 §5 base64url, no padding. Both browser-safe and
 *  noble-friendly. */
const bytesToBase64Url = (bytes: Uint8Array): string => {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};
const base64UrlToBytes = (b64: string): Uint8Array => {
  // Restore padding so atob is happy.
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = padded.length % 4;
  const padding = remainder === 0 ? '' : '='.repeat(4 - remainder);
  const str = atob(padded + padding);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i);
  return out;
};

const stringToBase64Url = (s: string): string => bytesToBase64Url(TEXT.encode(s));
const base64UrlToString = (b: string): string => TEXT_DECODE.decode(base64UrlToBytes(b));

/* ------------------------------------------------------------------ */
/*  Sign                                                               */
/* ------------------------------------------------------------------ */

export interface SignLicenseArgs {
  payload: LicensePayload;
  /** 32-byte raw Ed25519 secret key. Held by the VECTOR-team
   *  minter; never present in client builds. */
  secretKey: Uint8Array;
}

/** Produce a signed token string. Used by the dev minter
 *  (`scripts/dev-mint-license.mjs`) and, in Phase 5.2, by the
 *  Stripe webhook handler. */
export const signLicenseToken = async ({
  payload,
  secretKey,
}: SignLicenseArgs): Promise<string> => {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = stringToBase64Url(payloadJson);
  const signing = `${TOKEN_PREFIX}.${payloadB64}`;
  const sigBytes = await ed.signAsync(TEXT.encode(signing), secretKey);
  const sigB64 = bytesToBase64Url(sigBytes);
  return `${TOKEN_PREFIX}.${payloadB64}.${sigB64}`;
};

/* ------------------------------------------------------------------ */
/*  Verify                                                             */
/* ------------------------------------------------------------------ */

export type LicenseVerifyFailure =
  | 'malformed'
  | 'wrong-prefix'
  | 'invalid-base64'
  | 'invalid-payload-json'
  | 'invalid-payload-shape'
  | 'unknown-kid'
  | 'invalid-signature'
  | 'expired';

export type LicenseVerifyResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: LicenseVerifyFailure };

export interface VerifyLicenseArgs {
  token: string;
  /** Map from `kid` to the 32-byte raw Ed25519 public key. The
   *  client embeds this map at build time; rotation = ship a new
   *  build with both old and new kids in the map for the grace
   *  window. */
  publicKeyring: Readonly<Record<string, Uint8Array>>;
  /** Inject `Date.now()` for tests. Default uses real time. */
  nowSeconds?: number;
}

const looksLikePayload = (value: unknown): value is LicensePayload => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<LicensePayload>;
  if (v.tier !== 'stardust' && v.tier !== 'polaris' && v.tier !== 'owner') return false;
  if (typeof v.sub !== 'string' || v.sub.length === 0) return false;
  if (typeof v.iat !== 'number' || v.iat <= 0) return false;
  if (typeof v.exp !== 'number' || v.exp <= 0) return false;
  if (typeof v.kid !== 'string' || v.kid.length === 0) return false;
  return true;
};

/** Offline verifier. Returns the payload on success. Caller
 *  should additionally check `payload.sub === installId` if the
 *  install-binding policy is enabled (we do that in
 *  `licenseStore`). */
export const verifyLicenseToken = async (args: VerifyLicenseArgs): Promise<LicenseVerifyResult> => {
  const parts = args.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [prefix, payloadB64, sigB64] = parts;
  if (prefix !== TOKEN_PREFIX) return { ok: false, reason: 'wrong-prefix' };

  let payloadJson: string;
  let sigBytes: Uint8Array;
  try {
    payloadJson = base64UrlToString(payloadB64);
    sigBytes = base64UrlToBytes(sigB64);
    if (sigBytes.length !== 64) throw new Error('bad-sig-length');
  } catch {
    return { ok: false, reason: 'invalid-base64' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, reason: 'invalid-payload-json' };
  }
  if (!looksLikePayload(payload)) {
    return { ok: false, reason: 'invalid-payload-shape' };
  }

  const publicKey = args.publicKeyring[payload.kid];
  if (!publicKey || publicKey.length !== 32) {
    return { ok: false, reason: 'unknown-kid' };
  }

  const signing = `${TOKEN_PREFIX}.${payloadB64}`;
  let valid = false;
  try {
    valid = await ed.verifyAsync(sigBytes, TEXT.encode(signing), publicKey);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'invalid-signature' };

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
};

/* ------------------------------------------------------------------ */
/*  Master public keyring (embedded in the client)                     */
/* ------------------------------------------------------------------ */

/**
 * The production master public key. Imported from
 * `lib/licenseKeyring.ts` so this service stays pure-data — the
 * keyring is the only file that needs touching when we rotate
 * keys.
 *
 * Tests build their own keyring via `signLicenseToken` so this
 * default is only consulted in real builds.
 */
export { LICENSE_KEYRING } from '../lib/licenseKeyring';
