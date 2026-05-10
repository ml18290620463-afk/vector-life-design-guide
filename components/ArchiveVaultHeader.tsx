import React from 'react';
import { ArrowLeft, Database } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

export type ArchiveVaultView = 'vault' | 'principles';

interface ArchiveVaultHeaderProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Whether the FilterHub drawer is currently open. Toggling the
   *  Database button is the primary way to open it. */
  showFilterHub: boolean;
  onToggleFilterHub: () => void;
  view: ArchiveVaultView;
  onSetView: (view: ArchiveVaultView) => void;
  onBack: () => void;
}

/**
 * The ArchiveVault top header: filter-hub toggle, title block, the
 * Vault / Principles segmented switch, and the back-to-console button.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchiveVaultHeader: React.FC<ArchiveVaultHeaderProps> = ({
  theme,
  t,
  showFilterHub,
  onToggleFilterHub,
  view,
  onSetView,
  onBack,
}) => (
  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 gap-6">
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onToggleFilterHub}
        aria-label={t.filter ?? 'Filter'}
        aria-pressed={showFilterHub}
        className={`p-3 border rounded-full transition-all duration-500 cursor-pointer relative z-50 ${
          showFilterHub
            ? theme === 'light'
              ? 'bg-vector-cyan-brand border-vector-cyan-brand text-white shadow-lg rotate-90 scale-110'
              : 'bg-cyan-500 border-cyan-400 text-black shadow-glow-cyan-500-bright rotate-90 scale-110'
            : theme === 'light'
              ? 'bg-white border-vector-cyan-brand/10 text-vector-cyan-brand hover:border-vector-cyan-brand shadow-sm'
              : 'bg-white/5 border-white/10 text-slate-400 hover:border-cyan-500/50 hover:bg-white/10'
        }`}
      >
        <Database className="w-8 h-8" />
      </button>
      <div>
        <h1
          className={`text-3xl font-bold tracking-[0.2em] uppercase ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
        >
          {t.appTitle}
        </h1>
        <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
          {t.archiveStatus}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div
        role="tablist"
        aria-label={t.appTitle}
        className={`border p-1 rounded-sm ${theme === 'light' ? 'bg-white border-vector-cyan-brand/10 shadow-sm' : 'bg-green-950/30 border-green-900/50'}`}
      >
        <button
          role="tab"
          aria-selected={view === 'vault'}
          onClick={() => onSetView('vault')}
          className={`px-4 py-1 text-[10px] font-bold tracking-widest transition-all ${view === 'vault' ? (theme === 'light' ? 'bg-vector-cyan-brand text-white shadow-md' : 'bg-green-500 text-black') : theme === 'light' ? 'text-vector-slate-soft hover:text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'text-green-700 hover:text-green-400'}`}
        >
          {t.bioVault}
        </button>
        <button
          role="tab"
          aria-selected={view === 'principles'}
          onClick={() => onSetView('principles')}
          className={`px-4 py-1 text-[10px] font-bold tracking-widest transition-all ${view === 'principles' ? (theme === 'light' ? 'bg-vector-cyan-brand text-white shadow-md' : 'bg-green-500 text-black') : theme === 'light' ? 'text-vector-slate-soft hover:text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'text-green-700 hover:text-green-400'}`}
        >
          {t.principles}
        </button>
      </div>

      <CyberButton
        variant="ghost"
        onClick={onBack}
        theme={theme}
        className={
          theme === 'light'
            ? 'text-slate-500 hover:text-cyan-600'
            : 'text-green-500 hover:text-green-300 hover:border-green-500'
        }
      >
        <ArrowLeft className="w-4 h-4" />{' '}
        <span className="hidden xs:inline">{t.backToConsole}</span>
      </CyberButton>
    </div>
  </header>
);
