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
  const inputShellClass =
    'relative group overflow-hidden border backdrop-blur-md [border-radius:1.35rem_2.1rem_1.55rem_2.25rem/1.05rem_1.55rem_1.7rem_1.25rem]';
  const inputTone =
    theme === 'light'
      ? 'border-cyan-500/18 bg-white/42 shadow-[inset_0_0_22px_rgba(6,182,212,0.045),0_0_18px_rgba(6,182,212,0.045)]'
      : 'border-cyan-200/16 bg-black/18 shadow-[inset_0_0_24px_rgba(34,211,238,0.045),0_0_20px_rgba(34,211,238,0.05)]';
  const inputClass = `relative z-10 w-full border-0 bg-transparent py-4 pl-5 pr-14 font-mono text-sm tracking-[0.16em] outline-none transition-all focus:outline-none focus:ring-0 focus-visible:outline-none ${theme === 'light' ? 'text-slate-900 placeholder:text-slate-400/60' : 'text-cyan-100 placeholder:text-cyan-200/42'}`;
  const iconButtonClass =
    'absolute right-4 top-1/2 z-20 -translate-y-1/2 text-cyan-700 transition-colors hover:text-cyan-300';

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
          <div className={`${inputShellClass} ${inputTone}`}>
            <div className="pointer-events-none absolute -inset-x-5 -inset-y-3 bg-[radial-gradient(circle_at_18%_36%,rgba(125,249,255,0.1),transparent_34%),linear-gradient(100deg,transparent,rgba(34,211,238,0.055),transparent)] blur-md" />
            <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-cyan-100/18 to-transparent" />
            <input
              id="recovery-key-input"
              type={recovery.showKey ? 'text' : 'password'}
              value={recovery.recoveryInput}
              onChange={(e) => recovery.setRecoveryInput(e.target.value)}
              aria-label={t.recoveryKeyTitle}
              data-suppress-focus-ring="true"
              className={inputClass}
              placeholder="XXXX-XXXX-XXXX-XXXX..."
            />
            <button
              type="button"
              onClick={recovery.toggleShowKey}
              aria-label={showHideLabel(recovery.showKey, 'key')}
              aria-pressed={recovery.showKey}
              className={iconButtonClass}
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
          <div className={`${inputShellClass} ${inputTone}`}>
            <div className="pointer-events-none absolute -inset-x-5 -inset-y-3 bg-[radial-gradient(circle_at_18%_36%,rgba(125,249,255,0.1),transparent_34%),linear-gradient(100deg,transparent,rgba(34,211,238,0.055),transparent)] blur-md" />
            <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-cyan-100/18 to-transparent" />
            <input
              id="recovery-new-input"
              type={recovery.showNewPassword ? 'text' : 'password'}
              value={recovery.newPassword}
              onChange={(e) => recovery.setNewPassword(e.target.value)}
              aria-label={t.newPassword}
              data-suppress-focus-ring="true"
              className={inputClass}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={recovery.toggleShowNewPassword}
              aria-label={showHideLabel(recovery.showNewPassword, 'password')}
              aria-pressed={recovery.showNewPassword}
              className={iconButtonClass}
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
          <div className={`${inputShellClass} ${inputTone}`}>
            <div className="pointer-events-none absolute -inset-x-5 -inset-y-3 bg-[radial-gradient(circle_at_18%_36%,rgba(125,249,255,0.1),transparent_34%),linear-gradient(100deg,transparent,rgba(34,211,238,0.055),transparent)] blur-md" />
            <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-cyan-100/18 to-transparent" />
            <input
              id="recovery-confirm-input"
              type={recovery.showNewPassword ? 'text' : 'password'}
              value={recovery.confirmNewPassword}
              onChange={(e) => recovery.setConfirmNewPassword(e.target.value)}
              aria-label={t.confirmPassword}
              data-suppress-focus-ring="true"
              className={inputClass}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={recovery.toggleShowNewPassword}
              aria-label={showHideLabel(recovery.showNewPassword, 'password')}
              aria-pressed={recovery.showNewPassword}
              className={iconButtonClass}
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
        className={`relative w-full overflow-hidden py-4 font-mono text-xs font-bold tracking-widest transition-all [border-radius:1.5rem_2.4rem_1.8rem_2.6rem/1.1rem_1.7rem_1.9rem_1.35rem] ${
          theme === 'light'
            ? 'border border-cyan-500/24 bg-cyan-50/70 text-cyan-900 shadow-[0_0_24px_rgba(6,182,212,0.08)] hover:bg-cyan-100/80'
            : 'border border-cyan-200/22 bg-[linear-gradient(100deg,rgba(0,200,232,0.18),rgba(0,0,0,0.18),rgba(34,211,238,0.12))] text-cyan-50 shadow-[0_0_28px_rgba(0,220,255,0.12),inset_0_0_22px_rgba(34,211,238,0.06)] hover:border-cyan-100/36 hover:text-white'
        }`}
      >
        <span className="pointer-events-none absolute inset-x-10 top-1 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />
        {t.confirmAction}
      </button>
    </motion.div>
  );
};
