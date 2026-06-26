import { SecurityService } from './securityService';

/**
 * Phase 4.5 §C — `services/passwordRehash.ts`
 *
 * Background opportunistic re-mint of the master-password hash.
 * Runs after every successful unlock (`App.tsx` calls
 * `maybeRehashOnUnlock`); when the stored hash is no longer the
 * preferred shape — typically a legacy PBKDF2 hash on an install
 * that has just had Argon2id auto-enabled — we silently re-derive
 * the hash from the user's plaintext password and persist the new
 * Argon2id record via the supplied `savePasswordHash` callback.
 *
 * Design constraints:
 *   - **Never blocks UI**. The unlock flow already completed; this
 *     runs as a fire-and-forget on the next event tick.
 *   - **Never throws to the caller**. A rehash failure must not
 *     surface as a unlock failure — it just means the user keeps
 *     the legacy hash for one more session.
 *   - **Never mutates `passwordSalt`** when the new algorithm is
 *     Argon2id (the Argon2id record is self-describing and embeds
 *     its own salt; the legacy `passwordSalt` storage value is
 *     left in place so verification can still fall back if the
 *     new hash is itself somehow corrupted before the next
 *     unlock).
 *   - **Idempotent**. `needsRehash` returning false short-circuits
 *     before any expensive crypto work.
 *
 * Privacy posture: no data leaves the device. The password is
 * processed in-memory once, the hash is written back to the same
 * IndexedDB key, and we make no other I/O.
 */

export interface MaybeRehashArgs {
  /** Plaintext password the user just entered (still in-memory
   *  from the unlock flow). */
  password: string;
  /** The salt that was passed to the previous `verifyPassword` call
   *  — used by the PBKDF2 branch of `hashPassword` if Argon2id is
   *  not the preferred minter. Argon2id ignores this. */
  passwordSalt: string | null;
  /** The hash that was just successfully verified. */
  storedHash: string | null;
  /** Persistence callback — typically wired to
   *  `useDiaryData.savePasswordHash`. */
  savePasswordHash: (hash: string) => Promise<void> | void;
  /** Optional injection for tests. Defaults to `SecurityService`. */
  service?: typeof SecurityService;
}

export type RehashOutcome =
  /** Rehash was not needed (current hash is already preferred). */
  | { kind: 'skipped'; reason: 'no-rehash-needed' | 'no-stored-hash' }
  /** Rehash succeeded and the new hash was persisted. */
  | { kind: 'rehashed'; newHashPrefix: string }
  /** Rehash was attempted but a non-fatal step failed. The unlock
   *  path is unaffected — the user simply keeps the legacy hash. */
  | { kind: 'failed'; reason: 'hash-failed' | 'persist-failed' };

/**
 * Run the opportunistic rehash. Always resolves; never rejects.
 *
 * The function is **deliberately not awaited** by the unlock path —
 * call it as `void maybeRehashOnUnlock({...})` so the rehash runs
 * in the background and the user gets to the dashboard instantly.
 */
export const maybeRehashOnUnlock = async (args: MaybeRehashArgs): Promise<RehashOutcome> => {
  const service = args.service ?? SecurityService;
  if (!args.storedHash) {
    return { kind: 'skipped', reason: 'no-stored-hash' };
  }
  if (!service.needsRehash(args.storedHash)) {
    return { kind: 'skipped', reason: 'no-rehash-needed' };
  }
  let newHash: string;
  try {
    newHash = await service.hashPassword(args.password, args.passwordSalt ?? '');
  } catch (err) {
    console.warn('passwordRehash: hashPassword threw, keeping legacy hash', err);
    return { kind: 'failed', reason: 'hash-failed' };
  }
  // Defensive: if the new hash is identical to the old (would mean
  // hashPassword no-op'd because the minter flag flipped off
  // mid-flight), don't write — the persist call would still work
  // but we want the outcome to reflect reality.
  if (newHash === args.storedHash) {
    return { kind: 'skipped', reason: 'no-rehash-needed' };
  }
  try {
    await args.savePasswordHash(newHash);
  } catch (err) {
    console.warn('passwordRehash: savePasswordHash threw', err);
    return { kind: 'failed', reason: 'persist-failed' };
  }
  // newHashPrefix is the algorithm tag (`argon2id:v1` or
  // `pbkdf2-sha256:v1`) — handy for telemetry without leaking the
  // full hash string.
  const newHashPrefix = newHash.split(':').slice(0, 2).join(':');
  return { kind: 'rehashed', newHashPrefix };
};
