import React from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Maximize, Minimize } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import type { RecoveryFlowState } from '../hooks/useRecoveryFlow';

interface MasterLockRecoveryFormProps {
  theme: Theme;
  t: TranslationDictionary;
  /** All recovery state + setters bundled — comes straight from
   *  `useRecoveryFlow` so the dashboard / lock screen don't have to
   *  re-thread eight individual props. */
  recovery: RecoveryFlowState;
}

/**
 * MasterLock's recovery branch: recovery key + new + confirm fields,
 * with show/hide toggles and an inline error banner. Pure presentation;
 * the workflow logic lives in `useRecoveryFlow`.
 *
 * Rebuilt as part of Phase 2 §2.i — see `MasterLockUnlockForm.tsx` for
 * the sibling component.
 */
export const MasterLockRecoveryForm: React.FC<MasterLockRecoveryFormProps> = ({
  theme,
  t,
  recovery,
}) => {
  const showHideLabel = (showing: boolean, kind: 'key' | 'password') => {
    if (kind === 'key') return showing ? 'Hide recovery key' : 'Show recovery key';
    return showing ? (t.hidePassword ?? 'Hide password') : (t.showPassword ?? 'Show password');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full space-y-4"
    >
      <div className="space-y-2">
        <h2
          className={`text-xl font-mono font-bold tracking-widest uppercase ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
        >
          {t.resetPassword}
        </h2>
        <p
          className={`text-[10px] font-mono tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-cyan-600'}`}
        >
          {t.inputRecoveryKey}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 text-left">
          <label
            htmlFor="recovery-key-input"
            className="text-[10px] font-mono text-cyan-500 font-bold uppercase tracking-wider"
          >
            {t.recoveryKeyTitle}
          </label>
          <div className="relative group">
            <input
              id="recovery-key-input"
              type={recovery.showKey ? 'text' : 'password'}
              value={recovery.recoveryInput}
              onChange={(e) => recovery.setRecoveryInput(e.target.value)}
              aria-label={t.recoveryKeyTitle}
              className={`w-full border p-3 font-mono text-sm focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-400' : 'bg-cyan-950/20 border-cyan-900/40 text-cyan-100 focus:border-cyan-500/50'}`}
              placeholder="XXXX-XXXX-XXXX-XXXX..."
            />
            <button
              type="button"
              onClick={recovery.toggleShowKey}
              aria-label={showHideLabel(recovery.showKey, 'key')}
              aria-pressed={recovery.showKey}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-700 hover:text-cyan-400"
            >
              {recovery.showKey ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-left">
          <label
            htmlFor="recovery-new-input"
            className="text-[10px] font-mono text-cyan-500 font-bold uppercase tracking-wider"
          >
            {t.newPassword}
          </label>
          <div className="relative group">
            <input
              id="recovery-new-input"
              type={recovery.showNewPassword ? 'text' : 'password'}
              value={recovery.newPassword}
              onChange={(e) => recovery.setNewPassword(e.target.value)}
              aria-label={t.newPassword}
              className={`w-full border p-3 font-mono text-sm focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-400' : 'bg-cyan-950/20 border-cyan-900/40 text-cyan-100 focus:border-cyan-500/50'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={recovery.toggleShowNewPassword}
              aria-label={showHideLabel(recovery.showNewPassword, 'password')}
              aria-pressed={recovery.showNewPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-700 hover:text-cyan-400"
            >
              {recovery.showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-left">
          <label
            htmlFor="recovery-confirm-input"
            className="text-[10px] font-mono text-cyan-500 font-bold uppercase tracking-wider"
          >
            {t.confirmPassword}
          </label>
          <div className="relative group">
            <input
              id="recovery-confirm-input"
              type={recovery.showNewPassword ? 'text' : 'password'}
              value={recovery.confirmNewPassword}
              onChange={(e) => recovery.setConfirmNewPassword(e.target.value)}
              aria-label={t.confirmPassword}
              className={`w-full border p-3 font-mono text-sm focus:outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-400' : 'bg-cyan-950/20 border-cyan-900/40 text-cyan-100 focus:border-cyan-500/50'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={recovery.toggleShowNewPassword}
              aria-label={showHideLabel(recovery.showNewPassword, 'password')}
              aria-pressed={recovery.showNewPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-700 hover:text-cyan-400"
            >
              {recovery.showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {recovery.resetError && (
        <div
          role="alert"
          className="p-3 bg-vector-magenta/5 border border-vector-magenta/20 rounded"
        >
          <p className="text-[10px] font-mono text-vector-magenta uppercase tracking-tight neon-glow-alert">
            {recovery.resetError}
          </p>
        </div>
      )}

      <button
        onClick={recovery.submitRecovery}
        className={`w-full py-4 font-mono text-xs tracking-widest transition-all ${theme === 'light' ? 'bg-slate-900 text-white hover:bg-cyan-600' : 'bg-cyan-500 text-black hover:bg-cyan-400 font-bold'}`}
      >
        {t.confirmAction}
      </button>
    </motion.div>
  );
};
