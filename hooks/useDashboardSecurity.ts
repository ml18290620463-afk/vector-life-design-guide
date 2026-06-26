import { useCallback, useState } from 'react';
import type { DiaryEntry } from '../types';
import { SecurityService } from '../services/securityService';
import { AppStorageKeys } from '../services/appSettings';
import { hasStoredValue, setStoredString } from '../services/browserStorage';
import { useTransientState } from './useTransientState';

export type SecurityMode = 'idle' | 'setup' | 'confirm';

export interface SecurityCopy {
  passwordRequirement: string;
  passwordMismatch: string;
  passwordVerifyFailed: string;
  passwordChangeSuccess: string;
  /** Used in the "N entries failed to decrypt" warning prompt. */
  reEncryptFailureWarning: (failCount: number) => string;
}

export interface UseDashboardSecurityArgs {
  /** Existing PBKDF2 hash (if any). Determines whether this is a first-set
   *  or a change-of-password flow. */
  passwordHash: string | null;
  /** Existing PBKDF2 salt (if any). */
  passwordSalt: string | null;
  /** Existing entries — `setup` re-encrypts every encrypted one with the
   *  new password. */
  entries: DiaryEntry[];
  /** Promote the freshly-set password into the parent's session state. */
  onSetPassword: (password: string) => void;
  /** Persist the re-encrypted entries in one batch. */
  onBulkUpdateEntries: (entries: DiaryEntry[]) => void;
  /** Localised strings the hook needs for error / success banners. */
  copy: SecurityCopy;
  /**
   * Confirmation prompt for the "N entries failed to decrypt" branch.
   * Defaults to `window.confirm`; tests inject a mock.
   */
  confirm?: (message: string) => boolean | Promise<boolean>;
  /** Optional fullscreen-overlay toggle so the UI can lock the body
   *  while the (potentially slow) re-encryption is running. */
  setIsFullscreen?: (value: boolean) => void;
}

export interface DashboardSecurity {
  securityMode: SecurityMode;
  setSecurityMode: (mode: SecurityMode) => void;
  oldPassword: string;
  setOldPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  securityError: string | null;
  securitySuccess: string | null;
  /**
   * Validate inputs, verify old password (if changing), re-encrypt every
   * encrypted entry with the new password, persist the batch, then promote
   * the new password upward.
   *
   * Returns `true` on success, `false` on any validation / verification /
   * cancellation failure (the hook also surfaces an error message via
   * `securityError`).
   */
  handleSecuritySetup: () => Promise<boolean>;
  /** Reset all four password input fields without changing securityMode. */
  resetPasswordInputs: () => void;
  /** Flash an error in the same banner the password flow uses (e.g. for
   *  the guiding-stars selection limit). Auto-clears after a few seconds. */
  showError: (message: string) => void;
}

const isPasswordStrong = (pw: string): boolean => {
  const hasUppercase = /[A-Z]/.test(pw);
  const hasLowercase = /[a-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  return pw.length >= 8 && hasUppercase && hasLowercase && hasNumber && hasSpecial;
};

const ensureRecoveryVerifier = async () => {
  if (hasStoredValue(AppStorageKeys.recoveryVerifier)) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = new Uint8Array(32);
  window.crypto.getRandomValues(random);
  let generatedRecoveryKey = '';
  for (let i = 0; i < 32; i++) {
    if (i > 0 && i % 8 === 0) generatedRecoveryKey += '-';
    generatedRecoveryKey += chars.charAt(random[i] % chars.length);
  }
  SecurityService.wipeSensitive(random);
  setStoredString(
    AppStorageKeys.recoveryVerifier,
    await SecurityService.hashRecoveryKey(generatedRecoveryKey),
  );
};

/**
 * Owns the Dashboard's "set / change master password" workflow:
 *
 *  - input state for old / new / confirm fields
 *  - transient error + success banners (auto-clear via `useTransientState`)
 *  - the actual `handleSecuritySetup` flow:
 *      1. validate strength
 *      2. verify old password (if changing)
 *      3. re-encrypt every encrypted entry with the new password
 *      4. confirm with the user if some entries fail to decrypt
 *      5. promote the new password to the parent
 *
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h. The 100-line
 * inline handler is now testable in isolation; the dashboard composes.
 */
export const useDashboardSecurity = ({
  passwordHash,
  passwordSalt,
  entries,
  onSetPassword,
  onBulkUpdateEntries,
  copy,
  confirm = (message) => window.confirm(message),
  setIsFullscreen,
}: UseDashboardSecurityArgs): DashboardSecurity => {
  const [securityMode, setSecurityMode] = useState<SecurityMode>('idle');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const {
    value: securityError,
    setValue: setSecurityError,
    showValue: showSecurityErrorTransient,
  } = useTransientState<string | null>(null);
  const {
    value: securitySuccess,
    setValue: setSecuritySuccess,
    showValue: showSecuritySuccess,
  } = useTransientState<string | null>(null);

  const resetPasswordInputs = useCallback(() => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const handleSecuritySetup = useCallback(async (): Promise<boolean> => {
    // 1. If we are *changing* an existing password, verify the old one
    //    against the stored hash before doing anything destructive.
    if (passwordHash) {
      const oldOk = await SecurityService.verifyPassword(
        oldPassword,
        passwordSalt || '',
        passwordHash,
      );
      if (!oldOk) {
        setSecurityError(copy.passwordVerifyFailed);
        return false;
      }
    }

    // 2. Strength + confirmation gates.
    if (!isPasswordStrong(newPassword)) {
      setSecurityError(copy.passwordRequirement);
      return false;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError(copy.passwordMismatch);
      return false;
    }

    setIsFullscreen?.(true);
    setSecuritySuccess('RE-ENCRYPTING DATA...');

    try {
      await ensureRecoveryVerifier();

      // 3. Re-encryption pass. We rebuild any entry whose ciphertext
      //    decrypts cleanly under the old password; entries that fail
      //    are tallied so we can warn the user before committing.
      if (passwordHash) {
        const updatedEntries: DiaryEntry[] = [];
        let failCount = 0;
        for (const entry of entries) {
          if (entry.isEncrypted) {
            try {
              const plain = await SecurityService.decrypt(entry.content, oldPassword);
              const next = await SecurityService.encrypt(plain, newPassword);
              updatedEntries.push({ ...entry, content: next });
            } catch (e) {
              console.error(`Failed to re-encrypt entry ${entry.id}`, e);
              failCount++;
            }
          }
        }

        if (failCount > 0) {
          const proceed = await confirm(copy.reEncryptFailureWarning(failCount));
          if (!proceed) {
            setIsFullscreen?.(false);
            setSecuritySuccess(null);
            return false;
          }
        }
        if (updatedEntries.length > 0) onBulkUpdateEntries(updatedEntries);
      }

      // 4. Promote upward + reset local state.
      onSetPassword(newPassword);
      setSecurityMode('idle');
      resetPasswordInputs();
      setSecurityError(null);
      showSecuritySuccess(copy.passwordChangeSuccess);
      return true;
    } catch (e) {
      console.error('Re-encryption failed', e);
      setSecurityError('CRITICAL: DATA RE-ENCRYPTION FAILED.');
      return false;
    } finally {
      setIsFullscreen?.(false);
    }
  }, [
    confirm,
    confirmPassword,
    copy,
    entries,
    newPassword,
    oldPassword,
    onBulkUpdateEntries,
    onSetPassword,
    passwordHash,
    passwordSalt,
    resetPasswordInputs,
    setIsFullscreen,
    setSecurityError,
    setSecuritySuccess,
    showSecuritySuccess,
  ]);

  return {
    securityMode,
    setSecurityMode,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    securityError,
    securitySuccess,
    handleSecuritySetup,
    resetPasswordInputs,
    showError: showSecurityErrorTransient,
  };
};
