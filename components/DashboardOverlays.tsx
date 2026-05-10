import React from 'react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { BackupReminderBanner } from './BackupReminderBanner';
import { BackupImportConfirmModal } from './BackupImportConfirmModal';
import { VaultUnlockModal } from './VaultUnlockModal';
import { PwaInstallBanner } from './PwaInstallBanner';

interface DashboardOverlaysProps {
  theme: Theme;
  language: Language;
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
  // ----- Vault password verification modal -----
  isVerifyingVault: boolean;
  vaultPassword: string;
  setVaultPassword: (value: string) => void;
  vaultError: boolean;
  onUnlockVault: () => void;
  onCancelVault: () => void;
}

/**
 * Bundles the three top-of-tree, almost-always-mounted overlays /
 * banners that sit between Dashboard's header and its body:
 *
 *   - `<BackupReminderBanner>` (in-flow, only renders when `active`)
 *   - `<BackupImportConfirmModal>` (overlay, only renders while
 *     `importPending` is non-null)
 *   - `<VaultUnlockModal>` (overlay, only renders while
 *     `isVerifyingVault`)
 *
 * Pulled out of `Dashboard.tsx` as part of Phase 2 §2.l so the
 * dashboard's render block reads as a flat composition rather than a
 * three-block-tall sequence of conditionally-mounted modals. None of
 * these three components share state internally — the wrapper is a
 * pure pass-through with one reason: it shrinks Dashboard's JSX
 * footprint enough to fall under the ROADMAP §0.1 350-LOC target.
 */
export const DashboardOverlays: React.FC<DashboardOverlaysProps> = ({
  theme,
  language,
  t,
  backupReminderActive,
  daysSinceBackup,
  onOpenSettings,
  pwaInstallAvailable,
  onPwaInstall,
  onPwaInstallDismiss,
  importPending,
  onResolveImport,
  isVerifyingVault,
  vaultPassword,
  setVaultPassword,
  vaultError,
  onUnlockVault,
  onCancelVault,
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

    <VaultUnlockModal
      open={isVerifyingVault}
      theme={theme}
      language={language}
      t={t}
      vaultPassword={vaultPassword}
      setVaultPassword={setVaultPassword}
      vaultError={vaultError}
      onUnlock={onUnlockVault}
      onCancel={onCancelVault}
    />
  </>
);
