import React from 'react';
import { Database, FileText } from 'lucide-react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface SettingsBackupSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Creates a complete encrypted-vault backup file. */
  onExport: () => void;
  /** Restores a complete backup file. Hidden when restore is unavailable. */
  importInputRef?: React.RefObject<HTMLInputElement | null>;
  onImportBackup?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importStatus?: { kind: 'success' | 'error'; message: string } | null;
}

/**
 * Low-frequency data continuity controls. Complete backup and restore live
 * together here so they remain available without competing with daily work.
 */
export const SettingsBackupSection: React.FC<SettingsBackupSectionProps> = ({
  theme,
  t,
  onExport,
  importInputRef,
  onImportBackup,
  importStatus,
}) => (
  <div
    className={`rounded-2xl border transition-all ${theme === 'light' ? 'bg-slate-50/50 border-slate-100 shadow-sm' : 'bg-cyan-950/5 border-cyan-900/10'}`}
  >
    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${theme === 'light' ? 'bg-cyan-50 text-cyan-500' : 'bg-cyan-950/30 text-cyan-500'}`}
        >
          <FileText className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div
            className={`text-sm font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
          >
            {t.exportStarMap}
          </div>
          <div
            className={`text-[11px] opacity-60 font-medium leading-relaxed max-w-[280px] ${theme === 'light' ? 'text-slate-500' : 'text-cyan-800'}`}
          >
            {t.snapshotDesc}
          </div>
        </div>
      </div>
      <CyberButton
        onClick={onExport}
        variant="ghost"
        className="w-full sm:w-auto px-6 py-2.5 text-[11px] font-black border-cyan-100 bg-white shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider"
        theme={theme}
      >
        <FileText className="w-4 h-4" />
        {t.btnExportStarMap}
      </CyberButton>
    </div>

    {onImportBackup && (
      <>
        <div className={`h-px w-full ${theme === 'light' ? 'bg-slate-50' : 'bg-cyan-900/10'}`} />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${theme === 'light' ? 'bg-cyan-50 text-cyan-500' : 'bg-cyan-950/30 text-cyan-500'}`}
            >
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div
                className={`text-sm font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
              >
                {t.importStarMap ?? 'Restore Backup'}
              </div>
              <div
                className={`text-[11px] opacity-60 font-medium leading-relaxed max-w-[280px] ${theme === 'light' ? 'text-slate-500' : 'text-cyan-800'}`}
              >
                {t.importStarMapDesc ??
                  'Restore records, principles, goals, actions, and personal context from a VECTOR backup.'}
              </div>
              {importStatus && (
                <div
                  className={`text-[11px] font-mono ${
                    importStatus.kind === 'success' ? 'text-cyan-500' : 'text-rose-500'
                  }`}
                  role="status"
                >
                  {importStatus.message}
                </div>
              )}
            </div>
          </div>
          <CyberButton
            onClick={() => importInputRef?.current?.click()}
            variant="ghost"
            className="w-full sm:w-auto px-6 py-2.5 text-[11px] font-black border-cyan-100 bg-white shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider"
            theme={theme}
          >
            <Database className="w-4 h-4" />
            {t.btnImportStarMap ?? 'Restore backup'}
          </CyberButton>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportBackup}
            aria-label={t.btnImportStarMap ?? 'Restore backup'}
          />
        </div>
      </>
    )}
  </div>
);
