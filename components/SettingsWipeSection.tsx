import React from 'react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface SettingsWipeSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Controlled value for the "type DELETE" confirmation input. */
  wipeInput: string;
  setWipeInput: (value: string) => void;
  /** Fires the actual wipe (parent guards against `wipeInput !== 'DELETE'`
   *  too, but we surface the disabled state here so the button's intent
   *  is obvious). */
  onConfirmWipe: () => void;
  /** Cancel button — abandon the wipe flow and close the settings drawer. */
  onCancel: () => void;
}

/**
 * The destructive "wipe everything" panel inside Settings. Pure
 * presentation; the parent decides what `Wipe` actually means.
 *
 * Pulled out of `SettingsPanel.tsx` as part of Phase 2 §2.j.
 */
export const SettingsWipeSection: React.FC<SettingsWipeSectionProps> = ({
  theme,
  t,
  wipeInput,
  setWipeInput,
  onConfirmWipe,
  onCancel,
}) => {
  const armed = wipeInput === 'DELETE';
  return (
    <div
      className={`rounded-2xl border transition-all ${theme === 'light' ? 'bg-rose-50/10 border-rose-100/50 shadow-sm' : 'bg-rose-950/5 border-rose-950/20'}`}
    >
      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left space-y-1">
          <h4
            className={`text-lg font-black tracking-[0.2em] uppercase ${theme === 'light' ? 'text-rose-700' : 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'}`}
          >
            {t.wipeData}
          </h4>
          <div
            className={`text-[11px] font-medium tracking-wide leading-relaxed flex flex-col gap-0.5 ${theme === 'light' ? 'text-slate-500' : 'text-rose-900/60'}`}
          >
            <p>{t.wipeDataDesc}</p>
            <p>{t.wipePoetic1}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-[150px]">
            <input
              type="text"
              value={wipeInput}
              onChange={(e) => setWipeInput(e.target.value)}
              placeholder={t.wipeDataConfirm}
              aria-label={t.wipeDataConfirm}
              className={`w-full bg-transparent border-b py-2 text-center font-mono text-sm tracking-[0.3em] transition-all outline-none ${theme === 'light' ? 'border-rose-100 focus:border-rose-600 text-rose-900 placeholder:text-rose-200' : 'border-rose-900/40 focus:border-rose-500 text-rose-100 placeholder:text-rose-900/20'}`}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={!armed}
              onClick={onConfirmWipe}
              className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${armed ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:scale-105 active:scale-95' : 'opacity-20 cursor-not-allowed bg-slate-400'}`}
            >
              {t.confirmWipe}
            </button>
            <button
              onClick={onCancel}
              className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-all ${theme === 'light' ? 'border-slate-200 text-slate-400 hover:bg-slate-50' : 'border-cyan-900/30 text-cyan-800 hover:bg-cyan-950/10'}`}
            >
              {t.btnCancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
