import { useCallback, useEffect, useState } from 'react';
import {
  listTrustedDevices,
  relabelTrustedPublicKey,
  revokeTrustedPublicKey,
  type TrustedDevice,
} from '../services/trustedDevices';

/**
 * Phase 4 §4.b-3 follow-up (K1) — `useTrustedDevices`
 *
 * React-side wrapper around `services/trustedDevices.ts`. The
 * service is already used directly inside `useMigrationWizard` for
 * the TOFU lookup (single-shot, no React state needed there); this
 * hook is for the **Settings → Trusted devices panel** which needs
 * to render the list, react to revoke / relabel actions, and
 * refresh after the migration wizard adds new entries.
 *
 * Lifecycle:
 *   - Mount: load list from IDB.
 *   - On revoke / relabel: optimistic local update + persist; on
 *     persist failure, log + reload from IDB to converge state.
 *   - Tests: pass `now` from `Date.now()` like the other hooks; we
 *     don't mock time here because the hook doesn't depend on it.
 *
 * The hook deliberately does NOT subscribe to a "trusted set
 * changed" event — the Settings panel is short-lived and a manual
 * `reload()` exposed for callers that want to refresh after the
 * migration wizard added a new entry.
 */

export interface UseTrustedDevicesResult {
  /** All trust records, most-recently-trusted first. */
  trusted: readonly TrustedDevice[];
  /** True until the first IDB load completes. */
  loading: boolean;
  /** Force a reload from IDB. Useful after the migration wizard
   *  added a new trust record while the panel is open. */
  reload: () => Promise<void>;
  /** Remove a trust record by publicKey. Optimistic. */
  revoke: (publicKey: string) => Promise<void>;
  /** Update a trust record's label. Optimistic. */
  relabel: (publicKey: string, nextLabel: string) => Promise<void>;
}

export const useTrustedDevices = (): UseTrustedDevicesResult => {
  const [trusted, setTrusted] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const next = await listTrustedDevices();
      setTrusted(next);
    } catch (err) {
      console.warn('useTrustedDevices: reload failed', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await listTrustedDevices();
        if (!cancelled) setTrusted(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const revoke = useCallback(
    async (publicKey: string) => {
      // Optimistic local update first so the panel feels instant.
      setTrusted((prev) => prev.filter((t) => t.publicKey !== publicKey));
      try {
        await revokeTrustedPublicKey(publicKey);
      } catch (err) {
        console.warn('useTrustedDevices: revoke failed; reloading', err);
        await reload();
      }
    },
    [reload],
  );

  const relabel = useCallback(
    async (publicKey: string, nextLabel: string) => {
      const trimmed = nextLabel.slice(0, 80);
      setTrusted((prev) =>
        prev.map((t) => (t.publicKey === publicKey ? { ...t, label: trimmed } : t)),
      );
      try {
        await relabelTrustedPublicKey(publicKey, trimmed);
      } catch (err) {
        console.warn('useTrustedDevices: relabel failed; reloading', err);
        await reload();
      }
    },
    [reload],
  );

  return { trusted, loading, reload, revoke, relabel };
};
