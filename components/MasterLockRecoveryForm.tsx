import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { RecoveryFlowState } from '../hooks/useRecoveryFlow';

interface MasterLockRecoveryFormProps {
  theme: Theme;
  t: TranslationDictionary;
  recovery: RecoveryFlowState;
}

export const MasterLockRecoveryForm: React.FC<MasterLockRecoveryFormProps> = ({ t, recovery }) => {
  const passwordLabel = (showing: boolean) =>
    showing ? (t.hidePassword ?? 'Hide password') : (t.showPassword ?? 'Show password');
  return (
    <div className="master-recovery-form w-full">
      <div className="master-recovery-heading">
        <h2>{t.resetPassword}</h2>
        <p>{t.inputRecoveryKey}</p>
      </div>
      <div className="master-recovery-fields">
        <Field
          id="recovery-key-input"
          label={t.recoveryKeyTitle}
          value={recovery.recoveryInput}
          onChange={recovery.setRecoveryInput}
          show={recovery.showKey}
          toggle={recovery.toggleShowKey}
          toggleLabel={recovery.showKey ? 'Hide recovery key' : 'Show recovery key'}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
        <Field
          id="recovery-new-input"
          label={t.newPassword}
          value={recovery.newPassword}
          onChange={recovery.setNewPassword}
          show={recovery.showNewPassword}
          toggle={recovery.toggleShowNewPassword}
          toggleLabel={passwordLabel(recovery.showNewPassword)}
        />
        <Field
          id="recovery-confirm-input"
          label={t.confirmPassword}
          value={recovery.confirmNewPassword}
          onChange={recovery.setConfirmNewPassword}
          show={recovery.showNewPassword}
          toggle={recovery.toggleShowNewPassword}
          toggleLabel={passwordLabel(recovery.showNewPassword)}
        />
      </div>
      {recovery.resetError && (
        <p className="master-recovery-error" role="alert">
          {recovery.resetError}
        </p>
      )}
      <button
        type="button"
        className="master-recovery-submit"
        onClick={recovery.submitRecovery}
        disabled={recovery.isSubmitting}
      >
        {recovery.isSubmitting ? '处理中…' : t.resetPassword}
      </button>
    </div>
  );
};

function Field({
  id,
  label,
  value,
  onChange,
  show,
  toggle,
  toggleLabel,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  toggle: () => void;
  toggleLabel: string;
  placeholder?: string;
}) {
  return (
    <div className="master-recovery-field">
      <label htmlFor={id}>{label}</label>
      <div>
        <input
          id={id}
          aria-label={label}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
        />
        <button type="button" onClick={toggle} aria-label={toggleLabel} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
