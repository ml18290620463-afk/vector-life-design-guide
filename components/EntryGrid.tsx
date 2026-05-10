import React, { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Lock, Shield } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DiaryEntry, GroupingMode, Language, Theme } from '../types';
import { DecryptionText } from './DecryptionText';
import { TRANSLATIONS } from '../constants';
import { useNowTick } from '../hooks/useNowTick';

interface EntryGridProps {
  theme: Theme;
  language: Language;
  searchQuery: string;
  filteredEntries: DiaryEntry[];
  groupingMode: GroupingMode;
  groupedEntries: Record<string, DiaryEntry[]>;
  groupKeys: string[];
  isListView: boolean;
  onSelectEntry: (entry: DiaryEntry) => void;
  showFilterHub: boolean;
  setShowFilterHub: (show: boolean) => void;
  customIdentity?: string;
  currentUser?: string | null;
  disableVirtualization?: boolean;
}

type FlatGridItem = { type: 'header'; key: string } | { type: 'entry'; entry: DiaryEntry };

export const EntryGrid: React.FC<EntryGridProps> = ({
  theme,
  language,
  searchQuery,
  filteredEntries,
  groupingMode,
  groupedEntries,
  groupKeys,
  isListView,
  onSelectEntry,
  showFilterHub,
  setShowFilterHub,
  customIdentity,
  currentUser,
  disableVirtualization = false,
}) => {
  const t = TRANSLATIONS[language];
  const parentRef = useRef<HTMLDivElement>(null);

  // Only run a 1Hz tick when at least one entry is currently time-locked.
  // The check is intentionally re-evaluated on every render; it stays cheap
  // because filteredEntries is the already filtered/paginated slice.
  const hasPendingTimeLock = useMemo(
    () =>
      filteredEntries.some(
        (entry) => typeof entry.unlockAt === 'number' && entry.unlockAt > Date.now(),
      ),
    [filteredEntries],
  );
  const now = useNowTick(hasPendingTimeLock);

  const isVitestWorker = Boolean(
    typeof window !== 'undefined' &&
    (window as Window & { __VITEST_WORKER__?: unknown }).__VITEST_WORKER__,
  );

  const isTest =
    disableVirtualization ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
    isVitestWorker;

  // Flatten items for virtualization
  const flatItems = React.useMemo(() => {
    const list: FlatGridItem[] = [];
    groupKeys.forEach((key) => {
      // Show header if grouping is active OR if we have keys and want to categorize ALL
      if (groupingMode !== 'none') {
        list.push({ type: 'header', key });
      }

      const entries = groupedEntries[key];
      if (entries) {
        entries.forEach((entry) => list.push({ type: 'entry', entry }));
      }
    });
    return list;
  }, [groupKeys, groupedEntries, groupingMode]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (item?.type === 'header') return 100;
      return isListView ? 60 : 280;
    },
    overscan: 10,
  });

  // Calculate sizes for mock virtualization if needed
  const virtualItems = React.useMemo(() => {
    if (!isTest) return virtualizer.getVirtualItems();

    let currentStart = 0;
    return flatItems.map((item, index) => {
      const size = item.type === 'header' ? 100 : isListView ? 60 : 280;
      const start = currentStart;
      currentStart += size;
      return {
        index,
        key: `test-${index}`,
        size,
        start,
      };
    });
  }, [isTest, flatItems, isListView, virtualizer]);

  if (filteredEntries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-center py-20 border border-dashed rounded-lg backdrop-blur-sm ${theme === 'light' ? 'border-slate-200 bg-slate-50/50' : 'border-cyan-900/50 bg-black/20'}`}
      >
        <p
          className={`font-mono text-lg ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
        >
          {searchQuery
            ? language === 'zh'
              ? '未找到相关航迹'
              : 'No matching logs found'
            : t.emptyState}
        </p>
        <p className={`text-sm mt-2 ${theme === 'light' ? 'text-slate-300' : 'text-cyan-900'}`}>
          {searchQuery
            ? language === 'zh'
              ? '尝试调整你的检索指令'
              : 'Try adjusting your search directive'
            : t.emptyStateDesc.replace(
                '{user}',
                (customIdentity || currentUser)?.split('@')[0] || 'User',
              )}
        </p>
      </motion.div>
    );
  }

  const totalHeight = isTest
    ? flatItems.reduce(
        (acc, item) => acc + (item.type === 'header' ? 100 : isListView ? 60 : 280),
        0,
      )
    : virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className="max-h-[75vh] overflow-auto custom-scrollbar relative pr-2"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = flatItems[virtualRow.index];

          if (item?.type === 'header') {
            const key = item.key;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`py-8 flex items-center gap-6 z-10 sticky top-0 ${theme === 'light' ? 'bg-slate-50/80 backdrop-blur-xl' : 'bg-black/60 backdrop-blur-xl'} border-b border-white/5`}
              >
                <div
                  className={`w-1 h-8 rounded-full ${theme === 'light' ? 'bg-cyan-500' : 'bg-cyan-400 ring-2 ring-cyan-500/30'}`}
                />
                <h3
                  className={`text-2xl md:text-3xl font-black tracking-[0.2em] uppercase ${theme === 'light' ? 'text-vector-ink-strong' : 'text-white'}`}
                >
                  {key}
                </h3>

                <div className="flex items-center gap-3 ml-auto px-4 py-1 rounded-full bg-white/5 border border-white/5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-emerald-500)_60%,_transparent)] animate-pulse" />
                  <span
                    className={`text-[10px] font-mono tracking-widest font-black uppercase ${theme === 'light' ? 'text-slate-500' : 'text-cyan-400'}`}
                  >
                    {groupedEntries[key]?.length || 0} {language === 'zh' ? '份航迹' : 'LOGS'}
                  </span>
                </div>
              </div>
            );
          }

          if (!item || item.type !== 'entry') return null;

          const { entry } = item;
          if (isListView) {
            const entryIndex = flatItems.filter(
              (it, idx) => it.type === 'entry' && idx <= virtualRow.index,
            ).length;
            const displayIndex = entryIndex < 10 ? `0${entryIndex}` : `${entryIndex}`;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="py-1 flex"
              >
                {/* Structural Spine (Timeline Line) */}
                <div className="relative w-12 flex items-center justify-center pointer-events-none pr-4">
                  <div
                    className={`absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed transition-colors duration-500 ${theme === 'light' ? 'border-cyan-100' : 'border-cyan-900/30'}`}
                  />
                  <div
                    className={`z-10 text-[8px] font-black font-mono px-1.5 py-0.5 rounded border ${theme === 'light' ? 'bg-white border-slate-200 text-slate-300' : 'bg-black border-cyan-900/50 text-cyan-800'}`}
                  >
                    {displayIndex}
                  </div>
                </div>

                <div
                  data-testid={`entry-card-${entry.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={entry.title}
                  onClick={() => {
                    if (entry.unlockAt && entry.unlockAt > now) return;
                    onSelectEntry(entry);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (entry.unlockAt && entry.unlockAt > now) return;
                    onSelectEntry(entry);
                  }}
                  className={`
                    flex-1 flex items-center gap-4 h-full px-6 py-4 border-l-2 font-mono text-[11px] transition-all cursor-pointer group relative overflow-hidden rounded-r-lg
                    ${
                      entry.unlockAt && entry.unlockAt > now
                        ? theme === 'light'
                          ? 'border-indigo-200/50 bg-indigo-50/5 cursor-not-allowed opacity-60'
                          : 'border-indigo-900/40 bg-indigo-950/5 cursor-not-allowed opacity-60 shadow-[inset_0_0_20px_color-mix(in_srgb,_var(--color-indigo-500)_5%,_transparent)]'
                        : theme === 'light'
                          ? 'border-slate-100 bg-white/40 hover:bg-white hover:border-cyan-500 text-slate-900'
                          : 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-cyan-500/50 text-slate-300'
                    }
                  `}
                >
                  {/* Stereoscopic Decorative Lines */}
                  <div
                    className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${theme === 'light' ? 'border-slate-200 opacity-40' : 'border-cyan-500/10'}`}
                  />
                  <div
                    className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${theme === 'light' ? 'border-slate-200 opacity-40' : 'border-cyan-500/10'}`}
                  />

                  {/* Left Connector Line */}
                  <div
                    className={`absolute top-1/2 left-0 w-3 h-px -translate-y-1/2 ${theme === 'light' ? 'bg-cyan-100' : 'bg-cyan-500/20'}`}
                  />

                  {/* Outer Frame Accent for List Item */}
                  <div
                    className={`absolute top-0 left-0 w-full h-[1px] opacity-10 ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-cyan-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-cyan-500)_40%,_transparent)]'}`}
                  />
                  <div
                    className={`absolute bottom-0 left-0 w-full h-[1px] opacity-10 ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-cyan-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-cyan-500)_40%,_transparent)]'}`}
                  />

                  {/* Subtle Grid Pattern Overlay (Hover) */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] pointer-events-none transition-opacity duration-500"
                    style={{
                      backgroundImage: `radial-gradient(circle, ${theme === 'light' ? 'black' : 'white'} 1px, transparent 1px)`,
                      backgroundSize: '10px 10px',
                    }}
                  />

                  {/* Scanning Laser Line (List View) */}
                  <motion.div
                    className={`absolute top-0 bottom-0 w-1 pointer-events-none z-10 opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-cyan-400 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_color-mix(in_srgb,_var(--color-cyan-400)_40%,_transparent)]'}`}
                    initial={{ left: '-5%' }}
                    whileHover={{
                      left: ['-5%', '105%'],
                      transition: { duration: 1.2, repeat: Infinity, ease: 'linear' },
                    }}
                  />

                  <div
                    className={`shrink-0 opacity-40 font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-600'}`}
                  >
                    [{new Date(entry.createdAt).toLocaleDateString()}]
                  </div>
                  <div
                    className={`shrink-0 hidden lg:block opacity-20 ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    ID:{entry.id.slice(0, 4)}
                  </div>
                  {entry.isSample && (
                    <span
                      data-testid="sample-badge"
                      title={t.sampleBadgeAria}
                      aria-label={t.sampleBadgeAria}
                      className={`shrink-0 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-amber-300 text-amber-700 bg-amber-50/80' : 'border-amber-500/50 text-amber-300 bg-amber-500/10'}`}
                    >
                      {t.sampleBadge}
                    </span>
                  )}
                  {entry.isLetterReply && (
                    <span
                      data-testid="letter-reply-badge"
                      title={(t.letterReplyBadgeAria as string) ?? 'Memoir letter reply'}
                      aria-label={(t.letterReplyBadgeAria as string) ?? 'Memoir letter reply'}
                      className={`shrink-0 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-rose-300 text-rose-700 bg-rose-50/80' : 'border-rose-500/40 text-rose-300 bg-rose-500/10'}`}
                    >
                      ✉ {(t.letterReplyBadge as string) ?? 'Letter'}
                    </span>
                  )}
                  {entry.isEchoChamber && (
                    <span
                      data-testid="echo-chamber-badge"
                      title={(t.echoChamberBadgeAria as string) ?? 'Round-table reply'}
                      aria-label={(t.echoChamberBadgeAria as string) ?? 'Round-table reply'}
                      className={`shrink-0 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-cyan-300 text-cyan-700 bg-cyan-50/80' : 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'}`}
                    >
                      ⚭ {(t.echoChamberBadge as string) ?? 'Round'}
                    </span>
                  )}
                  <div className="flex-1 truncate tracking-[0.2em] flex items-center gap-3">
                    <span className="opacity-20 text-cyan-700 font-black">{'>>'}</span>
                    <span
                      className={`transition-colors uppercase truncate tracking-[0.1em] font-bold ${
                        entry.unlockAt && entry.unlockAt > now
                          ? 'text-indigo-500/60 drop-shadow-[0_0_3px_color-mix(in_srgb,_var(--color-indigo-500)_20%,_transparent)]'
                          : theme === 'light'
                            ? 'group-hover:text-cyan-600 text-slate-700'
                            : 'group-hover:text-white text-slate-400'
                      }`}
                    >
                      {entry.title}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-4 sm:gap-6">
                    {entry.unlockAt && entry.unlockAt > now ? (
                      <div
                        className={`flex items-center gap-2 ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'} group-hover:text-indigo-400 transition-colors`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] hidden sm:group-hover:inline animate-pulse">
                          {t.encryptedRecord || 'ENC'}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-2 ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'} group-hover:text-cyan-400 transition-colors`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span className="hidden sm:group-hover:inline text-[9px] font-black tracking-[0.2em]">
                          {t.safeRecord || 'SAFE'}
                        </span>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </div>
                </div>
              </div>
            );
          } else {
            // Grid View
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="py-3 px-2"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={entry.title}
                  onClick={() => {
                    if (entry.unlockAt && entry.unlockAt > now) return;
                    onSelectEntry(entry);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (entry.unlockAt && entry.unlockAt > now) return;
                    onSelectEntry(entry);
                  }}
                  className={`
                     relative w-full h-full border-l-2 transition-all cursor-pointer group overflow-hidden flex flex-col items-start justify-between p-8
                     ${
                       entry.unlockAt && entry.unlockAt > now
                         ? theme === 'light'
                           ? 'bg-indigo-50/5 border-indigo-200/20 cursor-not-allowed grayscale opacity-60'
                           : 'bg-indigo-950/5 border-indigo-900/40 cursor-not-allowed grayscale opacity-60'
                         : theme === 'light'
                           ? 'bg-white/40 border-slate-100 hover:border-cyan-500 hover:bg-white'
                           : 'bg-white/[0.01] border-white/[0.05] hover:border-cyan-500/50 hover:bg-white/[0.03]'
                     }
                  `}
                >
                  {/* Nested Mechanical Frame (Grid) */}
                  <div
                    className={`absolute inset-[2px] border pointer-events-none transition-all duration-500 opacity-20 ${theme === 'light' ? 'border-slate-200 group-hover:border-cyan-200' : 'border-cyan-500/20 group-hover:border-cyan-500/40'}`}
                  />

                  {/* Inner Depth Glow (Grid) */}
                  <div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none ${theme === 'light' ? 'shadow-[inset_0_0_30px_color-mix(in_srgb,_var(--color-vector-cyan-brand)_5%,_transparent)]' : 'shadow-[inset_0_0_40px_color-mix(in_srgb,_var(--color-cyan-400)_3%,_transparent)]'}`}
                  />

                  {/* Scanning Laser Line (Grid View) */}
                  <motion.div
                    className={`absolute left-0 right-0 h-0.5 pointer-events-none z-10 opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_color-mix(in_srgb,_var(--color-cyan-400)_40%,_transparent)]'}`}
                    initial={{ top: '-5%' }}
                    whileHover={{
                      top: ['-5%', '105%'],
                      transition: { duration: 1.8, repeat: Infinity, ease: 'linear' },
                    }}
                  />

                  {/* Stereoscopic Decorative Lines */}
                  <div
                    className={`absolute top-0 right-0 w-8 h-8 pointer-events-none border-t border-r translate-x-4 -translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300 ${theme === 'light' ? 'border-cyan-200' : 'border-cyan-500/30'}`}
                  />
                  <div
                    className={`absolute bottom-0 right-0 w-4 h-4 pointer-events-none border-b border-r ${theme === 'light' ? 'border-slate-100' : 'border-cyan-900/40'}`}
                  />
                  <div
                    className={`absolute top-1/2 left-0 w-px h-12 -translate-y-1/2 ${theme === 'light' ? 'bg-gradient-to-b from-transparent via-cyan-100 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent'}`}
                  />

                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity font-mono text-[60px] select-none pointer-events-none uppercase font-black">
                    {entry.title.slice(0, 1)}
                  </div>

                  {entry.isSample && (
                    <span
                      data-testid="sample-badge-grid"
                      title={t.sampleBadgeAria}
                      aria-label={t.sampleBadgeAria}
                      className={`absolute top-3 right-3 z-20 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-amber-300 text-amber-700 bg-amber-50/80' : 'border-amber-500/50 text-amber-300 bg-amber-500/10'}`}
                    >
                      {t.sampleBadge}
                    </span>
                  )}
                  {entry.isLetterReply && (
                    <span
                      data-testid="letter-reply-badge-grid"
                      title={(t.letterReplyBadgeAria as string) ?? 'Memoir letter reply'}
                      aria-label={(t.letterReplyBadgeAria as string) ?? 'Memoir letter reply'}
                      className={`absolute ${entry.isSample ? 'top-10' : 'top-3'} right-3 z-20 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-rose-300 text-rose-700 bg-rose-50/80' : 'border-rose-500/40 text-rose-300 bg-rose-500/10'}`}
                    >
                      ✉ {(t.letterReplyBadge as string) ?? 'Letter'}
                    </span>
                  )}
                  {entry.isEchoChamber && (
                    <span
                      data-testid="echo-chamber-badge-grid"
                      title={(t.echoChamberBadgeAria as string) ?? 'Round-table reply'}
                      aria-label={(t.echoChamberBadgeAria as string) ?? 'Round-table reply'}
                      className={`absolute ${entry.isSample ? (entry.isLetterReply ? 'top-[68px]' : 'top-10') : entry.isLetterReply ? 'top-10' : 'top-3'} right-3 z-20 text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-cyan-300 text-cyan-700 bg-cyan-50/80' : 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'}`}
                    >
                      ⚭ {(t.echoChamberBadge as string) ?? 'Round'}
                    </span>
                  )}
                  <div className="flex flex-col gap-1 relative z-10">
                    <span
                      className={`text-[9px] font-mono tracking-[0.4em] uppercase ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      [{new Date(entry.createdAt).toLocaleDateString()}]
                    </span>
                    <h4
                      className={`text-lg font-black tracking-tighter uppercase transition-colors duration-300 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100 group-hover:text-cyan-400'}`}
                    >
                      {entry.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-4 relative z-10 w-full justify-between mt-8 pt-4 border-t border-white/[0.03]">
                    <div className="flex gap-2">
                      {entry.tags?.slice(0, 2).map((tag, i) => (
                        <span
                          key={i}
                          className={`text-[8px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div
                      className={`transition-all duration-500 ${
                        entry.unlockAt && entry.unlockAt > now
                          ? 'text-indigo-500/40 group-hover:text-indigo-400 drop-shadow-[0_0_5px_color-mix(in_srgb,_var(--color-indigo-500)_20%,_transparent)]'
                          : 'text-slate-700 group-hover:text-cyan-400'
                      }`}
                    >
                      {entry.unlockAt && entry.unlockAt > now ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

const HoverDecryptionText = ({ text, speed }: { text: string; speed: number }) => {
  const truncatedText = text.slice(0, 15) + (text.length > 15 ? '...' : '');
  return <DecryptionText text={truncatedText} speed={speed} />;
};
