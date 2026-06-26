/**
 * Phase 4 §4.b-3 (backup integrity) —
 * `services/edBootstrap.ts`
 *
 * `@noble/ed25519` (the audited, ~5 KB pure-JS Ed25519 implementation
 * we picked for backup signing) requires the consumer to wire a
 * SHA-512 implementation before any sign / verify call. We do that
 * once, here, so every other module just imports `@noble/ed25519`
 * and uses it.
 *
 * Why noble vs `crypto.subtle`'s native Ed25519: native Ed25519 is
 * still patchy in Safari < 17 and the format quirks (raw vs PKCS8)
 * make tests painful. Noble is uniform across browser + node +
 * happy-dom test env and the binary cost is negligible.
 *
 * This module's only side effect is mutating `ed.hashes`. Importing
 * it more than once is harmless (idempotent assignment).
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

const concat = (...arrays: readonly Uint8Array[]): Uint8Array => {
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
// `sha512` (sync) is also called by some noble code paths.
ed.hashes.sha512 = (...messages) => sha512(concat(...messages));

export { ed };
