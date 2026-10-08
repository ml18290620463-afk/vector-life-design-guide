import { describe, expect, it, vi } from 'vitest';
import { maybeRehashOnUnlock } from './passwordRehash';
import type { SecurityService } from './securityService';

const buildService = (over: Partial<typeof SecurityService>) =>
  ({
    needsRehash: vi.fn().mockReturnValue(false),
    hashPassword: vi.fn(),
    ...over,
  }) as unknown as typeof SecurityService;

describe('services/passwordRehash', () => {
  it('returns skipped/no-stored-hash when storedHash is null', async () => {
    const savePasswordHash = vi.fn();
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: null,
      savePasswordHash,
      service: buildService({}),
    });
    expect(out).toEqual({ kind: 'skipped', reason: 'no-stored-hash' });
    expect(savePasswordHash).not.toHaveBeenCalled();
  });

  it('returns skipped/no-rehash-needed when needsRehash() is false', async () => {
    const savePasswordHash = vi.fn();
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(false),
    });
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: 'pbkdf2-sha256:v1:600000:abc',
      savePasswordHash,
      service,
    });
    expect(out).toEqual({ kind: 'skipped', reason: 'no-rehash-needed' });
    expect(savePasswordHash).not.toHaveBeenCalled();
  });

  it('rehashes + persists when needsRehash() is true', async () => {
    const savePasswordHash = vi.fn().mockResolvedValue(undefined);
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(true),
      hashPassword: vi.fn().mockResolvedValue('argon2id:v1:65536:3:4:abc:def'),
    });
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: 'pbkdf2-sha256:v1:600000:abc',
      savePasswordHash,
      service,
    });
    expect(out).toEqual({ kind: 'rehashed', newHashPrefix: 'argon2id:v1' });
    expect(savePasswordHash).toHaveBeenCalledWith('argon2id:v1:65536:3:4:abc:def');
  });

  it('returns failed/hash-failed when hashPassword throws', async () => {
    const savePasswordHash = vi.fn();
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(true),
      hashPassword: vi.fn().mockRejectedValue(new Error('wasm load failed')),
    });
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: 'pbkdf2-sha256:v1:600000:abc',
      savePasswordHash,
      service,
    });
    expect(out).toEqual({ kind: 'failed', reason: 'hash-failed' });
    expect(savePasswordHash).not.toHaveBeenCalled();
  });

  it('returns failed/persist-failed when savePasswordHash throws', async () => {
    const savePasswordHash = vi.fn().mockRejectedValue(new Error('IDB busy'));
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(true),
      hashPassword: vi.fn().mockResolvedValue('argon2id:v1:abc:def'),
    });
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: 'pbkdf2-sha256:v1:600000:abc',
      savePasswordHash,
      service,
    });
    expect(out).toEqual({ kind: 'failed', reason: 'persist-failed' });
  });

  it('skips persist when the new hash is identical to the stored one', async () => {
    const savePasswordHash = vi.fn();
    const same = 'pbkdf2-sha256:v1:600000:abc';
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(true),
      hashPassword: vi.fn().mockResolvedValue(same),
    });
    const out = await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: 'salt',
      storedHash: same,
      savePasswordHash,
      service,
    });
    expect(out).toEqual({ kind: 'skipped', reason: 'no-rehash-needed' });
    expect(savePasswordHash).not.toHaveBeenCalled();
  });

  it('honours an empty passwordSalt by passing empty string to hashPassword', async () => {
    const hashPassword = vi.fn().mockResolvedValue('argon2id:v1:abc');
    const service = buildService({
      needsRehash: vi.fn().mockReturnValue(true),
      hashPassword,
    });
    await maybeRehashOnUnlock({
      password: 'secret',
      passwordSalt: null,
      storedHash: 'pbkdf2-sha256:v1:600000:abc',
      savePasswordHash: vi.fn().mockResolvedValue(undefined),
      service,
    });
    expect(hashPassword).toHaveBeenCalledWith('secret', '');
  });
});
