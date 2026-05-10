import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useNowTick } from '../hooks/useNowTick';
import { useArchiveGrouping } from '../hooks/useArchiveGrouping';
import { Container, DiaryEntry, Language, Principle, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { FilterHub } from './FilterHub';
import { ArchiveVaultBackground } from './ArchiveVaultBackground';
import { ArchiveVaultHeader, type ArchiveVaultView } from './ArchiveVaultHeader';
import { ArchiveVaultEntries } from './ArchiveVaultEntries';
import { ArchivePrinciplesView } from './ArchivePrinciplesView';

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
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  onBack,
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

  const [view, setView] = useState<ArchiveVaultView>('vault');
  const [showFilterHub, setShowFilterHub] = useState(false);

  return (
    <div
      className={`min-h-screen font-mono relative overflow-hidden transition-colors duration-1000 ${theme === 'light' ? 'bg-vector-fog-light text-vector-ink-strong' : 'bg-vector-night-deep text-cyan-500'}`}
    >
      <ArchiveVaultBackground theme={theme} />

      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <ArchiveVaultHeader
          theme={theme}
          t={t}
          showFilterHub={showFilterHub}
          onToggleFilterHub={() => setShowFilterHub((prev) => !prev)}
          view={view}
          onSetView={setView}
          onBack={onBack}
        />

        <AnimatePresence>
          {showFilterHub && (
            <div className="mb-12">
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

        {view === 'vault' ? (
          <ArchiveVaultEntries
            theme={theme}
            t={t}
            groupingMode={grouping.groupingMode}
            groupKeys={grouping.groupKeys}
            groupedEntries={grouping.groupedEntries}
            now={now}
            onSelectEntry={onSelectEntry}
          />
        ) : (
          <ArchivePrinciplesView
            theme={theme}
            t={t}
            principles={principles}
            onAddPrinciple={onAddPrinciple}
            onDeletePrinciple={onDeletePrinciple}
            onUpdatePrinciple={onUpdatePrinciple}
          />
        )}
      </div>
    </div>
  );
};
