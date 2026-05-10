import { useCallback, useEffect, useState } from 'react';
import { SecurityService } from '../services/securityService';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';
import { useTimeoutManager } from './useTimeoutManager';

export interface UseDashboardVaultArgs {
  /** Whether the master password is currently in memory (post-MasterLock). */
  isUnlocked: boolean;
  /** Stored PBKDF2 hash; missing means no master password set yet. */
  passwordHash: string | null;
  /** Stored PBKDF2 salt; required to verify any typed password. */
  passwordSalt: string | null;
  /** Promote a freshly verified password into the parent's session state. */
  onSetPassword: (password: string) => void;
  /** How long to flash the "wrong password" error before clearing. */
  errorFlashMs?: number;
}

export interface DashboardVault {
  /** Whether the vault content (encrypted entry grid) is currently revealed. */
  isVaultOpen: boolean;
  /** Whether the password-prompt overlay is currently shown. */
  isVerifyingVault: boolean;
  /** Controlled value for the password input. */
  vaultPassword: string;
  /** Setter for the password input. */
  setVaultPassword: (value: string) => void;
  /** Whether the wrong-password error banner is currently flashing. */
  vaultError: boolean;
  /** Header click — open if unlocked, dismiss if open, prompt otherwise. */
  handleToggleVault: () => void;
  /** Submit the typed password; on success opens the vault. */
  handleVaultUnlock: () => Promise<void>;
  /** Cancel the prompt without changing vault state. */
  handleVaultCancel: () => void;
}

/**
 * Owns the Dashboard's "vault is sealed → user types master password →
 * vault opens" interaction:
 *
 *  - persisted `isVaultOpen` flag (only reflected back to localStorage
 *    when `isUnlocked` is also true so a session lock collapses the
 *    visible vault automatically)
 *  - in-memory `isVerifyingVault` overlay state
 *  - controlled password input + flashing failure banner
 *  - delegates the actual hash check to `SecurityService.verifyPassword`
 *
 * Pulled out of `Dashboard.tsx` so the dashboard file shrinks to its
 * compositional role (Phase 2 §2.h). Returns one object — downstream
 * components consume the slice they care about.
 */
export const useDashboardVault = ({
  isUnlocked,
  passwordHash,
  passwordSalt,
  onSetPassword,
  errorFlashMs = 2000,
}: UseDashboardVaultArgs): DashboardVault => {
  const { scheduleTimeout } = useTimeoutManager();

  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(() => {
    const saved = getStoredString(AppStorageKeys.vaultUnlocked);
    return saved === 'true' && isUnlocked;
  });
  const [isVerifyingVault, setIsVerifyingVault] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultError, setVaultError] = useState(false);

  // Whenever the parent app collapses to "locked" (logout, idle timeout,
  // master-password change), force the vault closed and clear the
  // persisted flag so a refresh doesn't re-open it.
  useEffect(() => {
    if (!isUnlocked) {
      setIsVaultOpen(false);
      setStoredString(AppStorageKeys.vaultUnlocked, 'false');
    }
  }, [isUnlocked]);

  const handleToggleVault = useCallback(() => {
    if (isVaultOpen) {
      setIsVaultOpen(false);
      setStoredString(AppStorageKeys.vaultUnlocked, 'false');
      return;
    }
    if (isUnlocked) {
      // Already session-unlocked — open immediately, no prompt.
      setIsVaultOpen(true);
      setStoredString(AppStorageKeys.vaultUnlocked, 'true');
      return;
    }
    // Cold open without an in-memory password — show the prompt.
    setIsVerifyingVault(true);
  }, [isUnlocked, isVaultOpen]);

  const flashError = useCallback(() => {
    setVaultError(true);
    scheduleTimeout(() => setVaultError(false), errorFlashMs);
  }, [errorFlashMs, scheduleTimeout]);

  const handleVaultUnlock = useCallback(async () => {
    if (!vaultPassword) return;
    try {
      const isValid = await SecurityService.verifyPassword(
        vaultPassword,
        passwordSalt || '',
        passwordHash,
      );
      if (isValid) {
        setIsVaultOpen(true);
        setStoredString(AppStorageKeys.vaultUnlocked, 'true');
        setIsVerifyingVault(false);
        setVaultPassword('');
        setVaultError(false);
        onSetPassword(vaultPassword);
      } else {
        flashError();
      }
    } catch {
      flashError();
    }
  }, [flashError, onSetPassword, passwordHash, passwordSalt, vaultPassword]);

  const handleVaultCancel = useCallback(() => {
    setIsVerifyingVault(false);
    setVaultPassword('');
    setVaultError(false);
  }, []);

  return {
    isVaultOpen,
    isVerifyingVault,
    vaultPassword,
    setVaultPassword,
    vaultError,
    handleToggleVault,
    handleVaultUnlock,
    handleVaultCancel,
  };
};
