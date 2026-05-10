import { useCallback, useState } from 'react';
import { Language } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';
import { SecurityService } from '../services/securityService';

interface UseRecoveryFlowOptions {
  language: Language;
  t: TranslationDictionary;
  /**
   * Called when a recovery key + new password pair successfully validates.
   * Falls back to `onUnlock` when the host doesn't supply a dedicated
   * reset handler so the existing MasterLock contract keeps working.
   */
  onResetPassword?: (password: string) => void;
  onUnlock: (password: string) => void;
}

export interface RecoveryFlowState {
  isRecoveryMode: boolean;
  recoveryInput: string;
  newPassword: string;
  confirmNewPassword: string;
  /** User-facing validation error; consumers should render verbatim. */
  resetError: string | null;
  showKey: boolean;
  showNewPassword: boolean;
  setIsRecoveryMode: (next: boolean) => void;
  setRecoveryInput: (next: string) => void;
  setNewPassword: (next: string) => void;
  setConfirmNewPassword: (next: string) => void;
  toggleShowKey: () => void;
  toggleShowNewPassword: () => void;
  /**
   * Validate the recovery key, the new password's strength, and the
   * confirmation match. Resolves regardless of outcome; check
   * `resetError` after the await for the user-facing failure reason.
   */
  submitRecovery: () => Promise<void>;
}

/**
 * Encapsulates the "forgot password → recovery key → new password"
 * branch of MasterLock. Pulled out as part of Phase 2 §2.i so the
 * MasterLock view file can shrink toward the 350-LOC target without
 * losing the multi-step state machine.
 *
 * Validation rules mirror the original inline implementation:
 *
 *  - Recovery key is normalised (strip dashes, upper-case, trim) and
 *    validated against the stored verifier; if the verifier is still
 *    in legacy plain-text form, an upgraded SHA-256 hash is persisted
 *    on success so future verifications run constant-time.
 *  - The new password must be ≥8 chars and include upper, lower,
 *    digit and special characters (matches `Onboarding`).
 *  - Confirmation must match exactly.
 *
 * Failure messages are localised on the spot — short labels live here
 * because the recovery flow is the only place that needs them and
 * adding two i18n keys for two strings would be more churn than payoff.
 */
const validateNewPassword = (password: string) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^a-zA-Z0-9]/.test(password);

export const useRecoveryFlow = ({
  language,
  t,
  onResetPassword,
  onUnlock,
}: UseRecoveryFlowOptions): RecoveryFlowState => {
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const submitRecovery = useCallback(async () => {
    setResetError(null);
    const storedRecovery = getStoredString(AppStorageKeys.recoveryVerifier);
    const cleanInput = recoveryInput.replace(/-/g, '').trim().toUpperCase();

    if (!(await SecurityService.verifyRecoveryKey(cleanInput, storedRecovery))) {
      setResetError(
        language === 'zh' ? '救急锚点验证失败' : 'Emergency Anchor verification failed',
      );
      return;
    }

    if (!SecurityService.recoveryKeyIsHashed(storedRecovery)) {
      setStoredString(
        AppStorageKeys.recoveryVerifier,
        await SecurityService.hashRecoveryKey(cleanInput),
      );
    }

    if (cleanInput.length !== 32) {
      setResetError(language === 'zh' ? '凭证长度异常' : 'Invalid credential length');
      return;
    }

    if (!validateNewPassword(newPassword)) {
      setResetError(t.passwordRequirement);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetError(t.passwordMismatch);
      return;
    }

    if (onResetPassword) {
      onResetPassword(newPassword);
    } else {
      onUnlock(newPassword);
    }
  }, [recoveryInput, newPassword, confirmNewPassword, language, t, onResetPassword, onUnlock]);

  const toggleShowKey = useCallback(() => setShowKey((prev) => !prev), []);
  const toggleShowNewPassword = useCallback(() => setShowNewPassword((prev) => !prev), []);

  return {
    isRecoveryMode,
    recoveryInput,
    newPassword,
    confirmNewPassword,
    resetError,
    showKey,
    showNewPassword,
    setIsRecoveryMode,
    setRecoveryInput,
    setNewPassword,
    setConfirmNewPassword,
    toggleShowKey,
    toggleShowNewPassword,
    submitRecovery,
  };
};
