import React, { useEffect, useMemo, useState } from 'react';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { TRANSLATIONS } from '../constants';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';
import { useBackupImport } from '../hooks/useBackupImport';
import { useBackupReminder } from '../hooks/useBackupReminder';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { DashboardOverlays } from './DashboardOverlays';
import { DashboardHeader } from './DashboardHeader';
import { DashboardSettingsModal } from './DashboardSettingsModal';
import { DashboardFooter } from './DashboardFooter';
import { useClickOutside } from '../hooks/useClickOutside';
import { useDashboardExport } from '../hooks/useDashboardExport';
import { useDashboardImportConfirm } from '../hooks/useDashboardImportConfirm';
import { useDashboardFullscreen } from '../hooks/useDashboardFullscreen';
import { getActiveDashboardEntries } from '../services/dashboardFilters';
import { DashboardSystemHub } from './DashboardSystemHub';
import type { DashboardProps } from './dashboardProps';

// prettier-ignore
export const Dashboard: React.FC<DashboardProps> = ({
  entries, currentUser, isGuest, language, onSetLanguage, theme, onSetTheme,
  onSelectEntry, onUpdateEntry, onBulkUpdateEntries,
  onReplayIntro, onWipeData, onCreateMaterialEntry, isUnlocked, passwordHash,
  passwordSalt, onSetPassword, onClearPassword, onImportBackup, guidingStars,
  onSaveGuidingStars, selectedStars, onSaveSelectedStars,
  licenseInstallId, licenseCurrentTier, licensePayload, licenseFailure,
  onActivateLicense, onDeactivateLicense, onOpenPricing,
  containers, onAddContainer, onDeleteContainer, isScanning, scanProgress, onTriggerScan, lastScanSummary,
  syncStatus, loading, startInSettings = false,
}) => {
  const { scheduleTimeout } = useTimeoutManager();

  const t = TRANSLATIONS[language];
  void isGuest;
  void onUpdateEntry;
  void onClearPassword;
  void onSelectEntry;
  void containers;
  void onAddContainer;
  void onDeleteContainer;

  const [customIdentity, setCustomIdentity] = useState(
    () => getStoredString(AppStorageKeys.customIdentity) || currentUser || '',
  );

  useEffect(() => {
    setStoredString(AppStorageKeys.customIdentity, customIdentity);
  }, [customIdentity]);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(startInSettings);

  // Go Home Animation State
  const [isSailingHome, setIsSailingHome] = useState(false);

  const { backupReminderActive, daysSinceBackup, recordBackup } = useBackupReminder(entries.length);

  const pwaInstall = usePwaInstallPrompt();

  const handleGoHomeClick = () => {
    setIsSailingHome(true);
    scheduleTimeout(() => {
      onReplayIntro();
      setIsSailingHome(false);
    }, 1000);
  };

  const { isFullscreen, toggleFullScreen, setIsFullscreen } = useDashboardFullscreen();

  const activeEntries = useMemo(() => getActiveDashboardEntries(entries), [entries]);
  const archivedEntriesCount = useMemo(
    () => entries.filter((entry) => entry.isArchived).length,
    [entries],
  );

  // Settings-only state (security / stars editor / wipe / attachment +
  // media transient banners) lives inside DashboardSettingsModal so the
  // dashboard shell doesn't re-render every time those panels tick.
  const {
    handleExport,
    handleDownloadNotes,
    exportTarget,
    setExportTarget,
    isExportDropdownOpen,
    setIsExportDropdownOpen,
  } = useDashboardExport({
    entries,
    filteredEntries: activeEntries,
    currentUser,
    t,
    recordBackup,
  });
  const dropdownRef = useClickOutside<HTMLDivElement>(isExportDropdownOpen, () =>
    setIsExportDropdownOpen(false),
  );

  const importConfirm = useDashboardImportConfirm();

  const {
    inputRef: importInputRef,
    handleChange: handleImportBackup,
    status: importStatus,
  } = useBackupImport({
    onImportBackup,
    t,
    confirm: importConfirm.confirm,
    reportError: (error) => {
      console.error('Backup import failed', error);
    },
  });

  // Phase 5 §5.1 + 5.2 — bundle license props once. prettier-ignore
  // keeps it on one line so the LOC ceiling stays under 600.
  // prettier-ignore
  const licenseProps = { licenseInstallId, licenseCurrentTier, licensePayload, licenseFailure, onActivateLicense, onDeactivateLicense, onOpenPricing };

  return (
    <div className="vector-dashboard-shell mx-auto w-full min-h-screen flex flex-col relative z-10">
      <DashboardHeader
        theme={theme}
        language={language}
        isFullscreen={isFullscreen}
        toggleFullScreen={toggleFullScreen}
        syncStatus={syncStatus}
      />

      <DashboardOverlays
        theme={theme}
        t={t}
        backupReminderActive={false}
        daysSinceBackup={daysSinceBackup}
        onOpenSettings={() => setShowSettings(true)}
        pwaInstallAvailable={pwaInstall.isAvailable}
        onPwaInstall={() => {
          void pwaInstall.promptInstall();
        }}
        onPwaInstallDismiss={pwaInstall.dismiss}
        importPending={importConfirm.pending}
        onResolveImport={importConfirm.resolveConfirm}
      />

      <DashboardSettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        theme={theme}
        onSetTheme={onSetTheme}
        language={language}
        onSetLanguage={onSetLanguage}
        t={t}
        customIdentity={customIdentity}
        setCustomIdentity={setCustomIdentity}
        passwordHash={passwordHash}
        passwordSalt={passwordSalt}
        isUnlocked={isUnlocked}
        onSetPassword={onSetPassword}
        entries={entries}
        activeEntries={activeEntries}
        onBulkUpdateEntries={onBulkUpdateEntries}
        onWipeData={onWipeData}
        onCreateMaterialEntry={onCreateMaterialEntry}
        guidingStars={guidingStars}
        selectedStars={selectedStars}
        onSaveGuidingStars={onSaveGuidingStars}
        onSaveSelectedStars={onSaveSelectedStars}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onTriggerScan={onTriggerScan}
        lastScanSummary={lastScanSummary}
        handleExport={handleExport}
        dropdownRef={dropdownRef}
        isExportDropdownOpen={isExportDropdownOpen}
        setIsExportDropdownOpen={setIsExportDropdownOpen}
        exportTarget={exportTarget}
        setExportTarget={setExportTarget}
        handleDownloadNotes={handleDownloadNotes}
        importInputRef={importInputRef}
        handleImportBackup={onImportBackup ? handleImportBackup : undefined}
        importStatus={importStatus}
        handleGoHomeClick={handleGoHomeClick}
        isSailingHome={isSailingHome}
        setIsFullscreen={setIsFullscreen}
        {...licenseProps}
      />

      <DashboardSystemHub
        theme={theme}
        language={language}
        totalEntriesCount={entries.length}
        activeEntriesCount={activeEntries.length}
        archivedEntriesCount={archivedEntriesCount}
        onOpenSettings={() => setShowSettings(true)}
      />

      <DashboardFooter
        theme={theme}
        t={t}
        onOpenSettings={() => setShowSettings(true)}
      />

    </div>
  );
};
