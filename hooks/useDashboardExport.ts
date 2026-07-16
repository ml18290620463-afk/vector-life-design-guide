import { useCallback, useState } from 'react';
import { APP_VERSION } from '../constants';
import type { DiaryEntry } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { downloadTextFile } from '../services/fileDownload';
import {
  buildBackupExport,
  buildNotesExport,
  type NotesExportMode,
} from '../services/dashboardExport';

export interface UseDashboardExportArgs {
  entries: DiaryEntry[];
  filteredEntries: DiaryEntry[];
  currentUser: string | null;
  t: TranslationDictionary;
  /** Marks "the user just exported" so the backup-recency banner clears. */
  recordBackup: () => void;
}

export interface DashboardExport {
  /** Trigger the JSON Star Map download. */
  handleExport: () => void;
  /** Trigger the Markdown notes download for the chosen mode. */
  handleDownloadNotes: (mode?: NotesExportMode) => void;
  /** UI state for the export-target dropdown. */
  exportTarget: string;
  setExportTarget: (target: string) => void;
  /** UI state for the dropdown's open/closed flag. The dashboard owns
   *  the click-outside listener (via `useClickOutside`) because the
   *  ref it produces also has to land on the JSX surface. */
  isExportDropdownOpen: boolean;
  setIsExportDropdownOpen: (open: boolean) => void;
}

/**
 * Owns the dashboard's "export Star Map" + "download notes" workflow
 * using the package version as the backup-format provenance label.
 *
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h. Pure
 * computation — no effects beyond the file-download side effect.
 */
export const useDashboardExport = ({
  entries,
  filteredEntries,
  currentUser,
  t,
  recordBackup,
}: UseDashboardExportArgs): DashboardExport => {
  const handleExport = useCallback(() => {
    const backup = buildBackupExport({
      version: APP_VERSION,
      entries,
      currentUser,
    });
    downloadTextFile(backup.content, backup.filename);
    recordBackup();
  }, [currentUser, entries, recordBackup]);

  const handleDownloadNotes = useCallback(
    (mode: NotesExportMode = 'all') => {
      const notes = buildNotesExport({
        mode,
        entries,
        filteredEntries,
        labels: t,
        currentUser,
      });
      if (notes) downloadTextFile(notes.content, notes.filename);
    },
    [currentUser, entries, filteredEntries, t],
  );

  const [exportTarget, setExportTarget] = useState<string>('all');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  return {
    handleExport,
    handleDownloadNotes,
    exportTarget,
    setExportTarget,
    isExportDropdownOpen,
    setIsExportDropdownOpen,
  };
};
