import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface VaultUnlockModalProps {
  open: boolean;
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  vaultPassword: string;
  setVaultPassword: (value: string) => void;
  vaultError: boolean;
  onUnlock: () => void;
  onCancel: () => void;
}

/**
 * Master-password verification overlay shown when the user clicks the
 * sealed vault but no in-memory password exists. Pure presentation —
 * the workflow lives in `useDashboardVault`. Pulled out of
 * `Dashboard.tsx` as part of Phase 2 §2.h.
 */
export const VaultUnlockModal: React.FC<VaultUnlockModalProps> = ({
  open,
  theme,
  language,
  t,
  vaultPassword,
  setVaultPassword,
  vaultError,
  onUnlock,
  onCancel,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.masterLock}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className={`w-full max-w-sm p-8 border ${theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-black border-cyan-500/20 shadow-[0_0_50px_color-mix(in_srgb,_var(--color-cyan-500)_15%,_transparent)]'}`}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border border-dashed border-cyan-500/40 flex items-center justify-center">
              <Shield className="w-8 h-8 text-cyan-500" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-mono font-bold tracking-widest text-cyan-500 uppercase">
                {t.masterLock}
              </h3>
              <p className="text-[10px] font-mono text-cyan-800 uppercase tracking-widest mt-1 opacity-60">
                VAULT ACCESS RESTRICTED
              </p>
            </div>

            <div className="w-full relative">
              <input
                autoFocus
                type="password"
                value={vaultPassword}
                onChange={(e) => setVaultPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
                placeholder="▪ ▪ ▪ ▪ ▪ ▪"
                aria-label={t.masterLock}
                className={`w-full bg-transparent border-b p-4 text-center text-xl tracking-[0.5em] focus:outline-none transition-colors ${vaultError ? 'border-vector-magenta text-vector-magenta neon-border-alert' : 'border-cyan-900 focus:border-cyan-500 text-cyan-400'}`}
              />
              {vaultError && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-mono text-vector-magenta uppercase font-bold neon-glow-alert"
                >
                  {t.passwordMismatch}
                </motion.p>
              )}
            </div>

            <div className="flex gap-3 w-full pt-4">
              <button
                onClick={onCancel}
                className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest border transition-colors ${theme === 'light' ? 'border-slate-200 text-slate-400 hover:bg-slate-50' : 'border-cyan-900 text-cyan-800 hover:bg-cyan-950/30'}`}
              >
                {language === 'zh' ? '取消' : 'CANCEL'}
              </button>
              <button
                onClick={onUnlock}
                className="flex-1 py-3 text-[10px] font-mono uppercase tracking-widest bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors"
              >
                {t.open || '解锁'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
