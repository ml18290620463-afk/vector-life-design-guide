import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface MasterLockUnlockFormProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  password: string;
  onPasswordChange: (value: string) => void;
  showUnlockPassword: boolean;
  onToggleShowPassword: () => void;
  onSubmit: () => void;
  isDecrypting: boolean;
  isScanning: boolean;
  isSuccess: boolean;
  isRitualActive: boolean;
  error: boolean;
  biometricError: string | null;
  lockout: { isLocked: boolean; secondsRemaining: number };
  onForgotPassword: () => void;
}

const MIN_PASSWORD_LENGTH = 4;

/** A quiet, readable entry point. Verification logic remains in MasterLock. */
export const MasterLockUnlockForm: React.FC<MasterLockUnlockFormProps> = ({
  language, t, password, onPasswordChange, showUnlockPassword, onToggleShowPassword,
  onSubmit, isDecrypting, isScanning, isSuccess, isRitualActive, error,
  biometricError, lockout, onForgotPassword,
}) => {
  const inputDisabled = isRitualActive || isDecrypting || lockout.isLocked || isScanning || isSuccess;
  const forgotPasswordLabel = language === 'zh' ? '忘记密码 使用通行私钥' : 'Forgot password? Use recovery credential';
  const wrongPasswordLabel = language === 'zh' ? '密令未能唤醒这段记忆' : 'Access code could not wake this memory';
  const isBusy = isDecrypting || isScanning || isRitualActive;
  const submitText = language === 'zh' ? (isBusy ? '验证中…' : '进入') : (isBusy ? 'DECRYPTING...' : 'CONNECT');
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && password.length >= MIN_PASSWORD_LENGTH && !isRitualActive && !lockout.isLocked && !isScanning && !isSuccess) onSubmit();
  };

  return (
    <div className="master-unlock-form w-full">
      <div className="master-unlock-title-block">
        <h2>通行密令</h2>
        <p>{language === 'zh' ? '用你的密令进入此刻。' : 'Enter your code to return to this moment.'}</p>
      </div>
      <div className="master-password-area">
        <label className="sr-only" htmlFor="master-password-input">{t.enterMasterPassword ?? t.masterLock}</label>
        <div className={`master-password-field ${error ? 'master-password-field--error' : ''}`}>
          <input id="master-password-input" autoFocus type={showUnlockPassword ? 'text' : 'password'} value={password}
            onChange={(e) => onPasswordChange(e.target.value)} onKeyDown={handleKeyDown} disabled={inputDisabled}
            aria-label={t.enterMasterPassword ?? t.masterLock} placeholder={lockout.isLocked ? 'LOCKED' : '输入通行密令'} />
          <button type="button" className="master-password-toggle" onClick={onToggleShowPassword}
            aria-label={showUnlockPassword ? (t.hidePassword ?? 'Hide password') : (t.showPassword ?? 'Show password')}
            aria-pressed={showUnlockPassword} disabled={inputDisabled}>
            {showUnlockPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {(error || biometricError || lockout.isLocked) && (
          <p className="master-unlock-message" role="alert">
            {biometricError ?? (lockout.isLocked ? `Too many attempts (${lockout.secondsRemaining}s)` : wrongPasswordLabel)}
          </p>
        )}
      </div>
      <button type="button" className="master-connect-button" onClick={onSubmit}
        disabled={inputDisabled || password.length < MIN_PASSWORD_LENGTH} aria-label={submitText}>
        {submitText}
      </button>
      <button type="button" className="master-forgot-password" onClick={onForgotPassword} disabled={isBusy}>
        {forgotPasswordLabel}
      </button>
    </div>
  );
};
