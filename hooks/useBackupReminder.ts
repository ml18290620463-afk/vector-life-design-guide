import { useCallback, useState } from 'react';
import { AppStorageKeys, BACKUP_REMINDER_MS } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';

export interface BackupReminder {
  /** Persisted timestamp of the last successful Star Map export. `null`
   *  means the user has never exported. */
  lastBackupAt: number | null;
  /** Whether the amber "backup overdue" banner should be shown right now. */
  backupReminderActive: boolean;
  /**
   * Days since `lastBackupAt`. `null` when never exported (UI shows the
   * "never exported" copy variant) and only meaningful when
   * `backupReminderActive` is true.
   */
  daysSinceBackup: number | null;
  /**
   * Mark "the user just exported" right now. Persists the new timestamp
   * via `setStoredString` and updates the in-memory copy so the banner
   * disappears immediately.
   */
  recordBackup: (timestamp?: number) => void;
}

/**
 * Owns the dashboard's backup-recency banner state (Phase 2 §2.d):
 *
 *  - reads the persisted timestamp from `services/browserStorage`
 *  - decides whether the banner should currently show (no banner if the
 *    user has nothing to back up, or if the gap is below
 *    `BACKUP_REMINDER_MS`)
 *  - exposes `recordBackup()` so the export handler can stamp a fresh
 *    timestamp without the dashboard having to know the storage key
 *
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.h. Pure
 * computation — no effects — so it stays cheap on every render.
 */
export const useBackupReminder = (entriesCount: number): BackupReminder => {
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => {
    const raw = getStoredString(AppStorageKeys.lastBackupAt);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

  const backupReminderActive = (() => {
    if (entriesCount === 0) return false; // nothing worth nagging about yet
    if (lastBackupAt == null) return true; // never exported
    return Date.now() - lastBackupAt > BACKUP_REMINDER_MS;
  })();

  const daysSinceBackup =
    lastBackupAt != null ? Math.floor((Date.now() - lastBackupAt) / (24 * 60 * 60 * 1000)) : null;

  const recordBackup = useCallback((timestamp: number = Date.now()) => {
    setStoredString(AppStorageKeys.lastBackupAt, String(timestamp));
    setLastBackupAt(timestamp);
  }, []);

  return { lastBackupAt, backupReminderActive, daysSinceBackup, recordBackup };
};
