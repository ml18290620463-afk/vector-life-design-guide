import React from 'react';
import { motion } from 'motion/react';
import { Mail } from 'lucide-react';
import { GroupingMode, Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';

interface FilterBarProps {
  theme: Theme;
  language: Language;
  showFilterHub: boolean;
  isVaultOpen: boolean;
  onToggleVault: () => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  groupingMode: GroupingMode;
  setGroupingMode: (mode: GroupingMode) => void;
  isEditingStars: boolean;
  entriesCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  theme,
  language,
  showFilterHub,
  isVaultOpen,
  onToggleVault,
  selectedTag,
  setSelectedTag,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  groupingMode,
  setGroupingMode,
  isEditingStars,
  entriesCount,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div
      className={`mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 ${!isEditingStars ? 'border-b' : ''} ${theme === 'light' ? 'border-slate-100' : 'border-vector-navy-deep/20'}`}
    >
      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-6">
        <button
          onClick={onToggleVault}
          className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 ${isVaultOpen ? (theme === 'light' ? 'text-cyan-600' : 'text-vector-cyan-neon') : theme === 'light' ? 'text-slate-400' : 'text-vector-slate-chrome/60'}`}
        >
          <Mail className={`w-4 h-4 ${isVaultOpen ? 'animate-pulse' : ''}`} /> {t.encryptedLog}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full border ${isVaultOpen ? (theme === 'light' ? 'border-cyan-200 bg-cyan-50' : 'border-vector-cyan-neon/50 bg-vector-cyan-neon/10') : 'border-slate-200 opacity-40'}`}
          >
            {entriesCount}
          </span>
          <span
            className={`text-[9px] px-1 border ${isVaultOpen ? (theme === 'light' ? 'border-cyan-200 bg-cyan-50' : 'border-vector-cyan-neon/60 bg-vector-cyan-neon/5 text-vector-cyan-neon/80') : 'border-transparent opacity-40'}`}
          >
            {isVaultOpen ? 'OPEN' : 'LOCKED'}
          </span>
        </button>

        {!showFilterHub && (selectedTag || selectedCategory !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div
              className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'}`}
            >
              {t.snapshotDesc.includes('Snapshot') ? 'FILTERED' : '筛选中'}
            </div>
            <button
              onClick={() => {
                setSelectedTag(null);
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-[9px] font-mono text-rose-500 hover:underline"
            >
              [ RESET ]
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span
          className={`text-[11px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-vector-slate-chrome/60'}`}
        >
          {t.groupBy} :
        </span>
        <div className="flex gap-2">
          {(
            [
              { id: 'none', label: t.none },
              { id: 'year', label: t.year },
              { id: 'month', label: t.month },
              { id: 'day', label: t.day },
            ] satisfies { id: GroupingMode; label: string }[]
          ).map((mode) => {
            const isActive = groupingMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setGroupingMode(mode.id)}
                className={`
                          px-6 py-2.5 text-xs font-mono border transition-all duration-500 relative overflow-hidden flex items-center justify-center group
                          ${
                            isActive
                              ? theme === 'light'
                                ? 'bg-cyan-500 border-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-glow-cyan-400-strong ring-1 ring-cyan-400/50'
                              : theme === 'light'
                                ? 'bg-white/50 border-slate-200 text-slate-400 hover:border-cyan-300 hover:text-cyan-600'
                                : 'bg-white/[0.02] border-white/5 text-white/30 hover:border-cyan-500/40 hover:text-cyan-400'
                          }
                      `}
              >
                {/* Active Indicator Line */}
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400"
                  />
                )}

                {/* Hover Scanner Beam */}
                {!isActive && (
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent pointer-events-none" />
                )}

                <span className="relative z-10 tracking-[0.2em]">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
