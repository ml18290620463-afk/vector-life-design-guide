import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Lock, Shield, ShieldAlert } from 'lucide-react';
import { DiaryEntry, GroupingMode, Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { createSeededRandom } from '../lib/random';
import { asLegacyEntry, getEntryTimestamp, getEntryTitle } from '../services/entryCompat';
import { useNowTick } from '../hooks/useNowTick';

interface VaultListViewProps {
  entries: DiaryEntry[];
  language: Language;
  theme: Theme;
  onSelectEntry: (entry: DiaryEntry) => void;
  groupingMode?: GroupingMode;
  groupedEntries?: Record<string, DiaryEntry[]>;
  groupKeys?: string[];
}

// Specialized Vault List Component for precise 3-field display
export const VaultListView = ({
  entries,
  language,
  theme,
  onSelectEntry,
  groupingMode = 'none',
  groupedEntries = {},
  groupKeys = [],
}: VaultListViewProps) => {
  const t = TRANSLATIONS[language];
  const hasPendingTimeLock = useMemo(
    () =>
      entries.some((entry) => typeof entry.unlockAt === 'number' && entry.unlockAt > Date.now()),
    [entries],
  );
  const now = useNowTick(hasPendingTimeLock);
  const decorativeNoise = useMemo(
    () =>
      new Map(
        entries.map((entry) => {
          const random = createSeededRandom(`vault-${entry.id}`);
          const lines = Array.from({ length: 5 }, () =>
            Array.from({ length: 48 }, () => Math.floor(random() * 36).toString(36)).join(''),
          );
          return [entry.id, lines];
        }),
      ),
    [entries],
  );

  const formatDate = (val: number | string | Date) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-----';
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  };

  const getTitle = (e: DiaryEntry) => getEntryTitle(asLegacyEntry(e), t.untitledTheme || 'Trace');

  const isEncrypted = (e: DiaryEntry) =>
    e.isEncrypted === true && (!e.unlockAt || now < e.unlockAt);

  const formatCountdown = (unlockAt: number) => {
    const diff = unlockAt - now;
    if (diff <= 0) return '00:00:00';

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    if (h > 99) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderEntry = (entry: DiaryEntry, idx: number) => {
    const encrypted = isEncrypted(entry);

    return (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.02 }}
        onClick={() => onSelectEntry(entry)}
        className={`group flex flex-row items-center justify-between px-8 min-h-[72px] transition-all cursor-pointer relative overflow-hidden backdrop-blur-sm border-l-2 ${
          theme === 'light'
            ? 'bg-white/40 border-slate-200/40 hover:bg-white hover:border-cyan-500'
            : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03] hover:border-cyan-500/50'
        }`}
      >
        <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none font-mono text-[8px] overflow-hidden whitespace-nowrap select-none">
          {(decorativeNoise.get(entry.id) || []).map((line, i) => (
            <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
              {line}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 relative z-10 py-2 flex-1">
          <div className="flex items-center gap-3">
            <span
              className={`text-[9px] font-mono tracking-[0.4em] uppercase ${
                theme === 'light' ? 'text-slate-400' : 'text-slate-500 group-hover:text-cyan-500/60'
              }`}
            >
              {formatDate(getEntryTimestamp(asLegacyEntry(entry)))}
            </span>
            <div
              className={`h-[1px] w-8 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/[0.05]'}`}
            />
            {entry.tags?.slice(0, 1).map((tag, i) => (
              <span
                key={i}
                className={`text-[8px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-300' : 'text-slate-600'}`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <h4
              className={`text-md font-bold tracking-[0.1em] uppercase transition-all duration-300 ${
                theme === 'light' ? 'text-slate-800' : 'text-slate-200 group-hover:text-white'
              }`}
            >
              {getTitle(entry)}
            </h4>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-8 shrink-0">
          {encrypted && entry.unlockAt && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[8px] font-mono opacity-20 uppercase tracking-[0.2em]">
                Restricted
              </span>
              <span
                className={`text-xs font-mono font-black ${theme === 'light' ? 'text-vector-magenta/80 shadow-[0_0_10px_color-mix(in_srgb,_var(--color-vector-magenta)_10%,_transparent)]' : 'text-vector-magenta neon-glow-alert'}`}
              >
                {formatCountdown(entry.unlockAt)}
              </span>
            </div>
          )}

          <div
            className={`p-1.5 transition-all duration-500 ${
              encrypted
                ? 'text-vector-magenta/40 group-hover:text-vector-magenta neon-glow-alert'
                : 'text-slate-600 group-hover:text-cyan-400 font-bold'
            }`}
          >
            {encrypted ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          </div>

          <ChevronRight
            className={`w-4 h-4 transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 ${
              theme === 'light' ? 'text-slate-300' : 'text-white/20'
            }`}
          />
        </div>
      </motion.div>
    );
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-1000">
        <div
          className={`w-20 h-20 rounded-full border border-dashed mb-8 flex items-center justify-center opacity-10 ${theme === 'light' ? 'border-slate-400' : 'border-cyan-500'}`}
        >
          <ShieldAlert className="w-10 h-10" />
        </div>
        <p
          className={`text-base font-mono tracking-[0.2em] font-medium ${theme === 'light' ? 'text-slate-400' : 'text-cyan-900'}`}
        >
          {language === 'zh' ? '暂无可进入记忆舱的历史记录' : 'NO HISTORY RECORDS ACCESSIBLE'}
        </p>
      </div>
    );
  }

  if (groupingMode !== 'none') {
    return (
      <div className="space-y-8 py-12 max-w-4xl mx-auto px-4">
        {groupKeys.map((key) => (
          <div key={key} className="space-y-4">
            <div className="flex items-center gap-4 px-8">
              <div className="w-1 h-4 bg-cyan-500 rounded-full" />
              <h3
                className={`text-xl font-black tracking-widest uppercase ${theme === 'light' ? 'text-slate-800' : 'text-cyan-500'}`}
              >
                {key}
              </h3>
              <span className="text-[10px] font-mono text-slate-500 opacity-40">
                [{groupedEntries[key]?.length || 0}]
              </span>
            </div>
            <div className="space-y-[4px]">
              {groupedEntries[key]?.map((entry, idx) => renderEntry(entry, idx))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-[4px] py-12 max-w-4xl mx-auto px-4">
      {entries
        .sort((a, b) => {
          const timeA = getEntryTimestamp(asLegacyEntry(a));
          const timeB = getEntryTimestamp(asLegacyEntry(b));
          return timeB - timeA;
        })
        .map((entry, idx) => renderEntry(entry, idx))}
    </div>
  );
};
