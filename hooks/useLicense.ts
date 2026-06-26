import { useCallback, useEffect, useState } from 'react';
import {
  clearLicense,
  getOrCreateInstallId,
  loadLicense,
  saveLicense,
  type LoadLicenseFailure,
} from '../services/licenseStore';
import type { LicensePayload, LicenseTier } from '../services/licenseToken';

/**
 * Phase 5 §5.1 — `useLicense`
 *
 * React hook around `services/licenseStore.ts`. Resolves the
 * device's anonymous install id, hydrates the persisted license
 * (if any), and exposes `activate(token)` / `deactivate()` for
 * the Settings UI.
 *
 * Tier resolution:
 *   - When `payload.tier` is present (and the token is valid +
 *     unexpired + matches install id), `currentTier` is the
 *     paid tier from the token.
 *   - When `result.reason === 'no-token'` (the user just hasn't
 *     activated yet), `currentTier` is `'free'` silently — no
 *     error message in the UI.
 *   - For any other failure (`expired` / `invalid-signature` /
 *     `install-mismatch`), `currentTier` falls back to `'free'`
 *     AND `failure` is non-null so Settings can surface a banner.
 *
 * The hook deliberately doesn't auto-refresh on a timer; the
 * Settings UI re-runs `activate` after the user pastes a new
 * token, which triggers a state update.
 */

export type CurrentTier = 'free' | LicenseTier;

export interface UseLicenseResult {
  installId: string;
  loading: boolean;
  currentTier: CurrentTier;
  /** Decoded license payload when ok; null otherwise. */
  payload: LicensePayload | null;
  /** Non-null when verification failed for a non-`no-token`
   *  reason. The Settings UI maps this to a localised banner. */
  failure: LoadLicenseFailure | null;
  /** Persist a freshly-pasted token. Returns the failure reason
   *  on a bad token (UI shows it inline) or `null` on success. */
  activate: (token: string) => Promise<LoadLicenseFailure | null>;
  /** Drop the stored token (e.g. user cancelled the
   *  subscription). Resolves once IDB write completes. */
  deactivate: () => Promise<void>;
  /** Force a re-load from IDB. Useful after Phase 5.2's Stripe
   *  redirect lands on the dashboard with a freshly-issued
   *  token in the URL. */
  reload: () => Promise<void>;
}

export const useLicense = (): UseLicenseResult => {
  const [installId] = useState<string>(() => getOrCreateInstallId());
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<LicensePayload | null>(null);
  const [failure, setFailure] = useState<LoadLicenseFailure | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadLicense(installId);
    if (result.ok === true) {
      setPayload(result.payload);
      setFailure(null);
      return;
    }
    setPayload(null);
    // 'no-token' is the silent default (free user) — don't
    // surface it as an error to the UI.
    setFailure(result.reason === 'no-token' ? null : result.reason);
  }, [installId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const activate = useCallback<UseLicenseResult['activate']>(
    async (token) => {
      const result = await saveLicense(token.trim(), installId);
      if (result.ok === false) {
        setPayload(null);
        setFailure(result.reason);
        return result.reason;
      }
      setPayload(result.payload);
      setFailure(null);
      return null;
    },
    [installId],
  );

  const deactivate = useCallback<UseLicenseResult['deactivate']>(async () => {
    await clearLicense();
    setPayload(null);
    setFailure(null);
  }, []);

  const currentTier: CurrentTier = payload ? payload.tier : 'free';

  return {
    installId,
    loading,
    currentTier,
    payload,
    failure,
    activate,
    deactivate,
    reload: refresh,
  };
};
