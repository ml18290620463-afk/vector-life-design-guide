import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, Database, Download, Flame, Share2 } from 'lucide-react';
import { Container, DiaryEntry, Theme } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface ViewerActionFooterProps {
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  containers: Container[];
  showPackingMenu: boolean;
  onTogglePackingMenu: () => void;
  onMoveToContainer: (containerId: string | undefined) => void;
  onArchiveOrRestore: () => void;
  onDownload: () => void;
  onRequestBurn: () => void;
  /** Phase 3 §3.h — open the share-card preview / export modal.
   *  Optional so legacy callers compile without modification. */
  onShareCard?: () => void;
}

export const ViewerActionFooter: React.FC<ViewerActionFooterProps> = ({
  theme,
  t,
  entry,
  containers,
  showPackingMenu,
  onTogglePackingMenu,
  onMoveToContainer,
  onArchiveOrRestore,
  onDownload,
  onRequestBurn,
  onShareCard,
}) => (
  <div
    className={`mt-12 pt-6 border-t flex flex-col gap-4 relative z-20 ${theme === 'light' ? 'border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_5%,_transparent)]' : 'border-cyan-900/30'}`}
  >
    <div className="flex justify-center">
      <CyberButton
        variant="ghost"
        onClick={onArchiveOrRestore}
        theme={theme}
        className={`min-w-[280px] py-4 border-b-2 font-serif text-sm tracking-[0.3em] ${theme === 'light' ? 'border-green-100 text-vector-cyan-brand hover:bg-green-50' : 'border-green-900/30 text-cyan-400/80 hover:bg-green-950/20'}`}
      >
        <Archive className="w-4 h-4 mr-3 opacity-60" />
        {entry.isArchived ? t.restoreData : t.archiveData}
      </CyberButton>
    </div>

    <div className="grid grid-cols-3 gap-3 md:gap-4 font-mono">
      <div className="relative">
        <CyberButton
          variant="ghost"
          onClick={onTogglePackingMenu}
          theme={theme}
          className={`w-full border py-2 text-[11px] ${theme === 'light' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-yellow-900/50 text-yellow-600 hover:bg-yellow-950/20'}`}
        >
          <Database className="w-4 h-4 mr-1 md:mr-2" />
          <span className="truncate">{t.moveToPackage}</span>
        </CyberButton>

        <AnimatePresence>
          {showPackingMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`absolute bottom-full left-0 mb-2 w-48 border shadow-2xl p-2 z-[60] flex flex-col gap-1 ${theme === 'light' ? 'bg-white border-slate-200 shadow-xl' : 'bg-black border-cyan-900 shadow-cyan-500/10'}`}
            >
              <div className="px-2 py-1.5 text-[10px] text-slate-400 uppercase tracking-widest">
                {t.storagePackage}
              </div>
              <button
                onClick={() => onMoveToContainer(undefined)}
                className="text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors uppercase"
              >
                [ {t.uncategorized} ]
              </button>
              {containers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onMoveToContainer(c.id)}
                  className="text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors uppercase"
                >
                  {c.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CyberButton
        variant="ghost"
        onClick={onDownload}
        theme={theme}
        className={`w-full border py-2 text-[11px] ${theme === 'light' ? 'border-vector-cyan-brand/20 text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'border-cyan-900/50 text-cyan-600 hover:bg-cyan-950/20'}`}
      >
        <Download className="w-4 h-4 mr-1 md:mr-2" /> {t.downloadNote}
      </CyberButton>

      <CyberButton
        variant="danger"
        onClick={onRequestBurn}
        theme={theme}
        className="w-full py-2 text-[11px]"
      >
        <Flame className="w-4 h-4 mr-1 md:mr-2" /> {t.burnMessage}
      </CyberButton>
    </div>

    {onShareCard && (
      <div className="flex justify-center">
        <CyberButton
          variant="ghost"
          onClick={onShareCard}
          theme={theme}
          className={`min-w-[260px] py-2 text-[11px] tracking-[0.2em] ${theme === 'light' ? 'border-vector-cyan-brand/20 text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'border-cyan-900/50 text-cyan-500 hover:bg-cyan-950/20'} border`}
          aria-label={t.shareCardOpen ?? t.shareCardTitle ?? 'Share card'}
        >
          <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {t.shareCardOpen ?? t.shareCardTitle ?? 'Share card'}
        </CyberButton>
      </div>
    )}
  </div>
);
