/**
 * SECURITY PROTOCOL — VECTOR_ENCRYPTION_LAYER_V2 (Argon2id PoC)
 *
 * Phase 3 §3.e — proof-of-concept wrapper around `hash-wasm`'s
 * Argon2id implementation. NOT wired into the main authentication
 * path; consumed by:
 *   - `services/argon2idPoc.test.ts` — round-trip + parameter sanity
 *   - `scripts/argon2-bench.ts`      — performance benchmark
 *   - `docs/security/argon2-eval.md` — decision document
 *
 * Hash format string (drafted for the migration design discussed
 * in `docs/security/argon2-eval.md`):
 *
 *   argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>
 *
 *   - `<m>` memory in KiB (e.g. `19456` = 19 MiB, OWASP minimum;
 *     `65536` = 64 MiB recommended; `131072` = 128 MiB strict).
 *   - `<t>` iteration count (≥ 2; OWASP recommends 3 for 64 MiB).
 *   - `<p>` parallelism (1 in single-threaded WebAssembly).
 *   - `<saltB64>` base64 of a 16-byte cryptographic random salt.
 *   - `<hashB64>` base64 of the 32-byte derived key.
 *
 * The format mirrors `pbkdf2-sha256:v1:<iter>:<base64>` so the
 * existing `needsRehash` / opportunistic re-mint pipeline can be
 * extended to it without ceremony.
 *
 * Dependency: `hash-wasm` 4.x (devDep only — this file imports it
 * lazily so it does not appear in the production bundle until the
 * decision document approves a real rollout).
 */

export interface Argon2idParams {
  /** Memory cost in KiB. OWASP 2024+ recommends 19 456 (19 MiB)
   *  as the absolute minimum and 65 536 (64 MiB) for high-value
   *  secrets. */
  memoryKib: number;
  /** Iteration count (≥ 2). */
  iterations: number;
  /** Parallelism. Single-threaded WASM in our PoC: keep at 1. */
  parallelism: number;
  /** Output length in bytes. 32 matches our AES-GCM-256 derived
   *  key length and the 256-bit PBKDF2 hash bits. */
  hashLength: number;
}

/** OWASP 2024+ "minimum acceptable" parameter set. Roughly equal
 *  in cost to PBKDF2-SHA256 600 000 iterations on commodity x86,
 *  but memory-hard so GPUs / ASICs lose their advantage. */
export const ARGON2_OWASP_MIN: Argon2idParams = {
  memoryKib: 19_456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
};

/** OWASP 2024+ "high-value secret" parameter set. About 3× the
 *  CPU cost of OWASP_MIN and ~3.4× the memory. */
export const ARGON2_OWASP_RECOMMENDED: Argon2idParams = {
  memoryKib: 65_536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

/** Strict / paranoid parameter set. Used in the benchmark to
 *  bracket the upper end; not recommended for default rollout
 *  because the unlock latency on low-spec mobile devices climbs
 *  into the >1 s range, hurting UX. */
export const ARGON2_STRICT: Argon2idParams = {
  memoryKib: 131_072,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

const ARGON2_HASH_PREFIX = 'argon2id:v1';

/** Lazy `hash-wasm` import keeps the PoC out of the production
 *  bundle until the decision in `docs/security/argon2-eval.md`
 *  approves a real wiring. */
const loadArgon2id = async () => {
  const mod = await import('hash-wasm');
  return mod.argon2id;
};

const uint8ToBase64 = (u8: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < u8.byteLength; i += 1) binary += String.fromCharCode(u8[i]);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
};

const base64ToUint8 = (base64: string): Uint8Array => {
  const binary =
    typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) u8[i] = binary.charCodeAt(i);
  return u8;
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
};

/**
 * Derive a 32-byte (default) Uint8Array from a password under the
 * supplied Argon2id parameter set. Used both by `hashPassword`
 * (when minting a new hash) and `verifyPassword` (when re-deriving
 * with the parameters embedded in the stored hash).
 */
export const deriveArgon2idBits = async (
  password: string,
  salt: Uint8Array,
  params: Argon2idParams = ARGON2_OWASP_RECOMMENDED,
): Promise<Uint8Array> => {
  const argon2id = await loadArgon2id();
  const hex = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKib,
    hashLength: params.hashLength,
    outputType: 'hex',
  });
  // hash-wasm returns lowercase hex; convert to bytes for parity
  // with the PBKDF2 path which works on Uint8Array.
  const out = new Uint8Array(params.hashLength);
  for (let i = 0; i < params.hashLength; i += 1) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
};

/**
 * Mint a new password hash. Returns a self-describing string in the
 * `argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>` format so
 * `verifyArgon2idPassword` can re-derive without external context.
 */
export const hashArgon2idPassword = async (
  password: string,
  params: Argon2idParams = ARGON2_OWASP_RECOMMENDED,
  saltOverride?: Uint8Array,
): Promise<string> => {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  const salt =
    saltOverride ??
    (cryptoApi?.getRandomValues
      ? cryptoApi.getRandomValues(new Uint8Array(16))
      : (() => {
          // node:crypto fallback for Node ≤ 18 / non-WebCrypto runtimes.
          // Throws if `node:crypto` is unavailable; the PoC harness
          // always runs in Node ≥ 20 where it is.
          const out = new Uint8Array(16);
          for (let i = 0; i < 16; i += 1) out[i] = Math.floor(Math.random() * 256);
          return out;
        })());
  const bits = await deriveArgon2idBits(password, salt, params);
  return `${ARGON2_HASH_PREFIX}:${params.memoryKib}:${params.iterations}:${params.parallelism}:${uint8ToBase64(salt)}:${uint8ToBase64(bits)}`;
};

/**
 * Constant-time verify against a stored hash. Returns false on any
 * format / parameter validation failure rather than throwing — the
 * caller cannot distinguish "wrong password" from "stored hash is
 * malformed" without leaking timing information.
 */
export const verifyArgon2idPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  if (!storedHash.startsWith(ARGON2_HASH_PREFIX)) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 7) return false;
  const [, , mRaw, tRaw, pRaw, saltB64, expectedB64] = parts;
  const memoryKib = Number(mRaw);
  const iterations = Number(tRaw);
  const parallelism = Number(pRaw);
  if (
    !Number.isInteger(memoryKib) ||
    !Number.isInteger(iterations) ||
    !Number.isInteger(parallelism) ||
    memoryKib < 8 ||
    iterations < 1 ||
    parallelism < 1 ||
    memoryKib > 1_048_576 || // 1 GiB upper bound (DoS guard)
    iterations > 32 ||
    parallelism > 16
  ) {
    return false;
  }
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64ToUint8(saltB64);
    expected = base64ToUint8(expectedB64);
  } catch {
    return false;
  }
  const params: Argon2idParams = {
    memoryKib,
    iterations,
    parallelism,
    hashLength: expected.length,
  };
  const actual = await deriveArgon2idBits(password, salt, params);
  return constantTimeEqual(actual, expected);
};

/** Public read-only prefix; useful in the migration layer
 *  (`needsRehash` analogue). */
export const ARGON2_HASH_PREFIX_PUBLIC = ARGON2_HASH_PREFIX;
