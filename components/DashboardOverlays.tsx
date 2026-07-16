import React from 'react';
import type { Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { BackupReminderBanner } from './BackupReminderBanner';
import { BackupImportConfirmModal } from './BackupImportConfirmModal';
import { PwaInstallBanner } from './PwaInstallBanner';

interface DashboardOverlaysProps {
  theme: Theme;
  t: TranslationDictionary;
  // ----- Backup recency banner -----
  backupReminderActive: boolean;
  daysSinceBackup: number | null;
  /** Click target on the "open settings" link inside the banner. */
  onOpenSettings: () => void;
  // ----- PWA install banner (Phase 3 §3.g) -----
  pwaInstallAvailable: boolean;
  onPwaInstall: () => void;
  onPwaInstallDismiss: () => void;
  // ----- Backup import confirmation modal -----
  importPending: { message: string } | null;
  onResolveImport: (ok: boolean) => void;
}

/**
 * Bundles the top-of-tree, almost-always-mounted overlays /
 * banners that sit between Dashboard's header and its body:
 *
 *   - `<BackupReminderBanner>` (in-flow, only renders when `active`)
 *   - `<PwaInstallBanner>` (in-flow, only renders when install is available)
 *   - `<BackupImportConfirmModal>` (overlay, only renders while
 *     `importPending` is non-null)
 *
 * Dashboard is now a system hub; record-list vault verification moved
 * out with the retired Dashboard record-management surface.
 */
export const DashboardOverlays: React.FC<DashboardOverlaysProps> = ({
  theme,
  t,
  backupReminderActive,
  daysSinceBackup,
  onOpenSettings,
  pwaInstallAvailable,
  onPwaInstall,
  onPwaInstallDismiss,
  importPending,
  onResolveImport,
}) => (
  <>
    <BackupReminderBanner
      active={backupReminderActive}
      daysSinceBackup={daysSinceBackup}
      theme={theme}
      t={t}
      onOpenSettings={onOpenSettings}
    />

    <PwaInstallBanner
      active={pwaInstallAvailable}
      theme={theme}
      t={t}
      onInstall={onPwaInstall}
      onDismiss={onPwaInstallDismiss}
    />

    <BackupImportConfirmModal
      pending={importPending}
      theme={theme}
      t={t}
      onResolve={onResolveImport}
    />
  </>
);
