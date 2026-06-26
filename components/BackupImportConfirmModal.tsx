import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface BackupImportConfirmModalProps {
  /** When non-null, the modal is shown and the message is rendered. */
  pending: { message: string } | null;
  theme: Theme;
  t: TranslationDictionary;
  onResolve: (ok: boolean) => void;
}

/**
 * Confirmation overlay shown when the user has selected a Star Map
 * backup file to import. Pure presentation — the upstream
 * `useBackupImport` hook drives the lifecycle and pumps the resolved
 * answer into its own promise via `onResolve`. Pulled out of
 * `Dashboard.tsx` as part of Phase 2 §2.h.
 */
export const BackupImportConfirmModal: React.FC<BackupImportConfirmModalProps> = ({
  pending,
  theme,
  t,
  onResolve,
}) => (
  <AnimatePresence>
    {pending && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.importStarMap ?? 'Restore Backup'}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className={`w-full max-w-md p-7 border ${theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-black border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)]'}`}
        >
          <div className="flex flex-col gap-5">
            <h3
              className={`text-base font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-900' : 'text-cyan-200'}`}
            >
              {t.importStarMap ?? 'Restore Backup'}
            </h3>
            <p
              className={`text-sm leading-relaxed ${theme === 'light' ? 'text-slate-700' : 'text-cyan-100/80'}`}
            >
              {pending.message}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onResolve(false)}
                className={`px-4 py-2 text-[11px] font-mono uppercase tracking-widest rounded border transition-colors ${theme === 'light' ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-cyan-900/60 text-cyan-300 hover:bg-cyan-900/20'}`}
              >
                {t.confirmCancel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => onResolve(true)}
                autoFocus
                className="px-4 py-2 text-[11px] font-mono uppercase tracking-widest rounded border border-cyan-500 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              >
                {t.confirmImport ?? 'Import'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
