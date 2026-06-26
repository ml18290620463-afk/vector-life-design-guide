import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useNowTick } from '../hooks/useNowTick';
import { useArchiveGrouping } from '../hooks/useArchiveGrouping';
import { Container, DiaryEntry, Language, Principle, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { FilterHub } from './FilterHub';
import { ArchiveVaultBackground } from './ArchiveVaultBackground';
import { ArchiveVaultHeader } from './ArchiveVaultHeader';
import { ArchiveVaultEntries } from './ArchiveVaultEntries';

interface ArchiveVaultProps {
  language: Language;
  theme?: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  onAddPrinciple: (text: string, year: number, showOnHome: boolean) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  onBack: () => void;
  /** Currently unused at this surface — kept on the API for consumers
   *  that wire the geometric-boat affordance into ArchiveVault. */
  onGoHome?: () => void;
  onRecordMoment?: () => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  containers: Container[];
  onAddContainer: (name: string) => void;
  onDeleteContainer: (id: string) => void;
}

/**
 * The "Memory Boat" archive screen. Phase 2 §2.k broke the original
 * 805-LOC monolith into:
 *
 *   - `useArchiveGrouping` — memory-boat filter + tag/category/search
 *     filters + year/month/day grouping.
 *   - `useNowTick` — opportunistic 1 Hz tick (only ticks when at least
 *     one archived entry is still time-locked).
 *   - `ArchiveVaultBackground` — bio-vault decoration.
 *   - `ArchiveVaultHeader` — title, view toggle, back button.
 *   - `ArchiveVaultEntries` — vault tab body + empty state.
 *   - `ArchiveEntryCard` — single entry, list-view + grid-view.
 *   - `ArchivePrinciplesView` — principles tab body + add form.
 *
 * This file now only owns the page frame, the FilterHub composition
 * and the view-tab routing.
 */
export const ArchiveVault: React.FC<ArchiveVaultProps> = ({
  language,
  theme = 'dark',
  entries,
  onBack,
  onRecordMoment,
  onSelectEntry,
  containers,
  onAddContainer,
  onDeleteContainer,
}) => {
  const t = TRANSLATIONS[language];

  const hasPendingTimeLock = useMemo(
    () =>
      entries.some((entry) => typeof entry.unlockAt === 'number' && entry.unlockAt > Date.now()),
    [entries],
  );
  const now = useNowTick(hasPendingTimeLock);

  const grouping = useArchiveGrouping({ entries });

  const [showFilterHub, setShowFilterHub] = useState(false);

  return (
    <div
      className={`archive-past-screen min-h-screen font-mono relative overflow-hidden transition-colors duration-1000 ${theme === 'light' ? 'bg-vector-fog-light text-vector-ink-strong' : 'bg-vector-night-deep text-cyan-500'}`}
    >
      <ArchiveVaultBackground theme={theme} />

      <div className="archive-past-frame container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <ArchiveVaultHeader
          theme={theme}
          language={language}
          t={t}
          onBack={onBack}
        />

        <section className="archive-past-controls" aria-label={language === 'zh' ? '过去搜索与排序' : 'Past search and sort'}>
          <div className="archive-past-search-row">
            <label className="archive-past-search">
              <Search className="h-5 w-5" />
              <input
                value={grouping.searchQuery}
                onChange={(event) => grouping.setSearchQuery(event.target.value)}
                placeholder={language === 'zh' ? '标签 / 关键词 / 日期' : 'Tags / keywords / date'}
                aria-label={language === 'zh' ? '搜索标签关键词日期' : 'Search tags keywords date'}
              />
            </label>
            <button
              type="button"
              className={`archive-past-filter ${showFilterHub ? 'archive-past-filter--active' : ''}`}
              aria-label={t.filter ?? 'Filter'}
              aria-pressed={showFilterHub}
              onClick={() => setShowFilterHub((prev) => !prev)}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          <div className="archive-past-segments" role="tablist" aria-label={language === 'zh' ? '按时间归档' : 'Archive by time'}>
            {(
              [
                { id: 'year', label: t.year },
                { id: 'month', label: t.month },
                { id: 'day', label: t.day },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={grouping.groupingMode === mode.id}
                className={grouping.groupingMode === mode.id ? 'archive-past-segment--active' : ''}
                onClick={() => grouping.setGroupingMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </section>

        <AnimatePresence>
          {showFilterHub && (
            <div className="archive-past-filter-panel">
              <FilterHub
                entries={grouping.archivedEntriesBase}
                language={language}
                theme={theme}
                searchQuery={grouping.searchQuery}
                onSearchChange={grouping.setSearchQuery}
                selectedTag={grouping.selectedTag}
                onSelectTag={grouping.setSelectedTag}
                selectedCategory={grouping.selectedCategory}
                onSelectCategory={grouping.setSelectedCategory}
                containers={containers}
                onAddContainer={onAddContainer}
                onDeleteContainer={onDeleteContainer}
                onClose={() => setShowFilterHub(false)}
                accentColor="green"
                groupingMode={grouping.groupingMode}
                onGroupingModeChange={(mode) =>
                  grouping.setGroupingMode(mode === 'none' ? 'year' : mode)
                }
              />
            </div>
          )}
        </AnimatePresence>

        <ArchiveVaultEntries
          theme={theme}
          t={t}
          groupingMode={grouping.groupingMode}
          groupKeys={grouping.groupKeys}
          groupedEntries={grouping.groupedEntries}
          now={now}
          onSelectEntry={onSelectEntry}
        />

        {onRecordMoment && (
          <button type="button" className="archive-past-record" onClick={onRecordMoment}>
            <Plus className="h-5 w-5" />
            {language === 'zh' ? '记录此刻' : 'Record now'}
          </button>
        )}
      </div>
    </div>
  );
};
