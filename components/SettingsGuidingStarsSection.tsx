import React from 'react';
import { Plus, Star, X } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface SettingsGuidingStarsSectionProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  /** Persisted user-selected stars; rendered when not editing. */
  selectedStars: string[];
  /** Whether the inline editor is currently expanded. */
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  /** Working draft of the directory (not yet saved). */
  tempDirectory: string[];
  /** Working draft of the selection (not yet saved). */
  tempSelected: string[];
  /** Custom-name input controlled value. */
  customStarName: string;
  setCustomStarName: (value: string) => void;
  /** Toggle a star in/out of `tempSelected`. */
  onToggleStar: (star: string) => void;
  /** Remove a custom star from both directory and selection. */
  onDeleteCustomStar: (star: string) => void;
  /** Add the current `customStarName` to both directory and selection. */
  onAddCustomStar: () => void;
  /** Persist the working draft. */
  onSave: () => void;
}

/**
 * Settings → Guiding Stars editor card. Pure presentation; the editor
 * state machine lives in `useGuidingStarsEditor`. Pulled out of
 * `SettingsPanel.tsx` as part of Phase 2 §2.j.
 */
export const SettingsGuidingStarsSection: React.FC<SettingsGuidingStarsSectionProps> = ({
  theme,
  language,
  t,
  selectedStars,
  isEditing,
  setIsEditing,
  tempDirectory,
  tempSelected,
  customStarName,
  setCustomStarName,
  onToggleStar,
  onDeleteCustomStar,
  onAddCustomStar,
  onSave,
}) => (
  <div
    className={`rounded-2xl border p-6 space-y-4 transition-all ${theme === 'light' ? 'bg-white/80 border-slate-100 shadow-sm' : 'bg-black/40 border-cyan-900/20'}`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-950/50 text-cyan-400'}`}
        >
          <Star className="w-5 h-5" />
        </span>
        <div className="flex flex-col">
          <h4
            className={`text-sm font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-cyan-200'}`}
          >
            {t.guidingStarsCatalog}
          </h4>
          {isEditing && (
            <span
              className={`text-[10px] font-mono ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
            >
              {t.guidingStarsLimit}
            </span>
          )}
        </div>
      </div>
      {isEditing ? (
        <span
          className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${tempSelected.length === 3 ? (theme === 'light' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-green-500/20 border-green-500 text-green-400') : theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'}`}
        >
          {tempSelected.length} / 3
        </span>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${theme === 'light' ? 'border-cyan-100 text-cyan-600 hover:bg-cyan-50' : 'border-cyan-900/30 text-cyan-400 hover:border-cyan-500/50'}`}
        >
          {t.edit}
        </button>
      )}
    </div>

    {isEditing ? (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex flex-wrap gap-2">
          {tempDirectory.map((star) => (
            <div
              key={star}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${tempSelected.includes(star) ? (theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/20 border-cyan-500 text-cyan-100') : theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-transparent border-cyan-900/30 text-cyan-800'}`}
            >
              <button
                type="button"
                onClick={() => onToggleStar(star)}
                className="cursor-pointer bg-transparent border-0 p-0 text-inherit"
                aria-label={`toggle ${star}`}
              >
                {star}
              </button>
              {star !== 'ALL' && (
                <button
                  onClick={() => onDeleteCustomStar(star)}
                  aria-label={`${t.delete ?? 'delete'} ${star}`}
                  className="opacity-40 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customStarName}
            onChange={(e) => setCustomStarName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddCustomStar()}
            placeholder={t.defineYourself + '...'}
            aria-label={t.defineYourself}
            className={`flex-1 px-4 py-2 rounded-xl text-xs font-mono border outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-cyan-400' : 'bg-black/40 border-cyan-900/30 focus:border-cyan-500 text-cyan-400'}`}
          />
          <CyberButton onClick={onAddCustomStar} theme={theme} className="px-4 text-[10px]">
            <Plus className="w-3 h-3" />
          </CyberButton>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setIsEditing(false)}
            className={`text-xs font-bold ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
          >
            {t.cancel}
          </button>
          <CyberButton onClick={onSave} theme={theme} className="text-[10px] font-bold px-6">
            {t.save}
          </CyberButton>
        </div>
      </div>
    ) : (
      <div
        className={`flex items-center gap-4 p-4 rounded-xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-transparent border-cyan-900/10'}`}
      >
        <div
          className={`p-2 rounded-lg ${theme === 'light' ? 'bg-slate-50 text-slate-400' : 'bg-cyan-950/30 text-cyan-800'}`}
        >
          <Star className="w-5 h-5" />
        </div>
        <div
          className={`flex-1 text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-cyan-100'}`}
        >
          {selectedStars.join('、') || (language === 'zh' ? '暂无活跃锚点' : 'No active stars')}
        </div>
      </div>
    )}
  </div>
);
