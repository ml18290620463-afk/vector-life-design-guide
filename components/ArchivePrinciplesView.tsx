import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Book, Plus, Shield, Star, Trash2 } from 'lucide-react';
import type { Principle, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface ArchivePrinciplesViewProps {
  theme: Theme;
  t: TranslationDictionary;
  principles: Principle[];
  onAddPrinciple: (text: string, year: number, showOnHome: boolean) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
}

const PRINCIPLE_MAX_LENGTH = 30;

/**
 * Principles tab of ArchiveVault: an "add new principle" form (text +
 * target year + show-on-home toggle) followed by the persisted list
 * grouped by year, descending. Each principle row exposes a
 * show-on-home toggle and a delete affordance.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchivePrinciplesView: React.FC<ArchivePrinciplesViewProps> = ({
  theme,
  t,
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
}) => {
  const [newPrincipleText, setNewPrincipleText] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showOnHome, setShowOnHome] = useState(true);

  const overLimit = newPrincipleText.length >= PRINCIPLE_MAX_LENGTH;
  const years = Array.from(new Set(principles.map((p) => p.year))).sort((a, b) => b - a);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-8">
        <div
          className={`p-3 border rounded-lg ${theme === 'light' ? 'bg-white border-vector-cyan-brand/10 shadow-sm' : 'bg-white/5 border-white/10'}`}
        >
          <Book
            className={`w-6 h-6 ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
          />
        </div>
        <div>
          <h2
            className={`text-xl font-bold tracking-widest uppercase ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
          >
            {t.principlesLibrary}
          </h2>
          <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
            {t.principlesDesc}
          </p>
        </div>
      </div>

      {/* Add Principle Form */}
      <div
        className={`border p-6 rounded-sm mb-12 relative overflow-hidden group ${theme === 'light' ? 'bg-white/60 border-vector-cyan-brand/5 shadow-sm' : 'bg-green-950/10 border-green-900/50'}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="archive-principle-text" className="sr-only">
                {t.addPrinciple}
              </label>
              <textarea
                id="archive-principle-text"
                value={newPrincipleText}
                onChange={(e) => setNewPrincipleText(e.target.value.slice(0, PRINCIPLE_MAX_LENGTH))}
                placeholder={t.principlePlaceholder.replace('{year}', selectedYear.toString())}
                aria-label={t.addPrinciple}
                className={`w-full border p-3 text-sm focus:border-vector-cyan-brand outline-none min-h-[80px] resize-none font-mono ${theme === 'light' ? 'bg-vector-cyan-brand/2 border-vector-cyan-brand/5 text-vector-ink-strong placeholder:text-vector-slate-soft/30' : 'bg-black border-white/5 text-cyan-400 placeholder:text-cyan-900'} ${overLimit ? 'border-vector-magenta/50' : ''}`}
              />
              <div className="flex justify-between mt-1 px-1">
                <span
                  className={`text-[9px] font-mono ${overLimit ? 'text-vector-magenta neon-glow-alert' : theme === 'light' ? 'text-vector-slate-soft/40' : 'text-slate-600'}`}
                >
                  {t.charLimit.replace('{count}', newPrincipleText.length.toString())}
                </span>
                {overLimit && (
                  <span
                    role="alert"
                    className="text-[9px] font-mono text-vector-magenta uppercase tracking-tighter neon-glow-alert"
                  >
                    {t.charLimitWarning}
                  </span>
                )}
              </div>
            </div>
            <div className="w-32 flex flex-col gap-2">
              <label
                htmlFor="archive-principle-year"
                className={`text-[10px] uppercase tracking-widest mb-1 ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}`}
              >
                {t.targetYear}
              </label>
              <input
                id="archive-principle-year"
                type="number"
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())
                }
                className={`border p-2 text-xs outline-none focus:border-vector-cyan-brand w-full ${theme === 'light' ? 'bg-vector-cyan-brand/2 border-vector-cyan-brand/5 text-vector-slate-mid' : 'bg-black border-green-900/50 text-green-500'}`}
                min="1900"
                max="2100"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 px-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={showOnHome}
              aria-label={t.showOnHome}
              onClick={() => setShowOnHome(!showOnHome)}
              className={`w-4 h-4 border flex items-center justify-center transition-all ${showOnHome ? (theme === 'light' ? 'bg-vector-cyan-brand border-vector-cyan-brand' : 'bg-green-500 border-green-500') : theme === 'light' ? 'border-vector-cyan-brand/10' : 'border-green-900'}`}
            >
              {showOnHome && (
                <div className={`w-2 h-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`} />
              )}
            </button>
            <span
              className={`text-[10px] uppercase tracking-widest ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-700'}`}
            >
              {t.showOnHome}
            </span>
          </div>

          <CyberButton
            onClick={() => {
              if (newPrincipleText.trim()) {
                onAddPrinciple(newPrincipleText, selectedYear, showOnHome);
                setNewPrincipleText('');
              }
            }}
            disabled={!newPrincipleText.trim()}
            className="w-full"
            theme={theme}
          >
            <Plus className="w-4 h-4" /> {t.addPrinciple}
          </CyberButton>
        </div>
      </div>

      {/* Principles List */}
      {principles.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center py-12 border border-dashed rounded-lg ${theme === 'light' ? 'border-vector-cyan-brand/10 bg-white/40' : 'border-green-900/30'}`}
        >
          <Shield
            className={`w-12 h-12 mb-4 opacity-30 ${theme === 'light' ? 'text-vector-slate-soft/20' : 'text-green-900'}`}
          />
          <p
            className={`text-sm ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}`}
          >
            {t.noPrinciples}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-4">
                <span
                  className={`text-[10px] font-bold tracking-[0.3em] uppercase ${theme === 'light' ? 'text-vector-slate-soft/40' : 'text-green-600'}`}
                >
                  {t.formedThrough.replace('{year}', year.toString())}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {principles
                  .filter((p) => p.year === year)
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((principle, idx) => (
                    <motion.div
                      key={principle.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`group relative border p-5 transition-all overflow-hidden ${theme === 'light' ? 'bg-white/60 border-vector-cyan-brand/5 hover:border-vector-cyan-brand/30 hover:bg-white' : 'bg-green-950/5 border-green-900/30 hover:border-green-500/50 hover:bg-green-950/10'}`}
                    >
                      <div
                        className={`absolute inset-[2px] border pointer-events-none transition-all duration-500 opacity-20 ${theme === 'light' ? 'border-slate-200 group-hover:border-cyan-200' : 'border-green-900/30 group-hover:border-green-500/30'}`}
                      />
                      <motion.div
                        className="absolute top-0 bottom-0 w-1 pointer-events-none z-10 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_color-mix(in_srgb,var(--color-cyan-400)_40%,transparent)]"
                        initial={{ left: '-5%' }}
                        whileHover={{
                          left: ['-5%', '105%'],
                          transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
                        }}
                      />
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-4">
                          <div
                            className={`mt-1 w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-green-500'}`}
                          />
                          <p
                            className={`text-sm leading-relaxed tracking-wide ${theme === 'light' ? 'text-vector-slate-mid' : 'text-green-300'}`}
                          >
                            {principle.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePrinciple({
                                ...principle,
                                showOnHome: !principle.showOnHome,
                              })
                            }
                            aria-label={t.showOnHome}
                            aria-pressed={principle.showOnHome}
                            className={`p-1 rounded border transition-all ${principle.showOnHome ? (theme === 'light' ? 'bg-vector-cyan-brand/5 border-vector-cyan-brand text-vector-cyan-brand' : 'bg-green-500/10 border-green-500/50 text-green-400') : theme === 'light' ? 'bg-white border-vector-cyan-brand/10 text-vector-slate-soft/40 hover:border-vector-cyan-brand' : 'bg-black border-green-900 text-green-900 hover:border-green-700'}`}
                            title={t.showOnHome}
                          >
                            <Star
                              className={`w-3 h-3 ${principle.showOnHome ? (theme === 'light' ? 'fill-vector-cyan-brand/20' : 'fill-green-400/20') : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePrinciple(principle.id)}
                            aria-label={t.deletePrinciple}
                            className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${theme === 'light' ? 'text-vector-slate-soft/30 hover:text-vector-magenta' : 'text-slate-600 hover:text-vector-magenta hover:drop-shadow-[0_0_5px_color-mix(in_srgb,var(--color-vector-magenta)_50%,transparent)]'}`}
                            title={t.deletePrinciple}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
