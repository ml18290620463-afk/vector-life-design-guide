import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';
import type { DiaryEntry, GroupingMode, Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { EntryGrid } from './EntryGrid';
import { VaultListView } from './VaultListView';

interface VaultContentProps {
  /** Whether the vault is currently revealed; toggles styling + content. */
  isVaultOpen: boolean;
  /** Click target on the sealed (collapsed) vault — the parent decides
   *  whether that pops the verification overlay or just opens. */
  onUnsealRequest: () => void;
  /** Whether the parent's data loader is still resolving. */
  loading: boolean;
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  searchQuery: string;
  /** Page slice currently visible (for `groupingMode === 'none'`). */
  paginatedEntries: DiaryEntry[];
  /** Full filtered list (used when grouping is on, since groups need
   *  the unpaginated set to compute counts). */
  filteredEntries: DiaryEntry[];
  /** Whether more pages of `paginatedEntries` are available. */
  hasMore: boolean;
  /** Advance the pagination cursor by one. */
  onLoadMore: () => void;
  groupingMode: GroupingMode;
  groupedEntries: Record<string, DiaryEntry[]>;
  groupKeys: string[];
  isListView: boolean;
  onSelectEntry: (entry: DiaryEntry) => void;
  showFilterHub: boolean;
  setShowFilterHub: (open: boolean) => void;
  customIdentity: string;
  currentUser: string | null;
}

const LoadMoreButton: React.FC<{
  theme: Theme;
  language: Language;
  onClick: () => void;
}> = ({ theme, language, onClick }) => (
  <div className="flex justify-center py-8">
    <button
      onClick={onClick}
      className={`px-8 py-3 rounded-full border font-mono text-[10px] uppercase tracking-[0.4em] transition-all duration-500 hover:scale-105 active:scale-95 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-cyan-500 hover:text-cyan-600' : 'bg-black border-cyan-900/40 text-cyan-800 hover:border-cyan-500 hover:text-cyan-400 shadow-[0_0_20px_color-mix(in_srgb,_var(--color-cyan-500)_5%,_transparent)] hover:shadow-[0_0_30px_color-mix(in_srgb,_var(--color-cyan-500)_15%,_transparent)]'}`}
    >
      {language === 'zh' ? '加载更多记录' : 'LOAD MORE RECORDS'}
    </button>
  </div>
);

/**
 * The Dashboard's main content area: the sealed/unsealed vault wrapper,
 * the loading spinner, and the EntryGrid / VaultListView selection plus
 * the "load more records" pagination button. Pulled out of
 * `Dashboard.tsx` as part of Phase 2 §2.h.
 *
 * Pure presentation; the parent owns vault-open state and pagination
 * state.
 */
export const VaultContent: React.FC<VaultContentProps> = ({
  isVaultOpen,
  onUnsealRequest,
  loading,
  theme,
  language,
  t,
  searchQuery,
  paginatedEntries,
  filteredEntries,
  hasMore,
  onLoadMore,
  groupingMode,
  groupedEntries,
  groupKeys,
  isListView,
  onSelectEntry,
  showFilterHub,
  setShowFilterHub,
  customIdentity,
  currentUser,
}) => {
  const visible = groupingMode === 'none' ? paginatedEntries : filteredEntries;
  // The wrapper acts as a giant "tap to unlock" button when the vault is
  // sealed, but is just a passive container when it's open. We expose
  // role/tabindex/keyboard activation only in the sealed state so the
  // open vault doesn't show up as an interactive surface to assistive
  // tech (otherwise screen-reader users would be told "button" while the
  // user is just trying to read entries).
  const sealedInteractiveProps = !isVaultOpen
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => onUnsealRequest(),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUnsealRequest();
          }
        },
        'aria-label': t.clickToUnlock || '点击解锁',
      }
    : {};
  return (
    <div
      {...sealedInteractiveProps}
      className={`transition-all duration-700 relative overflow-hidden rounded-2xl border ${
        theme === 'light'
          ? 'bg-white/40 border-slate-200/40 shadow-sm'
          : 'bg-vector-night-slate/60 border-vector-navy-deep/20 backdrop-blur-md'
      } ${isVaultOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-40 lg:opacity-50 grayscale blur-xl translate-y-4 cursor-pointer hover:opacity-70'}`}
    >
      <AnimatePresence>
        {!isVaultOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/10 backdrop-blur-sm group"
          >
            <div className="p-6 rounded-full border border-cyan-500/20 bg-black/60 shadow-[0_0_30px_color-mix(in_srgb,_var(--color-cyan-500)_10%,_transparent)] group-hover:scale-110 group-hover:border-cyan-500/50 transition-all duration-500">
              <Lock className="w-10 h-10 text-cyan-500/60 group-hover:text-cyan-400 group-hover:animate-pulse" />
            </div>
            <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-500/60 font-bold group-hover:text-cyan-400">
              {t.encryptedLog} ● {t.clickToUnlock || '点击解锁'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-700">
            加载时空记录...
          </p>
        </div>
      ) : isVaultOpen ? (
        <div>
          <VaultListView
            entries={visible}
            language={language}
            theme={theme}
            onSelectEntry={onSelectEntry}
            groupingMode={groupingMode}
            groupedEntries={groupedEntries}
            groupKeys={groupKeys}
          />
          {groupingMode === 'none' && hasMore && (
            <LoadMoreButton theme={theme} language={language} onClick={onLoadMore} />
          )}
        </div>
      ) : (
        <div>
          <EntryGrid
            theme={theme}
            language={language}
            searchQuery={searchQuery}
            filteredEntries={visible}
            groupingMode={groupingMode}
            groupedEntries={groupedEntries}
            groupKeys={groupKeys}
            isListView={isListView}
            onSelectEntry={onSelectEntry}
            showFilterHub={showFilterHub}
            setShowFilterHub={setShowFilterHub}
            customIdentity={customIdentity}
            currentUser={currentUser}
          />
          {groupingMode === 'none' && hasMore && (
            <LoadMoreButton theme={theme} language={language} onClick={onLoadMore} />
          )}
        </div>
      )}
    </div>
  );
};
