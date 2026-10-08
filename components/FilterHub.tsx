import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Database, Plus, X, Folder, LayoutGrid, Trash2, Clock } from 'lucide-react';
import { Container, DiaryEntry, GroupingMode, Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';

interface FilterHubProps {
  language: Language;
  theme: Theme;
  entries: DiaryEntry[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  selectedCategory: 'all' | 'uncategorized' | string;
  onSelectCategory: (cat: 'all' | 'uncategorized' | string) => void;
  containers: Container[];
  onAddContainer: (name: string) => void;
  onDeleteContainer: (id: string) => void;
  onClose: () => void;
  accentColor?: 'cyan' | 'green';
  groupingMode: GroupingMode;
  onGroupingModeChange: (mode: GroupingMode) => void;
}

export const FilterHub: React.FC<FilterHubProps> = ({
  language,
  theme,
  entries,
  searchQuery,
  onSearchChange,
  selectedTag,
  onSelectTag,
  selectedCategory,
  onSelectCategory,
  containers,
  onAddContainer,
  onDeleteContainer,
  onClose,
  accentColor = 'cyan',
  groupingMode,
  onGroupingModeChange,
}) => {
  const t = TRANSLATIONS[language];
  const [isAddingContainer, setIsAddingContainer] = useState(false);
  const [newContainerName, setNewContainerName] = useState('');

  const isGreen = accentColor === 'green';

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const handleAddContainer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newContainerName.trim()) {
      onAddContainer(newContainerName.trim());
      setNewContainerName('');
      setIsAddingContainer(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`border-b overflow-hidden mb-8 ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-black/40 border-cyan-900/20'}`}
    >
      <div className="p-6 space-y-8">
        {/* Row 1: Storage Containers / Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-400' : isGreen ? 'text-green-700/60' : 'text-cyan-700/60'}`}
            >
              <Database className="w-4 h-4" /> {t.storagePackage}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingContainer(!isAddingContainer)}
                className={`p-2 border-2 border-dashed rounded flex items-center justify-center transition-all ${theme === 'light' ? 'border-slate-100 text-slate-300 hover:text-cyan-500 hover:border-cyan-500/30' : isGreen ? 'border-green-900/40 text-green-900 hover:text-green-400 hover:border-green-400/50' : 'border-cyan-900/40 text-cyan-900 hover:text-cyan-400 hover:border-cyan-400/50'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className={`p-2 transition-all ${theme === 'light' ? 'text-slate-300 hover:text-vector-magenta' : isGreen ? 'text-green-900 hover:text-green-400' : 'text-cyan-900 hover:text-cyan-400'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => onSelectCategory('all')}
              className={`px-4 sm:px-8 py-3 text-sm font-black tracking-[0.2em] transition-all relative overflow-hidden group ${
                selectedCategory === 'all'
                  ? theme === 'light'
                    ? 'bg-vector-cyan-brand text-white shadow-lg'
                    : isGreen
                      ? 'bg-green-500 text-black shadow-glow-green-bright'
                      : 'bg-cyan-500 text-black shadow-glow-cyan-500-bright'
                  : theme === 'light'
                    ? 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                    : isGreen
                      ? 'bg-transparent border border-green-900/30 text-green-800 hover:text-green-400/60 hover:bg-green-900/10'
                      : 'bg-transparent border border-cyan-900/30 text-cyan-800 hover:text-cyan-400/60 hover:bg-cyan-900/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                {t.allTraces}
              </div>
              {selectedCategory === 'all' && (
                <motion.div
                  layoutId="cat-active"
                  className="absolute bottom-0 left-0 w-full h-1 bg-white/30"
                />
              )}
            </button>

            <button
              onClick={() => onSelectCategory('uncategorized')}
              className={`px-4 sm:px-8 py-3 text-sm font-black tracking-[0.2em] transition-all relative overflow-hidden group ${
                selectedCategory === 'uncategorized'
                  ? theme === 'light'
                    ? 'bg-vector-cyan-brand text-white shadow-lg'
                    : isGreen
                      ? 'bg-green-500 text-black shadow-glow-green-bright'
                      : 'bg-cyan-500 text-black shadow-glow-cyan-500-bright'
                  : theme === 'light'
                    ? 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                    : isGreen
                      ? 'bg-transparent border border-green-900/30 text-green-800 hover:text-green-400/60 hover:bg-green-900/10'
                      : 'bg-transparent border border-cyan-900/30 text-cyan-800 hover:text-cyan-400/60 hover:bg-cyan-900/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                {t.uncategorized}
              </div>
              {selectedCategory === 'uncategorized' && (
                <motion.div
                  layoutId="cat-active"
                  className="absolute bottom-0 left-0 w-full h-1 bg-white/30"
                />
              )}
            </button>

            {containers.map((container) => (
              <div key={container.id} className="relative group">
                <button
                  onClick={() => onSelectCategory(container.id)}
                  className={`px-4 sm:px-8 py-3 text-sm font-black tracking-[0.2em] transition-all relative overflow-hidden pr-12 min-w-[120px] ${
                    selectedCategory === container.id
                      ? theme === 'light'
                        ? 'bg-vector-cyan-brand text-white shadow-lg'
                        : isGreen
                          ? 'bg-green-500 text-black shadow-glow-green-bright'
                          : 'bg-cyan-500 text-black shadow-glow-cyan-500-bright'
                      : theme === 'light'
                        ? 'bg-slate-50 border border-slate-100 text-slate-400 hover:text-vector-cyan-brand'
                        : isGreen
                          ? 'bg-transparent border border-green-900/30 text-green-800 hover:text-green-400 hover:bg-green-900/10'
                          : 'bg-transparent border border-cyan-900/30 text-cyan-800 hover:text-cyan-400 hover:bg-cyan-900/10'
                  }`}
                >
                  <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                    <Database className="w-4 h-4" />
                    {container.name.toUpperCase()}
                  </div>
                  {selectedCategory === container.id && (
                    <motion.div
                      layoutId="cat-active"
                      className="absolute bottom-0 left-0 w-full h-1 bg-white/30"
                    />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteContainer(container.id);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:text-vector-magenta transition-all z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <AnimatePresence>
              {isAddingContainer && (
                <motion.form
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  onSubmit={handleAddContainer}
                  className="flex items-center gap-2"
                >
                  <input
                    autoFocus
                    placeholder={t.addPackage + '...'}
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    className={`px-4 py-2 text-sm font-mono tracking-widest outline-none border transition-all ${theme === 'light' ? 'bg-white border-cyan-100 focus:border-cyan-500' : 'bg-black border-cyan-900/50 text-cyan-400 focus:border-cyan-500'}`}
                  />
                  <button
                    type="submit"
                    className={`p-2 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Row 2: Tag Cloud */}
        <div className="space-y-4">
          <div
            className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-400' : isGreen ? 'text-green-700/60' : 'text-cyan-700/60'}`}
          >
            <Tag className="w-4 h-4" /> {t.tagCloud}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <button
              onClick={() => onSelectTag(null)}
              className={`text-xs font-bold font-mono tracking-widest transition-all ${!selectedTag ? (theme === 'light' ? 'text-vector-cyan-brand bg-cyan-50 px-2' : isGreen ? 'text-green-400 bg-green-500/10 px-2 shadow-glow-green-mid ring-1 ring-green-500/50' : 'text-cyan-400 bg-cyan-500/10 px-2 shadow-glow-cyan-mid ring-1 ring-cyan-500/50') : theme === 'light' ? 'text-slate-400 hover:text-cyan-600' : isGreen ? 'text-green-900/80 hover:text-green-400' : 'text-cyan-900/80 hover:text-cyan-400'}`}
            >
              #ALL / 全量
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => onSelectTag(tag === selectedTag ? null : tag)}
                className={`text-xs font-bold font-mono tracking-widest transition-all hover:scale-105 ${selectedTag === tag ? (theme === 'light' ? 'text-vector-cyan-brand bg-cyan-50 px-2' : isGreen ? 'text-green-400 bg-green-500/10 px-2 shadow-glow-green-mid ring-1 ring-green-500/50' : 'text-cyan-400 bg-cyan-500/10 px-2 shadow-glow-cyan-mid ring-1 ring-cyan-500/50') : theme === 'light' ? 'text-slate-400 hover:text-cyan-600' : isGreen ? 'text-green-800 hover:text-green-400' : 'text-cyan-800 hover:text-cyan-400'}`}
              >
                #{tag.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Time Perspective */}
        <div className="space-y-4">
          <div
            className={`flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-400' : isGreen ? 'text-green-700/60' : 'text-cyan-700/60'}`}
          >
            <Clock className="w-4 h-4" /> {t.timePerspective}
          </div>
          <div className="flex flex-wrap gap-4">
            {(
              [
                { id: 'none', label: t.none },
                { id: 'year', label: t.groupByYear },
                { id: 'month', label: t.groupByMonth },
                { id: 'day', label: t.groupByDay },
              ] satisfies { id: GroupingMode; label: string }[]
            ).map((mode) => {
              const isActive = groupingMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onGroupingModeChange(mode.id)}
                  className={`px-6 py-2.5 text-xs font-bold font-mono tracking-widest transition-all border relative overflow-hidden group
                    ${
                      isActive
                        ? theme === 'light'
                          ? 'bg-cyan-600 border-cyan-800 text-white shadow-lg'
                          : isGreen
                            ? 'bg-green-500/20 border-green-400 text-green-300 ring-1 ring-green-400 shadow-glow-green-strong'
                            : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400 shadow-glow-cyan-strong'
                        : theme === 'light'
                          ? 'bg-white border-slate-100 text-slate-400 hover:border-cyan-200 hover:text-cyan-600'
                          : isGreen
                            ? 'border-green-900/10 bg-white/[0.01] text-green-800 hover:text-green-400 hover:border-green-800'
                            : 'border-cyan-900/10 bg-white/[0.01] text-cyan-800 hover:text-cyan-400 hover:border-cyan-800'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hubGlow"
                      className="absolute inset-0 bg-white/5 pointer-events-none"
                    />
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="hubIndicator"
                      className={`absolute bottom-0 left-0 right-0 h-[3px] ${theme === 'light' ? 'bg-white' : isGreen ? 'bg-green-400' : 'bg-cyan-400'}`}
                    />
                  )}
                  <span className="relative z-10">{mode.label.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Search Bar */}
        <div className="pt-4">
          <div className="relative group max-w-2xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.search + ' . . .'}
              className={`
                w-full py-4 bg-transparent font-mono text-xl transition-all outline-none tracking-[0.2em] border-b-2
                ${
                  theme === 'light'
                    ? 'border-slate-100 focus:border-cyan-400 text-slate-700 placeholder:text-slate-200'
                    : isGreen
                      ? 'border-green-950/40 focus:border-green-500/50 text-green-400 placeholder:text-green-950/80'
                      : 'border-cyan-950/40 focus:border-cyan-500/50 text-cyan-400 placeholder:text-cyan-950/80'
                }
              `}
            />
            {/* Search Glow Line */}
            <motion.div
              initial={false}
              animate={{ width: searchQuery ? '100%' : '0%' }}
              className={`absolute bottom-0 left-0 h-[2px] ${isGreen ? 'bg-green-500 shadow-glow-green-thin' : 'bg-cyan-500 shadow-glow-cyan-thin'}`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
