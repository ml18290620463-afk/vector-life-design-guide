import { useCallback } from 'react';
import { APP_VERSION } from '../constants';
import { downloadTextFile } from '../services/fileDownload';
import { exportVaultBackupFile } from '../services/vaultBackup';

export interface UseDashboardExportArgs {
  currentUser: string | null;
  /** Marks "the user just exported" so the backup-recency banner clears. */
  recordBackup: () => void;
}

export interface DashboardExport {
  /** Trigger the complete VECTOR backup download. */
  handleExport: () => Promise<void>;
}

/** Owns the complete backup workflow for the settings drawer. */
export const useDashboardExport = ({
  currentUser,
  recordBackup,
}: UseDashboardExportArgs): DashboardExport => {
  const handleExport = useCallback(async () => {
    try {
      const backup = await exportVaultBackupFile(APP_VERSION, currentUser ?? undefined);
      await downloadTextFile(
        JSON.stringify(backup, null, 2),
        `VECTOR-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      recordBackup();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '备份失败，请重试');
    }
  }, [currentUser, recordBackup]);

  return { handleExport };
};
