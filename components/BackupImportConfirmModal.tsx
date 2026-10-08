import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface BackupImportConfirmModalProps {
  /** When non-null, the modal is shown and the message is rendered. */
  pending: { message: string; password?: boolean } | null;
  theme: Theme;
  t: TranslationDictionary;
  onResolve: (ok: boolean, password?: string) => void;
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
}) => {
  const [password, setPassword] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPassword('');
    if (!pending) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>(pending.password ? 'input' : 'button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResolve(false);
      }
      if (event.key === 'Tab') {
        const nodes = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? [],
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [pending, onResolve]);
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={
            pending.password
              ? (t.backupDecryptTitle ?? 'Decrypt backup')
              : (t.importStarMap ?? 'Restore Backup')
          }
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
                {pending.password
                  ? (t.backupDecryptTitle ?? 'Decrypt backup')
                  : (t.importStarMap ?? 'Restore Backup')}
              </h3>
              <p
                className={`text-sm leading-relaxed ${theme === 'light' ? 'text-slate-700' : 'text-cyan-100/80'}`}
              >
                {pending.message}
              </p>
              {pending.password && (
                <label className={theme === 'light' ? 'text-slate-700' : 'text-cyan-100'}>
                  <span className="text-sm">{t.backupPasswordLabel ?? 'Backup password'}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && password) onResolve(true, password);
                    }}
                    className="mt-2 w-full rounded border border-cyan-500/30 bg-transparent p-3 outline-none focus:border-cyan-500"
                  />
                </label>
              )}
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
                  onClick={() => (pending.password ? onResolve(true, password) : onResolve(true))}
                  disabled={pending.password && !password}
                  className={`px-4 py-2 text-[11px] font-mono uppercase tracking-widest rounded border disabled:opacity-40 ${theme === 'light' ? 'border-cyan-700 bg-cyan-50 text-cyan-900 hover:bg-cyan-100' : 'border-cyan-500 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'}`}
                >
                  {pending.password
                    ? (t.backupDecryptAction ?? 'Decrypt and check')
                    : (t.confirmImport ?? 'Import')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
