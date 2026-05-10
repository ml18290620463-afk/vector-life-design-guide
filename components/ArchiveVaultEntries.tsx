import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Binary, ChevronDown, ChevronRight } from 'lucide-react';
import type { DiaryEntry, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { ArchiveEntryCard } from './ArchiveEntryCard';
import type { ArchiveGroupingMode } from '../hooks/useArchiveGrouping';

interface ArchiveVaultEntriesProps {
  theme: Theme;
  t: TranslationDictionary;
  groupingMode: ArchiveGroupingMode;
  groupKeys: string[];
  groupedEntries: Record<string, DiaryEntry[]>;
  /** Snapshot of the live "now" tick used by the cards' time-lock logic. */
  now: number;
  onSelectEntry: (entry: DiaryEntry) => void;
}

const LIST_VIEW_THRESHOLD = 10;

/**
 * The vault tab of ArchiveVault: empty state when there's nothing to
 * show, otherwise a list of expandable group panels (year/month/day)
 * each containing either a list-view or grid-view rendering of the
 * `ArchiveEntryCard` children.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchiveVaultEntries: React.FC<ArchiveVaultEntriesProps> = ({
  theme,
  t,
  groupingMode,
  groupKeys,
  groupedEntries,
  now,
  onSelectEntry,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (groupKeys.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-20 border border-dashed rounded-lg ${theme === 'light' ? 'bg-white/40 border-vector-cyan-brand/10 shadow-inner' : 'bg-green-950/5 border-green-900/30'}`}
      >
        <Binary
          className={`w-16 h-16 mb-4 ${theme === 'light' ? 'text-vector-slate-soft/20' : 'text-green-900'}`}
        />
        <p className={`text-lg ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-700'}`}>
          {t.archiveEmpty}
        </p>
        <p
          className={`text-sm ${theme === 'light' ? 'text-vector-slate-soft/60' : 'text-green-800/60'}`}
        >
          {t.waitingForData}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupKeys.map((key, keyIndex) => {
        const bucket = groupedEntries[key];
        const isExpanded = !!expandedGroups[key];
        const isListView = bucket.length > LIST_VIEW_THRESHOLD;

        return (
          <div
            key={key}
            className="relative animate-in slide-in-from-bottom-4 fade-in duration-700"
            style={{ animationDelay: `${keyIndex * 150}ms` }}
          >
            {/* Header Line */}
            <div
              className={`absolute left-[19px] top-10 bottom-0 w-[2px] z-0 ${theme === 'light' ? 'bg-slate-100' : 'bg-green-900/30'}`}
            />

            <button
              type="button"
              onClick={() => toggleGroup(key)}
              aria-expanded={isExpanded}
              className="relative z-10 flex items-center gap-4 w-full text-left group mb-4"
            >
              <div
                className={`w-10 h-10 flex items-center justify-center border transition-all duration-300 ${isExpanded ? (theme === 'light' ? 'bg-vector-cyan-brand/5 border-vector-cyan-brand text-vector-cyan-brand' : 'bg-green-900/30 border-green-400 text-green-400') : theme === 'light' ? 'bg-white border-vector-cyan-brand/10 text-vector-slate-soft/40 group-hover:border-vector-cyan-brand' : 'bg-black border-green-800 text-green-700 group-hover:border-green-600'}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 pb-2 transition-colors flex items-end justify-between">
                <div className="flex flex-col">
                  <span
                    className={`text-[10px] font-mono opacity-40 uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-green-500'}`}
                  >
                    {groupingMode === 'year' ? t.year : groupingMode === 'month' ? t.month : t.day}
                  </span>
                  <span
                    className={`text-4xl font-bold transition-colors ${theme === 'light' ? 'text-vector-ink-strong/80 group-hover:text-vector-cyan-brand' : 'text-green-500/80 group-hover:text-green-400'}`}
                  >
                    {key}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono mb-1 ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}`}
                >
                  {bucket.length} {t.dataSamples}
                </span>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  className="overflow-hidden pl-14"
                >
                  <div
                    className={
                      isListView
                        ? 'space-y-4 pb-4'
                        : 'min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 pb-4'
                    }
                  >
                    {bucket.map((entry, idx) => (
                      <ArchiveEntryCard
                        key={entry.id}
                        theme={theme}
                        t={t}
                        entry={entry}
                        index={idx + 1}
                        isListView={isListView}
                        delayIndex={idx}
                        now={now}
                        onSelect={onSelectEntry}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
