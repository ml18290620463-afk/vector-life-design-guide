import React from 'react';
import { motion } from 'motion/react';
import { Lock, Paperclip, Shield } from 'lucide-react';
import type { DiaryEntry, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface ArchiveEntryCardProps {
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  /** 1-based ordinal inside its bucket; rendered as the spine badge in
   *  list view. */
  index: number;
  /** True when the parent group has > 10 entries (renders as a flat
   *  list row instead of a grid card). */
  isListView: boolean;
  /** Animation index used for the staggered entry transition. */
  delayIndex: number;
  /** Snapshot of the live "now" timestamp; entries with `unlockAt > now`
   *  render as time-locked. */
  now: number;
  /** Click handler — the parent decides whether to navigate or no-op
   *  on time-locked entries (we still call this so the parent can
   *  surface a toast etc.; the card visually disables itself). */
  onSelect: (entry: DiaryEntry) => void;
}

const buildArchiveId = (entry: DiaryEntry): string => {
  const yearSuffix = new Date(entry.createdAt).getFullYear().toString().slice(2);
  return `AR-${yearSuffix}-${entry.id.slice(0, 4).toUpperCase()}`;
};

/**
 * Single entry inside an ArchiveVault year/month/day bucket. Renders
 * either as a flat list row (when the bucket has > 10 entries) or as a
 * grid card. Time-locked entries get a desaturated style + lock badge
 * and the click handler visually disables itself.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchiveEntryCard: React.FC<ArchiveEntryCardProps> = ({
  theme,
  t,
  entry,
  index,
  isListView,
  delayIndex,
  now,
  onSelect,
}) => {
  const isTimeLocked = !!(entry.unlockAt && entry.unlockAt > now);
  const archiveId = buildArchiveId(entry);
  const displayIdx = index < 10 ? `0${index}` : `${index}`;

  const handleClick = () => {
    if (isTimeLocked) return;
    onSelect(entry);
  };

  if (isListView) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delayIndex * 0.03 }}
        onClick={handleClick}
        className="flex items-center group/container"
      >
        {/* Structural Spine Segment */}
        <div className="relative w-12 flex items-center justify-center pointer-events-none">
          <div
            className={`absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed transform -translate-x-1/2 ${theme === 'light' ? 'border-slate-200' : 'border-green-900/40'}`}
          />
          <div
            className={`z-10 text-[7px] font-black font-mono px-1.5 py-0.5 rounded border shadow-sm transition-all duration-300 group-hover/container:scale-110 ${theme === 'light' ? 'bg-white border-slate-300 text-slate-400' : 'bg-black border-green-800/60 text-green-800'}`}
          >
            {displayIdx}
          </div>
        </div>

        <div
          className={`flex-1 flex items-center gap-4 p-3 border transition-all cursor-pointer group/item relative overflow-hidden font-mono text-[11px] rounded-sm ${
            isTimeLocked
              ? theme === 'light'
                ? 'border-indigo-200 bg-indigo-50/50 cursor-not-allowed opacity-80 shadow-sm'
                : 'border-indigo-900/40 bg-indigo-950/20 cursor-not-allowed opacity-80 group-hover/item:shadow-glow-indigo-500'
              : theme === 'light'
                ? 'bg-gradient-to-r from-white/90 to-white/60 border-vector-cyan-brand/10 hover:bg-white hover:border-vector-cyan-brand text-vector-slate-mid shadow-paper-card'
                : 'bg-gradient-to-br from-green-950/20 via-green-950/10 to-transparent border-cyan-900/40 hover:bg-green-950/30 hover:border-cyan-400/60 text-green-400 shadow-inset-glow-cyan-soft'
          }`}
        >
          {/* Outer Frame Accent for List Item */}
          <div
            className={`absolute top-0 left-0 w-full h-[1px] opacity-10 ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-cyan-500'}`}
          />
          <div
            className={`absolute bottom-0 left-0 w-full h-[1px] opacity-10 ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-cyan-500'}`}
          />

          <div
            className={`absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 pointer-events-none ${theme === 'light' ? 'bg-gradient-to-r from-cyan-500/5 to-transparent' : 'bg-gradient-to-r from-cyan-500/10 to-transparent'}`}
          />

          {/* Scanning Laser Line (List View) */}
          <motion.div
            className="absolute top-0 bottom-0 w-1 pointer-events-none z-10 opacity-0 group-hover/item:opacity-100 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
            initial={{ left: '-5%' }}
            whileHover={{
              left: ['-5%', '105%'],
              transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
            }}
          />

          {/* Stereoscopic Decorative Brackets */}
          <div
            className={`absolute top-0 right-0 w-2 h-2 border-t border-r opacity-0 group-hover/item:opacity-60 transition-all duration-300 ${theme === 'light' ? 'border-cyan-600' : 'border-cyan-400'}`}
          />
          <div
            className={`absolute bottom-1 left-0 w-0.5 h-4 opacity-30 ${theme === 'light' ? 'bg-cyan-200' : 'bg-cyan-900'}`}
          />

          <div className="shrink-0 flex flex-col gap-0.5">
            <div className="opacity-80 text-cyan-800 font-bold">
              [{new Date(entry.createdAt).toLocaleDateString()}]
            </div>
            <div
              className={`text-[8px] opacity-30 tracking-tighter ${theme === 'light' ? 'text-slate-400' : 'text-green-900'}`}
            >
              {archiveId}
            </div>
          </div>

          <div className="flex-1 truncate tracking-[0.1em] flex items-center gap-2">
            <span className="opacity-40 text-cyan-800 font-black">{'>>'}</span>
            <span
              className={`transition-colors uppercase font-bold truncate ${theme === 'light' ? 'group-hover:text-vector-cyan-brand' : 'text-green-500 group-hover:text-cyan-200'}`}
            >
              {entry.title}
            </span>
            {entry.isSample && (
              <span
                data-testid="archive-sample-badge"
                title={t.sampleBadgeAria ?? 'Sample reflection'}
                className={`shrink-0 text-[7px] font-mono uppercase tracking-[0.3em] px-1.5 py-0.5 border rounded-sm ${theme === 'light' ? 'border-amber-300 text-amber-700 bg-amber-50/80' : 'border-amber-500/50 text-amber-300 bg-amber-500/10'}`}
              >
                {t.sampleBadge ?? 'Sample'}
              </span>
            )}
          </div>

          <div className="shrink-0 opacity-60 hidden md:block text-cyan-900 text-[10px]">
            {entry.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="mr-2 px-1 border border-transparent hover:border-current transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isTimeLocked ? (
              <div className="flex items-center gap-1.5 text-vector-magenta transition-colors neon-glow-alert">
                <Lock className="w-3 h-3" />
                <span className="text-[9px] font-bold tracking-tighter uppercase px-1 border border-vector-magenta/30 neon-border-alert">
                  {t.encryptedRecord || 'RESTRICTED'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-cyan-700 group-hover/item:text-teal-400 transition-colors">
                <Shield className="w-3 h-3" />
                <span className="text-[8px] font-bold opacity-60 uppercase">
                  {t.safeRecord || 'VERIFIED'}
                </span>
              </div>
            )}
          </div>

          {entry.attachment ? (
            <Paperclip className="w-3 h-3 text-cyan-500 opacity-80" />
          ) : (
            <div
              className={`w-3 h-px opacity-20 ${theme === 'light' ? 'bg-slate-400' : 'bg-green-600'}`}
            />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delayIndex * 0.05 }}
      onClick={handleClick}
      className={`border p-4 transition-all cursor-pointer group/item relative overflow-hidden rounded-sm ${
        isTimeLocked
          ? theme === 'light'
            ? 'bg-indigo-50/60 border-indigo-200/40 cursor-not-allowed grayscale opacity-70 shadow-inset-glow-rose-soft'
            : 'bg-indigo-950/20 border-indigo-900/40 cursor-not-allowed grayscale opacity-70 shadow-inset-glow-rose-deep'
          : theme === 'light'
            ? 'bg-gradient-to-br from-white to-slate-50 border-vector-cyan-brand/10 hover:border-vector-cyan-brand hover:shadow-lg'
            : 'bg-gradient-to-br from-green-950/10 to-transparent border-cyan-900/40 hover:bg-green-900/20 hover:border-cyan-400/60 hover:shadow-glow-cyan-400-soft'
      }`}
    >
      {/* Nested Mechanical Frame (Grid) */}
      <div
        className={`absolute inset-[2px] border pointer-events-none transition-all duration-500 opacity-20 ${theme === 'light' ? 'border-slate-200 group-hover/item:border-cyan-200' : 'border-green-900/30 group-hover/item:border-cyan-900/50'}`}
      />

      {/* Inner Depth Glow (Grid) */}
      <div
        className={`absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-700 pointer-events-none ${theme === 'light' ? 'shadow-inset-glow-vector-cyan-brand' : 'shadow-inset-glow-cyan-400-deep'}`}
      />

      {/* Scanning Laser Line (Grid View) */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 pointer-events-none z-10 opacity-0 group-hover/item:opacity-100 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
        initial={{ top: '-5%' }}
        whileHover={{
          top: ['-5%', '105%'],
          transition: { duration: 2, repeat: Infinity, ease: 'linear' },
        }}
      />

      {/* Stereoscopic Decorative Brackets for Grid Item */}
      <div
        className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 transition-all duration-300 ${theme === 'light' ? 'border-slate-100 group-hover/item:border-cyan-600' : 'border-green-950 group-hover/item:border-cyan-500'}`}
      />
      <div
        className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r transition-all duration-300 ${theme === 'light' ? 'border-slate-100 group-hover/item:border-cyan-200' : 'border-cyan-900 group-hover/item:border-cyan-900'}`}
      />

      {entry.isSample && (
        <span
          data-testid="archive-sample-badge-grid"
          title={t.sampleBadgeAria ?? 'Sample reflection'}
          className={`absolute top-2 right-2 z-20 text-[7px] font-mono uppercase tracking-[0.3em] px-1.5 py-0.5 border rounded-sm ${theme === 'light' ? 'border-amber-300 text-amber-700 bg-amber-50/80' : 'border-amber-500/50 text-amber-300 bg-amber-500/10'}`}
        >
          {t.sampleBadge ?? 'Sample'}
        </span>
      )}

      <div
        className={`absolute top-0 right-10 text-[8px] font-mono opacity-20 group-hover/item:opacity-40 transition-opacity p-1 border-x border-b tracking-tighter ${theme === 'light' ? 'text-slate-500 border-slate-200' : 'text-green-700 border-green-900'}`}
      >
        {archiveId}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded transition-colors ${isTimeLocked ? 'bg-vector-magenta/10 text-vector-magenta shadow-glow-vector-magenta-soft' : 'bg-cyan-500/5 text-cyan-600'}`}
          >
            {isTimeLocked ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          </div>
          {entry.attachment && <Paperclip className="w-3 h-3 text-cyan-500" />}
        </div>
        <span
          className={`text-[10px] border px-1.5 py-0.5 rounded-sm font-mono tracking-tighter ${theme === 'light' ? 'text-vector-slate-soft border-vector-cyan-brand/10' : 'text-green-800 border-green-900/40'}`}
        >
          {new Date(entry.createdAt).toLocaleDateString()}
        </span>
      </div>
      <h4
        className={`font-bold mb-2 truncate tracking-tight text-sm ${theme === 'light' ? 'text-vector-ink-strong group-hover/item:text-vector-cyan-brand' : 'text-cyan-100 group-hover/item:text-cyan-50'}`}
      >
        {entry.title}
      </h4>
      <div className="flex items-center justify-between border-t border-dashed mt-2 pt-2 border-vector-cyan-brand/5">
        <p
          className={`text-[9px] truncate font-mono tracking-tighter ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-900'}`}
        >
          {entry.tags.map((tag) => `#${tag}`).join(' ')}
        </p>
        <span
          className={`text-[8px] font-black uppercase tracking-tighter sm:opacity-0 group-hover/item:opacity-100 transition-opacity ${isTimeLocked ? 'text-vector-magenta neon-glow-alert' : 'text-teal-500'}`}
        >
          {isTimeLocked ? 'RES_LOCK' : 'CLR_AUTH'}
        </span>
      </div>
    </motion.div>
  );
};
