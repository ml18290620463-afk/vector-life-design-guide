import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Database, FileText } from 'lucide-react';
import type { DiaryEntry, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface SettingsBackupSectionProps {
  theme: Theme;
  t: TranslationDictionary;
  /** Star Map JSON export. */
  onExport: () => void;
  /** Notes export (Markdown / TXT). `entryId` is `'all'` or a specific id. */
  onDownloadNotes: (entryId: string) => void;
  /** Currently highlighted target in the Notes dropdown. */
  exportTarget: string;
  setExportTarget: (target: string) => void;
  /** Notes dropdown open / close. */
  isExportDropdownOpen: boolean;
  setIsExportDropdownOpen: (open: boolean) => void;
  /** Stable ref the dashboard pins on the dropdown surface so
   *  `useClickOutside` can dismiss it. */
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  /** Full entry list used to populate the per-entry export dropdown. */
  entries: DiaryEntry[];
  /** Star Map import handler (file change). When undefined, the import
   *  affordance is hidden entirely. */
  importInputRef?: React.RefObject<HTMLInputElement | null>;
  onImportBackup?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  importStatus?: { kind: 'success' | 'error'; message: string } | null;
}

/**
 * "Backup tracks" section of the Settings drawer: Star Map export,
 * Star Map import (optional), and the per-entry Notes download dropdown.
 * Pulled out of `SettingsPanel.tsx` as part of Phase 2 §2.j.
 */
export const SettingsBackupSection: React.FC<SettingsBackupSectionProps> = ({
  theme,
  t,
  onExport,
  onDownloadNotes,
  exportTarget,
  setExportTarget,
  isExportDropdownOpen,
  setIsExportDropdownOpen,
  dropdownRef,
  entries,
  importInputRef,
  onImportBackup,
  importStatus,
}) => (
  <div
    className={`rounded-2xl border transition-all ${theme === 'light' ? 'bg-slate-50/50 border-slate-100 shadow-sm' : 'bg-cyan-950/5 border-cyan-900/10'}`}
  >
    {/* Star Map export */}
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
                  'Merge entries from a previously exported VECTOR backup JSON.'}
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
            {t.btnImportStarMap ?? 'Import JSON'}
          </CyberButton>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportBackup}
            aria-label={t.btnImportStarMap ?? 'Import JSON'}
          />
        </div>
      </>
    )}

    <div className={`h-px w-full ${theme === 'light' ? 'bg-slate-50' : 'bg-cyan-900/10'}`} />

    {/* Notes export dropdown */}
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
            {t.exportTextLog}
          </div>
          <div
            className={`text-[11px] opacity-60 font-medium leading-relaxed max-w-[280px] ${theme === 'light' ? 'text-slate-500' : 'text-cyan-800'}`}
          >
            {t.logDesc}
          </div>
        </div>
      </div>

      <div
        className="relative w-full sm:w-auto"
        ref={dropdownRef as React.RefObject<HTMLDivElement>}
      >
        <CyberButton
          onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
          variant="ghost"
          className="w-full sm:w-auto px-6 py-2.5 text-[11px] font-black border-cyan-100 bg-white shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider"
          theme={theme}
        >
          <FileText className="w-4 h-4" />
          {t.btnExportTextLog}
        </CyberButton>

        <AnimatePresence>
          {isExportDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              role="menu"
              className={`absolute bottom-full right-0 mb-3 z-50 min-w-[240px] rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${theme === 'light' ? 'bg-white/95 border-slate-200' : 'bg-black/90 border-cyan-900/40'}`}
            >
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                  {t.selectExportTarget}
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setExportTarget('all');
                    setIsExportDropdownOpen(false);
                    onDownloadNotes('all');
                  }}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between group transition-all ${exportTarget === 'all' ? 'bg-cyan-500/10' : 'hover:bg-cyan-500/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText
                      className={`w-4 h-4 ${exportTarget === 'all' ? 'text-cyan-500' : 'text-cyan-800'}`}
                    />
                    <span
                      className={`text-[11px] font-black uppercase tracking-tight ${exportTarget === 'all' ? 'text-cyan-400' : 'text-cyan-700'}`}
                    >
                      {t.exportAll}
                    </span>
                  </div>
                </button>
                <div
                  className={`h-px my-2 ${theme === 'light' ? 'bg-slate-100' : 'bg-cyan-900/20'}`}
                />
                {entries
                  .filter((e) => !e.isArchived)
                  .map((entry) => (
                    <button
                      role="menuitem"
                      key={entry.id}
                      onClick={() => {
                        setExportTarget(entry.id);
                        setIsExportDropdownOpen(false);
                        onDownloadNotes(entry.id);
                      }}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between group transition-all ${exportTarget === entry.id ? 'bg-cyan-500/10' : 'hover:bg-cyan-500/5'}`}
                    >
                      <div className="flex flex-col">
                        <span
                          className={`text-[9px] font-mono leading-none mb-1 ${theme === 'light' ? 'text-slate-400' : 'text-cyan-800'}`}
                        >
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        <span
                          className={`text-[11px] font-bold truncate max-w-[160px] ${exportTarget === entry.id ? 'text-cyan-400' : 'text-cyan-700'}`}
                        >
                          {entry.title}
                        </span>
                      </div>
                      {exportTarget === entry.id && (
                        <CheckCircle className="w-4 h-4 text-cyan-500" />
                      )}
                    </button>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>
);
