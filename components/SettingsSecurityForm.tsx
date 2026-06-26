import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { SettingsArgon2idToggle } from './SettingsArgon2idToggle';

interface SettingsSecurityFormProps {
  theme: Theme;
  t: TranslationDictionary;
  /** When non-null, the "old password" field is rendered (change-password
   *  flow); when null, this is a first-set flow. */
  passwordHash: string | null;
  oldPassword: string;
  setOldPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  /** Inline error banner (shown when validation or verification fails). */
  securityError: string | null;
  /** Inline success banner (shown after a successful change). */
  securitySuccess: string | null;
  /** Cancel + back button (sets `securityMode` to `'idle'`). */
  onCancel: () => void;
  /** Submit the form (delegates to `useDashboardSecurity.handleSecuritySetup`). */
  onSubmit: () => void;
}

/**
 * The "Set / change master password" inline form inside Settings.
 * Pure presentation — all the validation, verification and
 * re-encryption work lives in `useDashboardSecurity`. Pulled out of
 * `SettingsPanel.tsx` as part of Phase 2 §2.j.
 */
export const SettingsSecurityForm: React.FC<SettingsSecurityFormProps> = ({
  theme,
  t,
  passwordHash,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  securityError,
  securitySuccess,
  onCancel,
  onSubmit,
}) => (
  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
    <div className="flex items-center gap-4 mb-2">
      <button
        onClick={onCancel}
        aria-label={t.cancel}
        className={`p-2 rounded-full ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-cyan-950/30 text-cyan-800'}`}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h4 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}>
        {t.securityCalibration}
      </h4>
    </div>
    <div
      className={`p-6 rounded-2xl border space-y-6 ${theme === 'light' ? 'bg-white/80 border-cyan-100/50' : 'bg-black/40 border-cyan-900/20'}`}
    >
      {passwordHash && (
        <div className="space-y-2">
          <label
            className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
          >
            {t.oldPassword}
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            aria-label={t.oldPassword}
            className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-cyan-400' : 'bg-black/80 border-cyan-900/30 focus:border-cyan-500 text-cyan-400'}`}
          />
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-2">
          <label
            className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
          >
            {t.newPassword}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-label={t.newPassword}
            className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-cyan-400' : 'bg-black/80 border-cyan-900/30 focus:border-cyan-500 text-cyan-400'}`}
          />
        </div>
        <div className="space-y-2">
          <label
            className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
          >
            {t.confirmPassword}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-label={t.confirmPassword}
            className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-cyan-400' : 'bg-black/80 border-cyan-900/30 focus:border-cyan-500 text-cyan-400'}`}
          />
        </div>
      </div>
      {securityError && (
        <div
          role="alert"
          className="text-[10px] font-mono text-rose-500 uppercase bg-rose-500/5 p-3 border border-rose-500/20 rounded-lg shadow-[0_0_10px_rgba(244,63,94,0.1)]"
        >
          {securityError}
        </div>
      )}
      {securitySuccess && (
        <div
          role="status"
          className="text-[10px] font-mono text-green-500 uppercase bg-green-500/5 p-3 border border-green-500/20 rounded-lg"
        >
          {securitySuccess}
        </div>
      )}
      <SettingsArgon2idToggle theme={theme} t={t} />
      <div className="pt-4 flex gap-4">
        <button
          onClick={onCancel}
          className={`flex-1 py-4 font-bold text-sm border rounded-xl transition-all ${theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-transparent border-cyan-900/20 text-cyan-800 hover:border-cyan-500/30 hover:text-cyan-600'}`}
        >
          {t.cancel}
        </button>
        <CyberButton
          onClick={onSubmit}
          className="flex-1 py-4 text-sm font-bold shadow-lg shadow-cyan-500/20"
          theme={theme}
        >
          {passwordHash ? t.update : t.save}
        </CyberButton>
      </div>
      <div
        className={`p-4 rounded-xl border text-[10px] leading-relaxed ${theme === 'light' ? 'bg-cyan-50 border-cyan-100 text-cyan-800' : 'bg-cyan-950/20 border-cyan-900/30 text-cyan-600 font-mono'}`}
      >
        {t.passwordRequirement}
      </div>
    </div>
  </div>
);
