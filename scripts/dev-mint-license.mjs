#!/usr/bin/env node
/**
 * Phase 5 §5.1 — `scripts/dev-mint-license.mjs`
 *
 * Local-only license minter. Lets a developer / QA produce a
 * working `vector-license-v1.…` token without standing up the
 * Stripe webhook. The minted token is signed with the
 * `dev-2026` keypair (deterministic from `vector-dev-license-seed-2026`,
 * matching the public key embedded in `lib/licenseKeyring.ts`).
 *
 * # Usage
 *
 *   # Print the dev public key (sanity-check vs licenseKeyring.ts).
 *   node scripts/dev-mint-license.mjs --print-pub
 *
 *   # Mint a 30-day stardust token bound to a specific install id:
 *   node scripts/dev-mint-license.mjs \
 *     --install install-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
 *     --tier stardust \
 *     --days 30
 *
 * # Security posture
 *
 * The `dev-2026` private key is **deliberately reproducible from
 * a public seed** — anyone running this script can mint a token.
 * That's fine for v1 because:
 *
 *   - In dev / alpha builds, every paywall is just a
 *     paywall-shaped UI affordance; AI calls are still gated by
 *     the user's own AI provider key.
 *   - Production builds ship with `LICENSE_KEYRING['dev-2026']`
 *     intact for the alpha review window. Phase 5.2 will gate
 *     the dev kid on `import.meta.env.MODE !== 'production'`
 *     once the production minter is live.
 *
 * If you need to rotate the dev seed (e.g. after the alpha
 * window), bump `DEV_LICENSE_SEED` in `lib/licenseKeyring.ts`
 * AND regenerate the embedded public key (`--print-pub`).
 */

import { argv, exit } from 'node:process';
import * as ed from '@noble/ed25519';
import { sha512, sha256 } from '@noble/hashes/sha2.js';

// Mirrors services/edBootstrap.ts — wires SHA-512 once for noble's
// Ed25519 implementation. Inlined here so the script stays a
// single-file, no-build-step CLI.
const concat = (...arrays) => {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
};
ed.hashes.sha512Async = (...messages) => Promise.resolve(sha512(concat(...messages)));
ed.hashes.sha512 = (...messages) => sha512(concat(...messages));

const DEV_KID = 'dev-2026';
const DEV_LICENSE_SEED = 'vector-dev-license-seed-2026';
const TOKEN_PREFIX = 'vector-license-v1';

const TEXT = new TextEncoder();

const bytesToBase64Url = (bytes) => {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return Buffer.from(str, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const parseFlag = (name, fallback = null) => {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const hasFlag = (name) => argv.includes(`--${name}`);

const deriveKeypair = async () => {
  // SHA-256(seed) is the 32-byte secret seed for Ed25519.
  const secret = sha256(TEXT.encode(DEV_LICENSE_SEED));
  const publicKey = await ed.getPublicKeyAsync(secret);
  return { secret, publicKey };
};

const sign = async ({ payload, secretKey }) => {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = bytesToBase64Url(TEXT.encode(payloadJson));
  const signing = `${TOKEN_PREFIX}.${payloadB64}`;
  const sigBytes = await ed.signAsync(TEXT.encode(signing), secretKey);
  return `${TOKEN_PREFIX}.${payloadB64}.${bytesToBase64Url(sigBytes)}`;
};

const main = async () => {
  if (hasFlag('print-pub')) {
    const { publicKey } = await deriveKeypair();
    // eslint-disable-next-line no-console
    console.log(
      'Dev master public key (paste into lib/licenseKeyring.ts):\n  new Uint8Array([',
      Array.from(publicKey).join(', '),
      ']);',
    );
    return;
  }

  const installId = parseFlag('install');
  const tier = parseFlag('tier', 'stardust');
  const daysStr = parseFlag('days', '30');
  const days = Number.parseInt(daysStr, 10);

  if (!installId) {
    // eslint-disable-next-line no-console
    console.error('error: --install <install-id> is required');
    exit(2);
  }
  if (!['stardust', 'polaris', 'owner'].includes(tier)) {
    // eslint-disable-next-line no-console
    console.error(`error: --tier must be one of: stardust | polaris | owner (got "${tier}")`);
    exit(2);
  }
  if (!Number.isFinite(days) || days <= 0) {
    // eslint-disable-next-line no-console
    console.error(`error: --days must be a positive integer (got "${daysStr}")`);
    exit(2);
  }

  const { secret } = await deriveKeypair();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    tier,
    sub: installId,
    iat: nowSeconds,
    exp: nowSeconds + days * 86400,
    kid: DEV_KID,
  };
  const token = await sign({ payload, secretKey: secret });
  // eslint-disable-next-line no-console
  console.log(token);
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  exit(1);
});
