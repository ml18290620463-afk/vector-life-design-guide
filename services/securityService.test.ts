import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SecurityService } from './securityService';
import { ARGON2_OWASP_MIN, hashArgon2idPassword } from './argon2idPoc';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

describe('SecurityService', () => {
  const password = 'StrongPassword123!';
  const text = 'This is a secret message.';

  it('should encrypt and decrypt a message correctly', async () => {
    const encrypted = await SecurityService.encrypt(text, password);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(text);

    const decrypted = await SecurityService.decrypt(encrypted, password);
    expect(decrypted).toBe(text);
  });

  it('should throw an error on incorrect password', async () => {
    const encrypted = await SecurityService.encrypt(text, password);
    await expect(SecurityService.decrypt(encrypted, 'wrong-password')).rejects.toThrow(
      'DECRYPTION_FAILED: Invalid password or corrupted data.',
    );
  });

  it('should throw an error on corrupted data', async () => {
    const encrypted = await SecurityService.encrypt(text, password);
    const corrupted =
      encrypted.substring(0, encrypted.length - 1) + (encrypted.endsWith('A') ? 'B' : 'A');
    await expect(SecurityService.decrypt(corrupted, password)).rejects.toThrow(
      'DECRYPTION_FAILED: Invalid password or corrupted data.',
    );
  });

  it('should hash a password consistently with the same salt', async () => {
    const salt = 'constant-salt';
    const hash1 = await SecurityService.hashPassword(password, salt);
    const hash2 = await SecurityService.hashPassword(password, salt);
    expect(hash1).toBe(hash2);
    await expect(SecurityService.verifyPassword(password, salt, hash1)).resolves.toBe(true);
  });

  it('should produce different hashes for different passwords with same salt', async () => {
    const salt = 'constant-salt';
    const hash1 = await SecurityService.hashPassword(password, salt);
    const hash2 = await SecurityService.hashPassword('another-password', salt);
    expect(hash1).not.toBe(hash2);
  });

  it('should verify legacy password hashes for backward compatibility', async () => {
    const salt = 'legacy-salt';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + salt));
    const legacyHash = btoa(String.fromCharCode(...new Uint8Array(digest)));

    await expect(SecurityService.verifyPassword(password, salt, legacyHash)).resolves.toBe(true);
  });

  it('should hash and verify recovery keys without storing plaintext', async () => {
    const recoveryKey = 'ABCD-1234-EFGH-5678-IJKL-9012-MNOP-3456';
    const stored = await SecurityService.hashRecoveryKey(recoveryKey);

    expect(stored).not.toContain('ABCD');
    expect(SecurityService.recoveryKeyIsHashed(stored)).toBe(true);
    await expect(SecurityService.verifyRecoveryKey(recoveryKey, stored)).resolves.toBe(true);
  });

  it('should wipe sensitive data', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    SecurityService.wipeSensitive(data);
    expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
  });

  it('exposes the active iteration count and respects env override', () => {
    // vitest.config.ts pins VECTOR_PBKDF2_ITERATIONS=100000 for speed; the
    // production default would be 600,000.
    expect(SecurityService.getCurrentIterations()).toBe(100_000);
  });

  it('flags hashes minted at a lower iteration count for opportunistic re-hash', async () => {
    const salt = 'salt-for-rehash';
    const lowHash = `pbkdf2-sha256:v1:50000:abc==`;
    expect(SecurityService.needsRehash(lowHash)).toBe(true);

    const currentHash = await SecurityService.hashPassword(password, salt);
    expect(SecurityService.needsRehash(currentHash)).toBe(false);

    // Legacy SHA-256-only hashes (no version prefix) also need re-hash on
    // the next successful login.
    expect(SecurityService.needsRehash('legacy-base64==')).toBe(true);
    expect(SecurityService.needsRehash(null)).toBe(false);
  });
});

describe('SecurityService — Phase 3 §3.e-2 Argon2id verifier branch', () => {
  // Pin to OWASP_MIN throughout — the same call lives behind a lazy
  // import in production so per-test latency dominates the suite.
  // OWASP_MIN keeps a single derive at ~50 ms on Node 20.
  const argonParams = ARGON2_OWASP_MIN;
  const correctPassword = 'right-pw-Φ7';
  const wrongPassword = 'right-pw-Φ8';

  /**
   * Cached Argon2id hash so we only pay the WASM derive cost once
   * for the entire branch suite. Generated lazily by the first test
   * that needs it.
   */
  let cachedArgon2idHash: string | null = null;
  const getArgon2idHash = async (): Promise<string> => {
    if (!cachedArgon2idHash) {
      cachedArgon2idHash = await hashArgon2idPassword(correctPassword, argonParams);
    }
    return cachedArgon2idHash;
  };

  beforeEach(() => {
    // Default state: flag unset. Each test opts in explicitly.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
    }
  });

  it('isArgon2idVerifierEnabled defaults to false when the storage key is absent', () => {
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(false);
  });

  it('setArgon2idVerifierEnabled(true) flips the flag on; passing false flips it off', () => {
    expect(SecurityService.setArgon2idVerifierEnabled(true)).toBe(true);
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);

    SecurityService.setArgon2idVerifierEnabled(false);
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(false);
  });

  it('isArgon2idVerifierEnabled accepts both "1" and "true" as truthy', () => {
    localStorage.setItem('vector_argon2_verify', '1');
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);

    localStorage.setItem('vector_argon2_verify', 'true');
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);

    localStorage.setItem('vector_argon2_verify', 'TRUE');
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);

    localStorage.setItem('vector_argon2_verify', 'no');
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(false);
  });

  it('verifyPassword refuses to validate Argon2id hashes when the flag is OFF', async () => {
    const hash = await getArgon2idHash();
    // Salt argument is ignored for Argon2id (the hash carries its own).
    expect(await SecurityService.verifyPassword(correctPassword, '', hash)).toBe(false);
  });

  it('verifyPassword validates Argon2id hashes against the correct password when flag is ON', async () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    const hash = await getArgon2idHash();
    expect(await SecurityService.verifyPassword(correctPassword, '', hash)).toBe(true);
  });

  it('verifyPassword rejects the wrong password against an Argon2id hash when flag is ON', async () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    const hash = await getArgon2idHash();
    expect(await SecurityService.verifyPassword(wrongPassword, '', hash)).toBe(false);
  });

  it('verifyPassword rejects malformed Argon2id strings (wrong segment count) without throwing', async () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    expect(await SecurityService.verifyPassword('pw', '', 'argon2id:v1:not-enough-fields')).toBe(
      false,
    );
  });

  it('PBKDF2 hashes still verify normally while the Argon2id flag is on', async () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    const salt = 'shared-salt-A';
    const pwd = 'PbkdfSurvives@1';
    const stored = await SecurityService.hashPassword(pwd, salt);
    expect(await SecurityService.verifyPassword(pwd, salt, stored)).toBe(true);
    expect(await SecurityService.verifyPassword('wrong', salt, stored)).toBe(false);
  });

  it('needsRehash returns false for Argon2id hashes (already strongest)', async () => {
    const argon = await getArgon2idHash();
    expect(SecurityService.needsRehash(argon)).toBe(false);
  });
});

describe('SecurityService — Phase 4 §W2.1 Argon2id minter (default flag-gated)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
      localStorage.removeItem('vector_argon2_minter');
      // Phase 4.5 §C — also clear the migration marker so each
      // test starts from a "never been migrated" baseline.
      localStorage.removeItem('vector_argon2_default_v45');
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
      localStorage.removeItem('vector_argon2_minter');
      localStorage.removeItem('vector_argon2_default_v45');
    }
  });

  it('isArgon2idMinterEnabled defaults to false (mint=off, verify=off)', () => {
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
  });

  it('isArgon2idMinterEnabled stays false when only verify is on (mint=off, verify=on)', () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
  });

  it('verify ≥ mint invariant: minter on while verifier off reports false', () => {
    // Bypass the auto-enable logic by writing the storage key directly,
    // simulating a corrupted / partial state on disk.
    localStorage.setItem('vector_argon2_minter', '1');
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(false);
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
  });

  it('setArgon2idMinterEnabled(true) auto-enables the verifier so the user cannot lock themselves out', () => {
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(false);
    expect(SecurityService.setArgon2idMinterEnabled(true)).toBe(true);
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(true);
  });

  it('setArgon2idMinterEnabled(false) clears the minter but leaves the verifier on (manual cleanup)', () => {
    SecurityService.setArgon2idMinterEnabled(true);
    SecurityService.setArgon2idMinterEnabled(false);
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
    // verifier deliberately stays on — turning it off would orphan any
    // hashes minted while it was on, locking those users out.
    expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);
  });

  it('hashPassword mints PBKDF2 when both flags are off (4-state grid: off/off)', async () => {
    const stored = await SecurityService.hashPassword('test-pw', 'salt-abc');
    expect(stored.startsWith('pbkdf2-sha256:v1:')).toBe(true);
  });

  it('hashPassword mints PBKDF2 when verify is on but mint is off (off/on)', async () => {
    SecurityService.setArgon2idVerifierEnabled(true);
    const stored = await SecurityService.hashPassword('test-pw', 'salt-abc');
    expect(stored.startsWith('pbkdf2-sha256:v1:')).toBe(true);
  });

  it('hashPassword mints Argon2id when both flags are on (on/on)', async () => {
    SecurityService.setArgon2idMinterEnabled(true);
    const stored = await SecurityService.hashPassword('test-pw', 'salt-abc');
    expect(stored.startsWith('argon2id:v1:')).toBe(true);
    // Round-trip: the freshly-minted hash should validate against the
    // verifier branch (which we just auto-enabled).
    expect(await SecurityService.verifyPassword('test-pw', '', stored)).toBe(true);
  }, 15_000); // Argon2id mint is the only slow path here.

  it('hashPassword falls back to PBKDF2 when minter flag is set raw but verifier is off (defence in depth)', async () => {
    // Direct storage write, bypassing the auto-enable logic.
    localStorage.setItem('vector_argon2_minter', '1');
    expect(SecurityService.isArgon2idMinterEnabled()).toBe(false); // invariant
    const stored = await SecurityService.hashPassword('test-pw', 'salt-abc');
    expect(stored.startsWith('pbkdf2-sha256:v1:')).toBe(true);
  });
});

describe('SecurityService — Phase 4.5 §C Argon2id default-on rollout', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
      localStorage.removeItem('vector_argon2_minter');
      localStorage.removeItem('vector_argon2_default_v45');
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vector_argon2_verify');
      localStorage.removeItem('vector_argon2_minter');
      localStorage.removeItem('vector_argon2_default_v45');
    }
  });

  describe('applyArgon2idDefaults', () => {
    it('returns true on first call and flips both flags ON', () => {
      const flipped = SecurityService.applyArgon2idDefaults();
      expect(flipped).toBe(true);
      expect(SecurityService.isArgon2idVerifierEnabled()).toBe(true);
      expect(SecurityService.isArgon2idMinterEnabled()).toBe(true);
      expect(localStorage.getItem('vector_argon2_default_v45')).toBe('1');
    });

    it('is idempotent — subsequent calls return false', () => {
      expect(SecurityService.applyArgon2idDefaults()).toBe(true);
      expect(SecurityService.applyArgon2idDefaults()).toBe(false);
      expect(SecurityService.applyArgon2idDefaults()).toBe(false);
    });

    it('respects an explicit user-off choice on subsequent runs', () => {
      // First boot — auto-enables.
      SecurityService.applyArgon2idDefaults();
      expect(SecurityService.isArgon2idMinterEnabled()).toBe(true);
      // User explicitly turns the toggle OFF in Settings.
      SecurityService.setArgon2idMinterEnabled(false);
      expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
      // Next mount — must NOT re-enable.
      const flipped = SecurityService.applyArgon2idDefaults();
      expect(flipped).toBe(false);
      expect(SecurityService.isArgon2idMinterEnabled()).toBe(false);
    });
  });

  describe('needsRehash with the algorithm-upgrade branch', () => {
    it('returns true for a legacy PBKDF2 hash when the minter is on (algorithm upgrade)', () => {
      SecurityService.setArgon2idMinterEnabled(true);
      const pbkdf2 = `pbkdf2-sha256:v1:600000:abc==`;
      expect(SecurityService.needsRehash(pbkdf2)).toBe(true);
    });

    it('returns false for a PBKDF2 hash at the current iteration count when the minter is OFF', () => {
      // Minter off — only the iteration ratchet matters; an at-spec
      // hash should NOT be flagged.
      const pbkdf2 = `pbkdf2-sha256:v1:${SecurityService.getCurrentIterations()}:abc==`;
      expect(SecurityService.needsRehash(pbkdf2)).toBe(false);
    });

    it('returns false for an Argon2id hash even when the minter is on', () => {
      SecurityService.setArgon2idMinterEnabled(true);
      // The exact body bytes don't matter for `needsRehash`; only the prefix.
      const argon = 'argon2id:v1:65536:3:4:saltbase64:hashbase64';
      expect(SecurityService.needsRehash(argon)).toBe(false);
    });

    it('returns true for legacy non-prefixed hashes regardless of flag state', () => {
      expect(SecurityService.needsRehash('legacy-base64==')).toBe(true);
      SecurityService.setArgon2idMinterEnabled(true);
      expect(SecurityService.needsRehash('legacy-base64==')).toBe(true);
    });
  });
});
