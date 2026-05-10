import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiaryEntry } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { SecurityService } from '../services/securityService';
import { getInitialViewerAccessState } from '../services/viewerAccessState';
import { useTimeoutManager } from './useTimeoutManager';
import { useViewerLockout, type ViewerLockoutState } from './useViewerLockout';

export type ViewState = 'sealed' | 'opening' | 'reading';

export interface UseViewerAccessArgs {
  entry: DiaryEntry;
  masterPassword: string | null;
  isTimeLocked: boolean;
  /** Localised strings; the hook only reads `notReady`, `tooManyAttempts`,
   *  `privateKeyRequired`, `decryptionFailed`, `biometricRestricted`. */
  t: TranslationDictionary;
  /**
   * Override the lockout policy. Default: 5 attempts / 30 s. Inject
   * `{ maxAttempts: 0 }` to effectively disable lockout in tests; the
   * hook also exposes its lockout state on the return value so callers
   * can render the failure ladder.
   */
  lockoutOptions?: Parameters<typeof useViewerLockout>[0];
  /**
   * Subtle UX feedback used on failed unlock. The hook only triggers
   * the shake; rendering and timing belong to the caller. Defaults to a
   * no-op so callers without a shake animation aren't forced to pass it.
   */
  onShake?: () => void;
}

export interface ViewerAccess {
  viewState: ViewState;
  decrypted: boolean;
  decryptedContent: string;
  decryptionPassword: string;
  setDecryptionPassword: (value: string) => void;
  decryptionError: string | null;
  biometricAvailable: boolean;
  isScanning: boolean;
  biometricError: string | null;
  lockout: ViewerLockoutState;
  /** Submit the typed password and (asynchronously) reveal the entry. */
  handleOpenLetter: () => Promise<void>;
  /** WebAuthn-backed quick unlock; gracefully no-ops where unsupported. */
  handleBiometricAuth: () => Promise<void>;
}

/**
 * Owns the entire "letter is sealed → user authenticates → letter
 * opens" workflow inside the Viewer:
 *
 *  - `viewState` machine (sealed / opening / reading)
 *  - `decryptedContent` rendering buffer (only populated AFTER auth)
 *  - password input + decryption error banner
 *  - lockout ladder (delegated to `useViewerLockout`)
 *  - WebAuthn biometric quick-unlock
 *  - all the entry-change reset effects
 *
 * Pulled out of `Viewer.tsx` so the viewer file shrinks to "wire the
 * hook into the panel". Returns one big object — that's deliberate;
 * downstream view components consume the slice they care about.
 */
export const useViewerAccess = ({
  entry,
  masterPassword,
  isTimeLocked,
  t,
  lockoutOptions,
  onShake,
}: UseViewerAccessArgs): ViewerAccess => {
  const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutManager();
  const lockout = useViewerLockout(lockoutOptions ?? { maxAttempts: 5, lockoutDurationMs: 30_000 });
  const { lockoutUntil, registerFailure, resetAttempts } = lockout;

  const [viewState, setViewState] = useState<ViewState>(
    () => getInitialViewerAccessState(entry, masterPassword).viewState,
  );
  const [decrypted, setDecrypted] = useState(
    () => getInitialViewerAccessState(entry, masterPassword).decrypted,
  );
  const [decryptedContent, setDecryptedContent] = useState<string>(
    () => getInitialViewerAccessState(entry, masterPassword).decryptedContent,
  );
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [decryptionPassword, setDecryptionPassword] = useState('');

  // Biometric / WebAuthn state. We feature-detect once on mount so the
  // panel can decide whether to render the fingerprint affordance.
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          const available =
            await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!cancelled) setBiometricAvailable(available);
        }
      } catch {
        if (!cancelled) setBiometricAvailable(false);
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerShake = useCallback(() => {
    onShake?.();
  }, [onShake]);

  // Reset the access machine whenever a different entry is loaded. The
  // dependency list is intentionally narrow — depending on the whole
  // `entry` object would re-fire on unrelated mutations (attachment
  // resize, tag change) and force the user to re-authenticate.
  useEffect(() => {
    clearScheduledTimeouts();
    const initial = getInitialViewerAccessState(entry, masterPassword);
    setViewState(initial.viewState);
    setDecrypted(initial.decrypted);
    setDecryptedContent(initial.decryptedContent);
    setDecryptionError(null);
    setDecryptionPassword('');
    resetAttempts();
    setIsScanning(false);
    setBiometricError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.isEncrypted, entry.content, entry.unlockAt, masterPassword]);

  // Clear the decryption error only when the user actually *changes* the
  // password (typing into the field after a failure). We track the
  // previous value via a ref so the effect doesn't fire when our own
  // failure handler resets the input to '' — that would wipe the error
  // banner before the user could see it.
  const prevPasswordRef = useRef(decryptionPassword);
  useEffect(() => {
    if (prevPasswordRef.current === decryptionPassword) return;
    const previous = prevPasswordRef.current;
    prevPasswordRef.current = decryptionPassword;
    // Only clear when the user is *entering* characters, not when our own
    // handler reset the field after a failure.
    if (decryptionPassword.length > previous.length && decryptionError) {
      setDecryptionError(null);
    }
  }, [decryptionError, decryptionPassword]);

  const handleOpenLetter = useCallback(async () => {
    // SECURITY GUARD 0: time-lock cannot be bypassed by any means.
    if (isTimeLocked) {
      setDecryptionError(t.notReady || '时间未到，坐标锁定中');
      triggerShake();
      return;
    }

    if (viewState !== 'sealed') return;

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setDecryptionError(t.tooManyAttempts);
      triggerShake();
      return;
    }

    if (!decryptionPassword.trim()) {
      setDecryptionError(t.privateKeyRequired);
      triggerShake();
      return;
    }

    // For un-encrypted entries we still verify against the master password
    // so the unlock UX feels uniform — otherwise an attacker who knows the
    // entry isn't encrypted could just press "open" with garbage.
    if (!entry.isEncrypted) {
      if (masterPassword && decryptionPassword !== masterPassword) {
        const { lockedOutNow } = registerFailure();
        setDecryptionError(lockedOutNow ? t.tooManyAttempts : t.decryptionFailed);
        setDecryptionPassword('');
        triggerShake();
        return;
      }
    }

    setViewState('opening');
    setDecryptionError(null);
    resetAttempts();

    try {
      let content = entry.content;
      if (entry.isEncrypted) {
        content = await SecurityService.decrypt(entry.content, decryptionPassword);
      }
      // Ceremony delay so the unlock animation reads as intentional.
      scheduleTimeout(() => {
        setDecryptedContent(content);
        setViewState('reading');
        setDecrypted(true);
      }, 1200);
    } catch (err) {
      console.error('Decryption failed', err);
      const { lockedOutNow } = registerFailure();
      setDecryptionError(lockedOutNow ? t.tooManyAttempts : t.decryptionFailed);
      setViewState('sealed');
      setDecryptionPassword('');
      triggerShake();
    }
  }, [
    decryptionPassword,
    entry.content,
    entry.isEncrypted,
    isTimeLocked,
    lockoutUntil,
    masterPassword,
    registerFailure,
    resetAttempts,
    scheduleTimeout,
    t,
    triggerShake,
    viewState,
  ]);

  const handleBiometricAuth = useCallback(async () => {
    if (isTimeLocked) {
      setDecryptionError(t.notReady || '时间未到，坐标锁定中');
      triggerShake();
      return;
    }
    if (isScanning || lockoutUntil) return;

    setIsScanning(true);
    setBiometricError(null);

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const options: CredentialCreationOptions = {
        publicKey: {
          challenge,
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
      await navigator.credentials.create(options);

      setViewState('opening');
      setDecryptionError(null);
      resetAttempts();

      let content = entry.content;
      if (entry.isEncrypted && masterPassword) {
        content = await SecurityService.decrypt(entry.content, masterPassword);
      }
      scheduleTimeout(() => {
        setDecryptedContent(content);
        setViewState('reading');
        setDecrypted(true);
        setIsScanning(false);
      }, 1200);
    } catch (err: unknown) {
      console.error('Biometric error:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setBiometricError(t.biometricRestricted || 'Environment Restricted');
      } else {
        setBiometricError(err instanceof Error ? err.message : 'Auth Failed');
      }
      setIsScanning(false);
      triggerShake();
    }
  }, [
    entry.content,
    entry.isEncrypted,
    isScanning,
    isTimeLocked,
    lockoutUntil,
    masterPassword,
    resetAttempts,
    scheduleTimeout,
    t,
    triggerShake,
  ]);

  return {
    viewState,
    decrypted,
    decryptedContent,
    decryptionPassword,
    setDecryptionPassword,
    decryptionError,
    biometricAvailable,
    isScanning,
    biometricError,
    lockout,
    handleOpenLetter,
    handleBiometricAuth,
  };
};
