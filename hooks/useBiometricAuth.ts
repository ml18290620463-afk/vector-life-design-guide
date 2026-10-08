import { useCallback, useEffect, useState } from 'react';
import { useTimeoutManager } from './useTimeoutManager';

export interface UseBiometricAuthArgs {
  /** Localised "Environment Restricted" copy for `NotAllowedError`. */
  restrictedMessage: string;
  /** Localised "Biometrics verified, but password still required" copy. */
  postSuccessHint: string;
  /** Disable scanning entirely (e.g. while the lockout timer is armed). */
  disabled?: boolean;
  /** Override `navigator.credentials.create` for tests. */
  createCredential?: (options: CredentialCreationOptions) => Promise<Credential | null>;
  /** Override `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable`
   *  for tests. */
  probeAvailable?: () => Promise<boolean>;
  /** Sleep duration after a successful WebAuthn ceremony before the
   *  hook surfaces the post-success hint. Defaults to 1000 ms (matches
   *  the original MasterLock UX). */
  postSuccessDelayMs?: number;
}

export interface BiometricAuth {
  /** True when WebAuthn is available on this platform (probe completed). */
  available: boolean;
  /** True while a scan ceremony is in flight. */
  isScanning: boolean;
  /** Transient success flag; goes true the moment the ceremony resolves
   *  and stays true for `postSuccessDelayMs` so the parent can play a
   *  "verified" animation. */
  isSuccess: boolean;
  /** Inline error / hint banner text (also used to surface the
   *  "biometrics verified but password still required" UX nudge). */
  error: string | null;
  /** Trigger a fresh WebAuthn ceremony. No-op while `disabled` /
   *  `isScanning`. */
  authenticate: () => Promise<void>;
  /** Manually clear the inline error / hint. */
  clearError: () => void;
}

const DEFAULT_OPTIONS: CredentialCreationOptions = {
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: 'VECTOR_TRACE' },
    user: {
      id: new Uint8Array(16),
      name: 'local-user',
      displayName: 'Local User',
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    timeout: 60000,
  },
};

/**
 * Encapsulates the WebAuthn-backed "proof of presence" flow used by
 * `MasterLock` (and the Viewer). Exposes:
 *
 *   - `available`: feature-detect for `PublicKeyCredential`. Probed once
 *     on mount.
 *   - `authenticate()`: build a fresh challenge, run the ceremony, set
 *     `isScanning` while it's in flight, set `isSuccess` for
 *     `postSuccessDelayMs` afterwards, then surface a "verified — but
 *     password still required" hint.
 *
 * The callback signatures use injectable test seams (`createCredential`
 * / `probeAvailable`) so unit tests don't need a real authenticator.
 *
 * Pulled out of `MasterLock.tsx` as part of Phase 2 §2.i.
 */
export const useBiometricAuth = ({
  restrictedMessage,
  postSuccessHint,
  disabled = false,
  createCredential,
  probeAvailable,
  postSuccessDelayMs = 1000,
}: UseBiometricAuthArgs): BiometricAuth => {
  const { scheduleTimeout } = useTimeoutManager();
  const [available, setAvailable] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature-detect once on mount.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        if (probeAvailable) {
          const ok = await probeAvailable();
          if (!cancelled) setAvailable(ok);
          return;
        }
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          const ok =
            await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!cancelled) setAvailable(ok);
        }
      } catch (e) {
        console.warn('Biometric availability probe restricted by environment policy', e);
        if (!cancelled) setAvailable(false);
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, [probeAvailable]);

  const clearError = useCallback(() => setError(null), []);

  const authenticate = useCallback(async () => {
    if (isScanning || disabled) return;

    setIsScanning(true);
    setError(null);

    try {
      // Build a fresh challenge each time so the ceremony cannot be
      // replayed even within a single MasterLock mount.
      const challenge = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(challenge);
      }
      const options: CredentialCreationOptions = {
        ...DEFAULT_OPTIONS,
        publicKey: { ...DEFAULT_OPTIONS.publicKey!, challenge },
      };

      const create = createCredential ?? ((opts) => navigator.credentials.create(opts));
      await create(options);

      setIsSuccess(true);
      // Hold the success state for the requested grace period so the
      // parent can play a verified animation, then surface the hint.
      scheduleTimeout(() => {
        setIsSuccess(false);
        setIsScanning(false);
        setError(postSuccessHint);
      }, postSuccessDelayMs);
    } catch (err: unknown) {
      console.error('Biometric error:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError(restrictedMessage);
      } else {
        setError(err instanceof Error ? err.message : 'Auth Failed');
      }
      setIsScanning(false);
    }
  }, [
    createCredential,
    disabled,
    isScanning,
    postSuccessDelayMs,
    postSuccessHint,
    restrictedMessage,
    scheduleTimeout,
  ]);

  return { available, isScanning, isSuccess, error, authenticate, clearError };
};
