import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  ARGON2_OWASP_MIN,
  ARGON2_OWASP_RECOMMENDED,
  deriveArgon2idBits,
  hashArgon2idPassword,
  verifyArgon2idPassword,
} from './argon2idPoc';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

describe('Argon2id PoC (Phase 3 §3.e)', () => {
  // Pin to OWASP_MIN throughout — the recommended set is ~3× the
  // memory + ~1.5× the CPU and would slow this file down by ~5×
  // without strengthening the contract under test.
  const params = ARGON2_OWASP_MIN;

  it('round-trips: hash + verify with the correct password returns true', async () => {
    const stored = await hashArgon2idPassword('correct horse battery staple', params);
    expect(stored.startsWith('argon2id:v1:')).toBe(true);
    expect(stored.split(':')).toHaveLength(7);
    expect(await verifyArgon2idPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const stored = await hashArgon2idPassword('right-pw', params);
    expect(await verifyArgon2idPassword('wrong-pw', stored)).toBe(false);
  });

  it('embeds the parameter set in the stored hash', async () => {
    const stored = await hashArgon2idPassword('pw', params);
    const [prefix, version, mem, iter, par] = stored.split(':');
    expect(prefix).toBe('argon2id');
    expect(version).toBe('v1');
    expect(Number(mem)).toBe(params.memoryKib);
    expect(Number(iter)).toBe(params.iterations);
    expect(Number(par)).toBe(params.parallelism);
  });

  it('is deterministic given identical password + salt + params', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await deriveArgon2idBits('pw', salt, params);
    const b = await deriveArgon2idBits('pw', salt, params);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length).toBe(params.hashLength);
  });

  it('produces a different output when the salt changes', async () => {
    const a = await deriveArgon2idBits('pw', new Uint8Array(16).fill(1), params);
    const b = await deriveArgon2idBits('pw', new Uint8Array(16).fill(2), params);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('rejects malformed stored hashes (PBKDF2 prefix, short, oversized params)', async () => {
    expect(await verifyArgon2idPassword('pw', 'pbkdf2-sha256:v1:600000:abc')).toBe(false);
    expect(await verifyArgon2idPassword('pw', 'argon2id:v1:bad')).toBe(false);
    expect(await verifyArgon2idPassword('pw', 'argon2id:v1:99999999:99:99:zz:zz')).toBe(false);
  });

  it('honours the recommended parameter set without crashing', async () => {
    // Cheap smoke test on the heavier preset; round-trip only,
    // no derivative comparison.
    const stored = await hashArgon2idPassword('heavy-pw', ARGON2_OWASP_RECOMMENDED);
    expect(await verifyArgon2idPassword('heavy-pw', stored)).toBe(true);
  }, 30_000);
});
