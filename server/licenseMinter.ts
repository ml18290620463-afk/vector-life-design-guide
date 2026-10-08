import { signLicenseToken, type LicensePayload, type LicenseTier } from '../services/licenseToken';

/**
 * Phase 5.2 — `server/licenseMinter.ts`
 *
 * Server-only Ed25519 signer for VECTOR license tokens. The
 * Stripe webhook calls `mintToken` after `checkout.session.completed`
 * fires; the minted token is bounced back to the user via
 * `success_url=/settings?activate=<token>`.
 *
 * # Master key bootstrap
 *
 * The signer holds the 32-byte raw Ed25519 secret in
 * `process.env.VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64`. The env
 * var is read **once** at module bootstrap (`createMinter`) and
 * the resulting bytes are wrapped in a `Uint8Array` that's never
 * re-exposed:
 *
 *   - `mintToken` is the only public surface; it accepts the
 *     payload data and returns the signed token.
 *   - `getDevSafePublicKey` returns ONLY the public key (matched
 *     to the secret) — useful for an `/api/health` check that
 *     proves "the minter is alive AND its key matches the kid in
 *     LICENSE_KEYRING".
 *   - The secret bytes are never logged, never serialised, never
 *     leave the closure.
 *
 * # Why we don't ship a fallback
 *
 * If `VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64` is missing, the
 * minter throws on first use. We deliberately don't fall back to
 * the dev `dev-2026` key on the server because that would let an
 * operator accidentally ship a production build that signs tokens
 * with a key anyone can derive from a public seed. Phase 5.1 ships
 * the dev minter as a CLI script (`scripts/dev-mint-license.mjs`),
 * which is fine for local development; the server-side minter is
 * production-only.
 *
 * # Out of scope for v1
 *
 * - Hardware-backed signing (HSM / KMS). The env var is the
 *   simplest delivery mechanism that still keeps the secret out
 *   of the repo + container image. Phase 5.5+ can swap in a KMS
 *   (the `signLicenseToken` interface stays the same).
 * - Multiple kids (key rotation). Phase 5.5+ will pass a
 *   `KEYRING` map similarly to the client; for v1 we only need
 *   one production key.
 * - Per-customer rate limiting on minting. Stripe webhook
 *   already enforces "one event per checkout"; abuse is a
 *   Stripe-side concern.
 */

import * as ed from '@noble/ed25519';

/* ------------------------------------------------------------------ */
/*  Decode helpers (server-only — uses Buffer)                         */
/* ------------------------------------------------------------------ */

const decodeBase64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'base64'));

/* ------------------------------------------------------------------ */
/*  Minter                                                             */
/* ------------------------------------------------------------------ */

export interface MinterConfig {
  /** Base64-encoded 32-byte raw Ed25519 secret key. Required for
   *  every production deployment. Generate with:
   *    `node -e "const ed=require('@noble/ed25519');const{sha512}=require('@noble/hashes/sha2.js');ed.hashes.sha512=(...m)=>sha512(Buffer.concat(m.map(Buffer.from)));console.log(Buffer.from(ed.utils.randomSecretKey()).toString('base64'))"`
   *  Then keep the printed value in your secret store + send the
   *  matching public key to the client team for embedding in
   *  `lib/licenseKeyring.ts`. */
  secretKeyBase64: string;
  /** Master key id this minter signs with. Must match a `kid` in
   *  the client's `LICENSE_KEYRING` for tokens to verify. */
  kid: string;
}

export interface MintTokenArgs {
  tier: LicenseTier;
  /** Anonymous install id from Stripe Checkout `metadata.installId`. */
  installId: string;
  /** Token validity window, in seconds. Caller decides:
   *   - Stardust monthly → 32 days (4-day grace past renewal)
   *   - Stardust annual → 380 days (15-day grace)
   *   - Polaris monthly / annual → same as Stardust
   *   - Owner lifetime → 100 years (effectively forever; bumped
   *     in Phase 5.3 to a true "no expiry" flag if we ever
   *     refactor the payload). */
  ttlSeconds: number;
}

export interface Minter {
  /** Sign + return a `vector-license-v1.…` token bound to the
   *  installId in `metadata`. */
  mintToken: (args: MintTokenArgs) => Promise<string>;
  /** Return the public key matched to the loaded secret. Used by
   *  the operator to sanity-check that the env var matches the
   *  kid embedded in the client's `LICENSE_KEYRING`. */
  getPublicKey: () => Promise<Uint8Array>;
  /** Configured kid the minter signs with. */
  readonly kid: string;
}

/**
 * Bootstrap the minter from a config blob. Validates the secret
 * key length up-front so a misconfigured deployment fails loudly
 * at boot rather than at the first webhook delivery.
 */
export const createMinter = (config: MinterConfig): Minter => {
  if (!config.secretKeyBase64 || config.secretKeyBase64.length === 0) {
    throw new Error('createMinter: secretKeyBase64 is required');
  }
  if (!config.kid || config.kid.length === 0) {
    throw new Error('createMinter: kid is required');
  }
  const secretKey = decodeBase64(config.secretKeyBase64);
  if (secretKey.length !== 32) {
    throw new Error(`createMinter: secret key must decode to 32 bytes (got ${secretKey.length})`);
  }

  const mintToken: Minter['mintToken'] = async ({ tier, installId, ttlSeconds }) => {
    if (!installId || installId.length === 0) {
      throw new Error('mintToken: installId is required');
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error(`mintToken: ttlSeconds must be > 0 (got ${ttlSeconds})`);
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: LicensePayload = {
      tier,
      sub: installId,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      kid: config.kid,
    };
    return signLicenseToken({ payload, secretKey });
  };

  const getPublicKey: Minter['getPublicKey'] = () => ed.getPublicKeyAsync(secretKey);

  return Object.freeze({ mintToken, getPublicKey, kid: config.kid });
};

/* ------------------------------------------------------------------ */
/*  TTL convention                                                     */
/* ------------------------------------------------------------------ */

import type { BillingPeriod } from '../lib/pricing';

const DAY_S = 86400;

/** Convert a billing period to a token TTL in seconds. The grace
 *  windows (3-15 extra days past nominal renewal) absorb Stripe
 *  webhook delays + the user's "I forgot to renew" annoyance
 *  window. Phase 5.3 (Customer Portal) will add a webhook for
 *  `customer.subscription.updated` to refresh the token mid-cycle,
 *  but for v1 the buffer is the safety net. */
export const ttlSecondsForPeriod = (period: BillingPeriod): number => {
  switch (period) {
    case 'monthly':
      return 32 * DAY_S; // 30 + 2 grace
    case 'annual':
      return 380 * DAY_S; // 365 + 15 grace
    case 'lifetime':
      return 100 * 365 * DAY_S; // ~century — effectively forever
  }
};
