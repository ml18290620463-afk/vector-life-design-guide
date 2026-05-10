import React from 'react';
import { ArrowLeft, Anchor, AlertCircle } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { hasStoredValue } from '../services/browserStorage';
import { AppStorageKeys } from '../services/appSettings';

interface SettingsRecoveryViewProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  onBack: () => void;
}

/**
 * "Emergency Anchor" recovery-key surface inside the Settings drawer.
 * Pure presentation; reads `AppStorageKeys.recoveryVerifier` once to
 * decide whether to surface "stored" or "not generated".
 *
 * Pulled out of `SettingsPanel.tsx` as part of Phase 2 §2.j so the
 * settings panel composes rather than inlines yet another long
 * branch.
 */
export const SettingsRecoveryView: React.FC<SettingsRecoveryViewProps> = ({
  theme,
  language,
  t,
  onBack,
}) => (
  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
    <div className="flex items-center gap-4 mb-2">
      <button
        onClick={onBack}
        aria-label={t.backToConsole}
        className={`p-2 rounded-full ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-cyan-950/30 text-cyan-800'}`}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h4 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}>
        {t.emergencyAnchor}
      </h4>
    </div>
    <div
      className={`p-6 rounded-2xl border space-y-6 ${theme === 'light' ? 'bg-white/80 border-cyan-100/50' : 'bg-black/40 border-cyan-900/20'}`}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-950/30 text-cyan-400'}`}
        >
          <Anchor className="w-8 h-8" />
        </div>
        <div>
          <h5
            className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
          >
            {t.recoveryKeyTitle}
          </h5>
          <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}>
            {t.recoveryKeyDesc}
          </p>
        </div>
      </div>

      <div
        className={`p-6 border-2 border-dashed font-mono text-center rounded-xl relative ${theme === 'light' ? 'bg-slate-50 border-cyan-200 text-cyan-900' : 'bg-cyan-950/20 border-cyan-900 text-cyan-400'}`}
      >
        <div className="text-sm md:text-base tracking-[0.2em] font-bold break-all select-all py-2">
          {hasStoredValue(AppStorageKeys.recoveryVerifier)
            ? language === 'zh'
              ? '已安全保存校验指纹'
              : 'RECOVERY VERIFIER STORED'
            : language === 'zh'
              ? '尚未生成凭证'
              : 'NOT_GENERATED'}
        </div>
      </div>

      <div
        role="alert"
        className={`p-4 text-[10px] font-mono leading-relaxed flex gap-2 rounded-xl ${theme === 'light' ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-rose-950/20 text-rose-500/80 border border-rose-900/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'}`}
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        {t.recoveryKeyWarning}
      </div>

      <CyberButton onClick={onBack} className="w-full py-4 text-sm font-bold" theme={theme}>
        {t.backToConsole}
      </CyberButton>
    </div>
  </div>
);
