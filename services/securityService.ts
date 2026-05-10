/**
 * SECURITY PROTOCOL: VECTOR_ENCRYPTION_LAYER_V1
 *
 * This service implements a Zero-Knowledge encryption path:
 * 1. Master Password -> PBKDF2 (>= 600,000 iterations, OWASP 2026) -> Derived Key
 * 2. Derived Key -> AES-GCM (256-bit) -> Encrypted Payload
 * 3. All operations are local-only using Web Crypto API.
 *
 * Backwards compatibility:
 *   - The on-disk hash format (`pbkdf2-sha256:v1:<iter>:<base64>`) records
 *     the iteration count it was minted with. `verifyPassword` always re-runs
 *     the derivation at that recorded count, so older hashes (e.g. 100k)
 *     keep validating without forced migration.
 *   - When a user authenticates successfully against a hash with a lower
 *     iteration count, callers may opportunistically re-mint at the current
 *     `ITERATIONS` default and persist the new hash via
 *     `useDiaryData.savePasswordHash`.
 *
 * Forwards compatibility — Argon2id verifier (Phase 3 §3.e-2):
 *   - Hashes minted by `services/argon2idPoc.ts` carry the
 *     `argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>` prefix and are
 *     recognised by `verifyPassword` ONLY when the per-installation
 *     feature flag at `localStorage["vector_argon2_verify"] === "1"`
 *     is set. Without the flag the branch returns false (treated as
 *     "wrong password") so a misconfigured rollout cannot leak data.
 *   - The minter (`hashPassword`) intentionally STAYS on PBKDF2 so we
 *     don't generate any argon2id hashes the rest of the codebase
 *     can't reason about until the flag becomes default. Real
 *     promotion to default is tracked as Phase 4 §4.b-1.
 *   - The `hash-wasm` blob (~52 kB gzipped) is loaded lazily through
 *     a dynamic import so disabling the flag keeps it out of the
 *     production bundle.
 */

const PBKDF2_DEFAULT_ITERATIONS = 600_000;
const PBKDF2_MIN_ALLOWED_ITERATIONS = 100_000;
const PBKDF2_MAX_VERIFY_ITERATIONS = 2_000_000;

const resolveIterationOverride = (): number => {
  // Server / CI may pin a different cost via an env var so the WebCrypto
  // derivation does not blow past test budgets. Browsers ignore process.env.
  const raw =
    typeof process !== 'undefined' && process.env?.VECTOR_PBKDF2_ITERATIONS
      ? Number(process.env.VECTOR_PBKDF2_ITERATIONS)
      : NaN;
  if (!Number.isFinite(raw)) return PBKDF2_DEFAULT_ITERATIONS;
  if (raw < PBKDF2_MIN_ALLOWED_ITERATIONS) return PBKDF2_MIN_ALLOWED_ITERATIONS;
  if (raw > PBKDF2_MAX_VERIFY_ITERATIONS) return PBKDF2_MAX_VERIFY_ITERATIONS;
  return Math.floor(raw);
};

export class SecurityService {
  private static ITERATIONS = resolveIterationOverride();
  private static PASSWORD_HASH_PREFIX = 'pbkdf2-sha256:v1';
  private static ARGON2_HASH_PREFIX = 'argon2id:v1';
  private static ARGON2_VERIFIER_FLAG_KEY = 'vector_argon2_verify';
  private static ARGON2_MINTER_FLAG_KEY = 'vector_argon2_minter';
  /**
   * Phase 4.5 §C — one-shot migration marker.
   *
   * Without this flag we cannot distinguish "user has never touched
   * the Argon2id toggle" from "user explicitly turned it OFF". Both
   * present as a missing `vector_argon2_minter` key. The marker
   * lets `applyArgon2idDefaults` run exactly once per installation:
   *
   *   - Marker absent ⇒ this is either a fresh install OR an
   *     existing install booting the §C release for the first
   *     time. We auto-enable verifier + minter so Argon2id becomes
   *     the default.
   *   - Marker present ⇒ the auto-enable already ran. Anything the
   *     user did via the Settings toggle since then is the
   *     authoritative choice — never overwrite it.
   */
  private static ARGON2_DEFAULT_APPLIED_KEY = 'vector_argon2_default_v45';
  private static RECOVERY_HASH_PREFIX = 'recovery-sha256:v1';
  private static MAX_VERIFY_ITERATIONS = PBKDF2_MAX_VERIFY_ITERATIONS;
  private static ALGO = 'AES-GCM';
  private static KEY_LEN = 256;

  /** Public read-only snapshot of the cost factor in use; useful in tests. */
  static getCurrentIterations(): number {
    return this.ITERATIONS;
  }

  /**
   * Returns true when the per-installation feature flag at
   * `localStorage["vector_argon2_verify"]` is set to `"1"` / `"true"`.
   * `verifyPassword` consults this when it sees an Argon2id-prefixed
   * hash and refuses to verify when the flag is off so a corrupted /
   * accidentally-promoted Argon2id record cannot accept any password.
   *
   * Wraps the storage read in a try/catch so quota / disabled-storage
   * environments degrade safely to "feature off".
   */
  static isArgon2idVerifierEnabled(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      const value = localStorage.getItem(this.ARGON2_VERIFIER_FLAG_KEY);
      if (value === null) return false;
      return value === '1' || value.toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Settings-screen helper. Pass `true` to opt this installation into
   * the Argon2id verifier branch (still PBKDF2 for new mints — this
   * only affects hashes the user has already migrated by other means).
   */
  static setArgon2idVerifierEnabled(enabled: boolean): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      if (enabled) {
        localStorage.setItem(this.ARGON2_VERIFIER_FLAG_KEY, '1');
      } else {
        localStorage.removeItem(this.ARGON2_VERIFIER_FLAG_KEY);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * W2.1 (Phase 4) — true when the per-installation feature flag at
   * `localStorage["vector_argon2_minter"]` is set AND the verifier flag
   * is also set.
   *
   * The "verify ≥ mint" invariant is enforced HERE, not by the UI:
   * minting Argon2id while verify is off would leave the user with a
   * hash they cannot validate next session — i.e. permanently locked
   * out — so we silently treat (mint=on, verify=off) as (mint=off).
   * This is defence in depth even if the UI accidentally sets the keys
   * out of order.
   */
  static isArgon2idMinterEnabled(): boolean {
    if (!this.isArgon2idVerifierEnabled()) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      const value = localStorage.getItem(this.ARGON2_MINTER_FLAG_KEY);
      if (value === null) return false;
      return value === '1' || value.toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Settings-screen helper. Pass `true` to opt this installation into
   * the Argon2id MINTER (verifier MUST also be on — see the verify ≥
   * mint invariant in `isArgon2idMinterEnabled`). When called with
   * `true` while verifier is off, also enables the verifier so the new
   * Argon2id hash can be read back next session.
   */
  static setArgon2idMinterEnabled(enabled: boolean): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      if (enabled) {
        // Auto-enable verifier so the user can never lock themselves
        // out by minting without the matching verifier branch.
        if (!this.isArgon2idVerifierEnabled()) {
          this.setArgon2idVerifierEnabled(true);
        }
        localStorage.setItem(this.ARGON2_MINTER_FLAG_KEY, '1');
      } else {
        localStorage.removeItem(this.ARGON2_MINTER_FLAG_KEY);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Phase 4.5 §C — auto-enable Argon2id on first mount post-rollout.
   *
   * Idempotent: relies on the `ARGON2_DEFAULT_APPLIED_KEY` marker so
   * subsequent calls are no-ops AND any explicit user toggle since
   * the marker was set is preserved. Safe to call from `App.tsx`
   * mount; in non-browser / no-localStorage environments it
   * silently no-ops.
   *
   * Returns true when this call actually flipped the defaults
   * (useful for telemetry / one-shot Settings banner). Returns
   * false on every subsequent call OR when localStorage is
   * unavailable.
   */
  static applyArgon2idDefaults(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      if (localStorage.getItem(this.ARGON2_DEFAULT_APPLIED_KEY) !== null) {
        return false;
      }
      // Mark BEFORE flipping so a partial failure leaves us in a
      // consistent "we tried" state rather than re-firing forever.
      localStorage.setItem(this.ARGON2_DEFAULT_APPLIED_KEY, '1');
      // Both flags ON. setArgon2idMinterEnabled handles the
      // verify-≥-mint invariant internally.
      this.setArgon2idMinterEnabled(true);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true when the supplied stored hash should be re-minted
   * on the next successful verification. Two reasons trigger:
   *   1. Iteration ratchet — a PBKDF2 hash was minted with fewer
   *      iterations than the current `ITERATIONS` default.
   *   2. **Algorithm upgrade (Phase 4.5 §C)** — the install is now
   *      configured to mint Argon2id (`isArgon2idMinterEnabled`)
   *      and the stored hash is anything other than Argon2id
   *      (legacy PBKDF2 / pre-prefix legacy SHA-256). The next
   *      successful unlock opportunistically rehashes via
   *      `services/passwordRehash.ts`.
   *
   * Argon2id-prefixed hashes always return false here: Argon2id is
   * already the strongest algorithm we recognise. (A future
   * Argon2id-parameter ratchet would extend this branch.)
   */
  static needsRehash(storedHash: string | null): boolean {
    if (!storedHash) return false;
    if (storedHash.startsWith(this.ARGON2_HASH_PREFIX)) return false;
    // Algorithm upgrade: minter on + non-Argon2id hash → rehash.
    if (this.isArgon2idMinterEnabled()) return true;
    if (!storedHash.startsWith(this.PASSWORD_HASH_PREFIX)) return true;
    const [, , iterationsRaw] = storedHash.split(':');
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations)) return false;
    return iterations < this.ITERATIONS;
  }

  /**
   * Derives a cryptographic key from a plain text password and salt.
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: this.ALGO, length: this.KEY_LEN },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Encrypts a string using a master password.
   * Returns a base64 encoded string containing [salt(16)][iv(12)][ciphertext]
   */
  static async encrypt(text: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encrypted = await window.crypto.subtle.encrypt(
      { name: this.ALGO, iv },
      key,
      encoder.encode(text),
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedArray, salt.length + iv.length);

    return this.uint8ToBase64(combined);
  }

  /**
   * Decrypts a base64 encoded string using a master password.
   */
  static async decrypt(base64: string, password: string): Promise<string> {
    if (!base64 || !password) {
      throw new Error('DECRYPTION_FAILED: Invalid password or corrupted data.');
    }

    try {
      const combined = this.base64ToUint8(base64.trim());

      // Minimum length: Salt(16) + IV(12) + GCM tag(16) = 44 bytes
      if (combined.length < 44) {
        throw new Error('CORRUPTED_DATA');
      }

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const ciphertext = combined.slice(28);

      const key = await this.deriveKey(password, salt);
      const decoder = new TextDecoder();

      const decrypted = await window.crypto.subtle.decrypt(
        { name: this.ALGO, iv },
        key,
        ciphertext,
      );

      return decoder.decode(decrypted);
    } catch (e) {
      console.error('Decryption internal error:', e);
      throw new Error('DECRYPTION_FAILED: Invalid password or corrupted data.');
    }
  }

  /**
   * Robust Uint8Array to Base64 conversion
   */
  private static uint8ToBase64(u8: Uint8Array): string {
    let binary = '';
    const len = u8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
  }

  /**
   * Robust Base64 to Uint8Array conversion
   */
  private static base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8[i] = binary.charCodeAt(i);
    }
    return u8;
  }

  /**
   * Generates a hash of the password for local verification (Master Lock).
   * Note: We don't store the password, only this hash.
   *
   * W2.1 — when the per-installation Argon2id MINTER flag is on
   * (`vector_argon2_minter`, with verifier also on per the invariant
   * in `isArgon2idMinterEnabled`), we route through the Argon2id
   * pipeline. The resulting hash is self-describing
   * (`argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>`) and embeds its
   * own random salt, so the `salt` argument is intentionally unused
   * on this branch — passed only for API symmetry with PBKDF2.
   *
   * The lazy import keeps the `hash-wasm` blob (~52 kB gzip) out of
   * the production bundle until the user actually opts in.
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    if (this.isArgon2idMinterEnabled()) {
      const { hashArgon2idPassword } = await import('./argon2idPoc');
      return hashArgon2idPassword(password);
    }
    const saltBytes = this.saltToBytes(salt);
    const bits = await this.derivePasswordHashBits(password, saltBytes);
    return `${this.PASSWORD_HASH_PREFIX}:${this.ITERATIONS}:${this.uint8ToBase64(bits)}`;
  }

  static async verifyPassword(
    password: string,
    salt: string,
    storedHash: string | null,
  ): Promise<boolean> {
    if (!storedHash) return false;

    try {
      // Argon2id branch (Phase 3 §3.e-2, behind feature flag).
      // Lazy import keeps the `hash-wasm` blob out of the production
      // bundle until the flag is on. Salt argument is ignored — the
      // Argon2id self-describing hash format embeds its own salt.
      if (storedHash.startsWith(this.ARGON2_HASH_PREFIX)) {
        if (!this.isArgon2idVerifierEnabled()) return false;
        const { verifyArgon2idPassword } = await import('./argon2idPoc');
        return verifyArgon2idPassword(password, storedHash);
      }

      if (storedHash.startsWith(this.PASSWORD_HASH_PREFIX)) {
        const [, , iterationsRaw, expected] = storedHash.split(':');
        const iterations = Number(iterationsRaw);
        if (
          !expected ||
          !Number.isInteger(iterations) ||
          iterations < 1 ||
          iterations > this.MAX_VERIFY_ITERATIONS
        ) {
          return false;
        }

        const actual = await this.derivePasswordHashBits(
          password,
          this.saltToBytes(salt),
          iterations,
        );
        return this.constantTimeEqual(this.uint8ToBase64(actual), expected);
      }

      const legacyHash = await this.legacyHashPassword(password, salt);
      return this.constantTimeEqual(legacyHash, storedHash);
    } catch {
      return false;
    }
  }

  static async hashRecoveryKey(recoveryKey: string): Promise<string> {
    const normalized = this.normalizeRecoveryKey(recoveryKey);
    const digest = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalized),
    );
    return `${this.RECOVERY_HASH_PREFIX}:${this.uint8ToBase64(new Uint8Array(digest))}`;
  }

  static async verifyRecoveryKey(
    recoveryKey: string,
    storedValue: string | null,
  ): Promise<boolean> {
    if (!storedValue) return false;
    const normalizedInput = this.normalizeRecoveryKey(recoveryKey);

    if (storedValue.startsWith(this.RECOVERY_HASH_PREFIX)) {
      const expected = storedValue.split(':').pop() || '';
      const actual = await this.hashRecoveryKey(normalizedInput);
      return this.constantTimeEqual(actual.split(':').pop() || '', expected);
    }

    const normalizedStored = this.normalizeRecoveryKey(storedValue);
    return (
      normalizedInput.length === 32 && this.constantTimeEqual(normalizedInput, normalizedStored)
    );
  }

  static recoveryKeyIsHashed(storedValue: string | null): boolean {
    return Boolean(storedValue?.startsWith(this.RECOVERY_HASH_PREFIX));
  }

  private static async derivePasswordHashBits(
    password: string,
    salt: Uint8Array,
    iterations = this.ITERATIONS,
  ): Promise<Uint8Array> {
    const passwordData = new TextEncoder().encode(password);
    const passwordKey = await window.crypto.subtle.importKey('raw', passwordData, 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      256,
    );
    this.wipeSensitive(passwordData);
    return new Uint8Array(bits);
  }

  private static async legacyHashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = encoder.encode(salt);
    const data = new Uint8Array(passwordData.length + saltData.length);
    data.set(passwordData);
    data.set(saltData, passwordData.length);

    const hash = await window.crypto.subtle.digest('SHA-256', data);

    this.wipeSensitive(passwordData);
    this.wipeSensitive(data);

    return this.uint8ToBase64(new Uint8Array(hash));
  }

  private static normalizeRecoveryKey(recoveryKey: string): string {
    return recoveryKey.replace(/-/g, '').trim().toUpperCase();
  }

  private static saltToBytes(salt: string): Uint8Array {
    try {
      return this.base64ToUint8(salt);
    } catch {
      return new TextEncoder().encode(salt);
    }
  }

  private static constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let index = 0; index < a.length; index += 1) {
      diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return diff === 0;
  }

  /**
   * Securely erases sensitive data from memory.
   */
  static wipeSensitive(data: Uint8Array) {
    if (data) {
      data.fill(0);
    }
  }
}
