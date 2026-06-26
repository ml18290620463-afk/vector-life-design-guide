import { useCallback, useMemo, useState } from 'react';
import type { CustomPersona, DiaryEntry, Memory } from '../types';
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
  /** Phase 4 §5.1.A — user-created custom 启明星. Bundled into the v2+
   *  backup so a restore on a new device carries them across.
   *  Optional so legacy callers compile unchanged. */
  customPersonas?: CustomPersona[];
  /** Phase 4 §5.1.B — Memoir long-term memories. Bundled into the
   *  v3+ backup so Memoirs keep "remembering" past conversations
   *  after a restore. Optional. */
  memories?: Memory[];
}

export interface DashboardExport {
  /** A `vMAJOR.MINOR.PATCH`-shaped string derived from entry counts;
   *  used as both the in-app version chip and the backup filename version. */
  dynamicVersion: string;
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
 * plus the dynamic version label derived from entry counts.
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
  customPersonas,
  memories,
}: UseDashboardExportArgs): DashboardExport => {
  const dynamicVersion = useMemo(() => {
    const years = new Set(entries.map((e) => new Date(e.createdAt).getFullYear()));
    const yearCount = Math.max(1, years.size);
    const totalEntries = entries.length;
    const deepArchiveCount = entries.filter((e) => e.isArchived).length;
    return `v${yearCount}.${totalEntries}.${deepArchiveCount}`;
  }, [entries]);

  const handleExport = useCallback(() => {
    const backup = buildBackupExport({
      version: dynamicVersion,
      entries,
      currentUser,
      customPersonas,
      memories,
    });
    downloadTextFile(backup.content, backup.filename);
    recordBackup();
  }, [currentUser, customPersonas, dynamicVersion, entries, memories, recordBackup]);

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
    dynamicVersion,
    handleExport,
    handleDownloadNotes,
    exportTarget,
    setExportTarget,
    isExportDropdownOpen,
    setIsExportDropdownOpen,
  };
};
