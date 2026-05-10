import React, { useEffect, useState } from 'react';
import { DiaryEntry, Language, Theme, Attachment, CustomPersona } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { useTransientState } from '../hooks/useTransientState';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { useDashboardSecurity } from '../hooks/useDashboardSecurity';
import { useGuidingStarsEditor } from '../hooks/useGuidingStarsEditor';
import { useDashboardWipeFlow } from '../hooks/useDashboardWipeFlow';
import { canCreateCustomPersona, canCreateMemoir } from '../services/quotaService';
import { SettingsPanel } from './SettingsPanel';
import { PersonaBuilderModal } from './PersonaBuilderModal';
import { MemoirBuilderModal } from './MemoirBuilderModal';

interface DashboardSettingsModalProps {
  // ----- Visibility / shell -----
  showSettings: boolean;
  setShowSettings: (next: boolean) => void;

  // ----- Theme / language -----
  theme: Theme;
  onSetTheme: (next: Theme) => void;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  t: TranslationDictionary;

  // ----- Identity (kept in Dashboard so the header can also display it) -----
  customIdentity: string;
  setCustomIdentity: (next: string) => void;
  dynamicVersion: string;

  // ----- Security primitives (from App / data layer) -----
  passwordHash: string | null;
  passwordSalt: string | null;
  isUnlocked: boolean;
  onSetPassword: (password: string) => void;

  // ----- Data layer -----
  entries: DiaryEntry[];
  activeEntries: DiaryEntry[];
  onBulkUpdateEntries: (entries: DiaryEntry[]) => void;
  onWipeData: () => void;
  onCreateMaterialEntry: (material: Attachment, isArchived: boolean) => void;

  // ----- Stars -----
  guidingStars: string[];
  selectedStars: string[];
  onSaveGuidingStars: (stars: string[]) => void;
  onSaveSelectedStars: (stars: string[]) => void;
  /** Phase 4 §5.1.A — user-created custom 启明星 (Persona Builder). */
  customPersonas: CustomPersona[];
  /** Persist a freshly minted persona. */
  onAddCustomPersona: (persona: CustomPersona) => Promise<void> | void;

  // ----- Backup / scan / sync -----
  isScanning?: boolean;
  scanProgress?: number;
  onTriggerScan?: () => Promise<unknown>;
  lastScanSummary?: {
    status: 'success' | 'error';
    finishedAt: number;
    mergedEntries: number;
    mergedPrinciples: number;
    mergedContainers: number;
    error?: string;
  } | null;

  // ----- Export / import (already wired by Dashboard so header can share) -----
  handleExport: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isExportDropdownOpen: boolean;
  setIsExportDropdownOpen: (open: boolean) => void;
  exportTarget: string;
  setExportTarget: (target: string) => void;
  handleDownloadNotes: (mode: 'all' | string, exportMode?: 'markdown' | 'txt') => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportBackup?: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  importStatus: { kind: 'success' | 'error'; message: string } | null;

  // ----- Animations / shell -----
  handleGoHomeClick: () => void;
  isSailingHome: boolean;

  // ----- Fullscreen control plumbed into useDashboardSecurity for password
  // change cancel-from-fullscreen flow -----
  setIsFullscreen: (next: boolean) => void;

  /**
   * Mirrors `useGuidingStarsEditor.isEditing` upward so FilterBar (a
   * sibling of this modal) can toggle its bottom-border accordingly.
   * Optional because not every host needs the signal.
   */
  onEditingStarsChange?: (editing: boolean) => void;

  /** Phase 4.5 §E — open the cross-device migration EXPORT modal
   *  (anchored on Dashboard so it can read live entries / personas
   *  / memories / letters props). Optional so legacy callers compile. */
  onOpenMigrationExport?: () => void;
  /** Phase 4.5 §E — open the cross-device migration IMPORT wizard.
   *  Anchored at App-level (so the cover screen can also reach
   *  it). Optional so legacy callers compile. */
  onOpenMigrationImport?: () => void;
  /** Phase 4 §4.b-3 — current device's Ed25519 fingerprint, for
   *  display in the Settings migration row. Null when no keypair
   *  exists yet. */
  deviceFingerprint?: string | null;
  /** Phase 4 §4.b-3 — wraps `regenerateDeviceKeypair(password)`. */
  onRegenerateDeviceKeys?: () => Promise<void> | void;
  /** Phase 4 §4.b-3 follow-up (K1) — open the Trusted Devices
   *  audit / revoke panel. */
  onOpenTrustedDevices?: () => void;

  /** Phase 4.5 §E follow-up (L1) — Memoirs picker callbacks.
   *  When set, the SettingsPanel renders a Memoirs management
   *  section with per-memoir Memories / Letters CTAs. */
  onOpenMemoirMemories?: (memoirId: string) => void;
  onOpenMemoirLetters?: (memoirId: string) => void;

  /** Phase 5 §5.1 — license / subscription state passed through
   *  to `SettingsPanel.LicenseSection`. */
  licenseInstallId?: string;
  licenseCurrentTier?: import('../hooks/useLicense').CurrentTier;
  licensePayload?: import('../services/licenseToken').LicensePayload | null;
  licenseFailure?: import('../services/licenseStore').LoadLicenseFailure | null;
  onActivateLicense?: (
    token: string,
  ) => Promise<import('../services/licenseStore').LoadLicenseFailure | null>;
  onDeactivateLicense?: () => Promise<void>;
  /** Phase 5.2 — open the public pricing page from the
   *  LicenseSection card. */
  onOpenPricing?: () => void;
}

/**
 * Owns every Settings-only hook + state and renders `<SettingsPanel>`.
 * Pulled out of Dashboard.tsx as part of Phase 2 §2.h tail.
 *
 * Why this exists rather than props-drilling 50+ values from Dashboard:
 *
 *  1. The four hooks (security / stars editor / wipe / attachment) and
 *     the two transient banners only matter when `showSettings` is true.
 *     Hosting them at the Dashboard level meant the dashboard shell
 *     re-rendered every time any of them ticked. Parking them here
 *     scopes the re-render boundary to the modal subtree.
 *
 *  2. Dashboard.tsx had a 75-line prop block threading these into
 *     SettingsPanel. Lifting the hooks here lets Dashboard pass only
 *     the genuinely-shared inputs (theme / language / data layer
 *     callbacks) and keeps the §2.h ROADMAP target (Dashboard ≤350
 *     LOC) reachable.
 *
 * The bridge does NOT own anything that the dashboard chrome (header /
 * footer / vault content) also needs (e.g. `customIdentity`,
 * `dynamicVersion`, the backup-import confirm modal). Those stay in
 * Dashboard so multiple consumers can share them.
 */
export const DashboardSettingsModal: React.FC<DashboardSettingsModalProps> = ({
  showSettings,
  setShowSettings,
  theme,
  onSetTheme,
  language,
  onSetLanguage,
  t,
  customIdentity,
  setCustomIdentity,
  dynamicVersion,
  passwordHash,
  passwordSalt,
  isUnlocked,
  onSetPassword,
  entries,
  activeEntries,
  onBulkUpdateEntries,
  onWipeData,
  onCreateMaterialEntry,
  guidingStars,
  selectedStars,
  onSaveGuidingStars,
  onSaveSelectedStars,
  customPersonas,
  onAddCustomPersona,
  isScanning,
  scanProgress,
  onTriggerScan,
  lastScanSummary,
  handleExport,
  dropdownRef,
  isExportDropdownOpen,
  setIsExportDropdownOpen,
  exportTarget,
  setExportTarget,
  handleDownloadNotes,
  importInputRef,
  handleImportBackup,
  importStatus,
  handleGoHomeClick,
  isSailingHome,
  setIsFullscreen,
  onEditingStarsChange,
  onOpenMigrationExport,
  onOpenMigrationImport,
  deviceFingerprint,
  onRegenerateDeviceKeys,
  onOpenTrustedDevices,
  onOpenMemoirMemories,
  onOpenMemoirLetters,
  licenseInstallId,
  licenseCurrentTier,
  licensePayload,
  licenseFailure,
  onActivateLicense,
  onDeactivateLicense,
  onOpenPricing,
}) => {
  const [isViewingRecovery, setIsViewingRecovery] = useState(false);
  const [stagedMaterial, setStagedMaterial] = useState<Attachment | null>(null);

  // Phase 4 §5.1.A — Persona Builder modal toggle. Living here (not
  // in `useGuidingStarsEditor`) because the modal sits as a sibling
  // overlay to SettingsPanel, not inside the star editor.
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);
  const personaPaywall = canCreateCustomPersona(customPersonas);

  // Phase 4 §5.1.B — Memoir Builder modal toggle. Mirrors the
  // Persona Builder shape so users perceive the two surfaces as
  // parallel-but-distinct (different paywall verdict, different
  // post-create persistence path on the backend, but identical
  // open/close UX).
  const [showMemoirBuilder, setShowMemoirBuilder] = useState(false);
  const memoirPaywall = canCreateMemoir(customPersonas);

  const {
    value: mediaError,
    setValue: setMediaError,
    showValue: showMediaError,
  } = useTransientState<string | null>(null);
  const {
    value: mediaSuccess,
    setValue: setMediaSuccess,
    showValue: showMediaSuccess,
  } = useTransientState<string | null>(null);

  const {
    securityMode,
    setSecurityMode,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    securityError,
    securitySuccess,
    handleSecuritySetup,
    showError: showSecurityError,
  } = useDashboardSecurity({
    passwordHash,
    passwordSalt,
    entries,
    onSetPassword,
    onBulkUpdateEntries,
    copy: {
      passwordRequirement: t.passwordRequirement,
      passwordMismatch: t.passwordMismatch,
      passwordVerifyFailed: t.passwordVerifyFailed,
      passwordChangeSuccess: t.passwordChangeSuccess,
      reEncryptFailureWarning: (n) =>
        `WARNING: ${n} entries could not be decrypted with your current password. Changing the master password now will lock these entries permanently with the old keys. Continue?`,
    },
    setIsFullscreen,
  });

  // Phase 4 §5.1.A — fold AI-generated custom persona names into the
  // editor's `guidingStars` directory so they render alongside
  // free-text custom names + built-in stars. The editor itself is
  // unchanged; this is a pre-merge convenience.
  const guidingStarsWithPersonas = React.useMemo(
    () => Array.from(new Set([...guidingStars, ...customPersonas.map((p) => p.name)])),
    [guidingStars, customPersonas],
  );

  const {
    isEditing: isEditingStars,
    setIsEditing: setIsEditingStars,
    tempDirectory,
    tempSelected,
    customStarName,
    setCustomStarName,
    toggleTempStar,
    handleDeleteCustomStar,
    handleAddCustomStar,
    handleSaveStars,
  } = useGuidingStarsEditor({
    guidingStars: guidingStarsWithPersonas,
    selectedStars,
    language,
    showSettings,
    limitMessage: t.guidingStarsLimit,
    onLimitExceeded: showSecurityError,
    onSaveGuidingStars,
    onSaveSelectedStars,
  });

  const { wipeMode, setWipeMode, wipeInput, setWipeInput, handleWipeConfirm } =
    useDashboardWipeFlow({
      onWipeData,
      onAfterWipe: () => setShowSettings(false),
    });

  const {
    inputRef: mediaInputRef,
    isUploading,
    handleChange: handleMediaUpload,
  } = useAttachmentUpload({
    onTooLarge: () => {
      setMediaError(null);
      showMediaError(t.fileTooLarge);
    },
    onLargeWarning: () =>
      showMediaSuccess(t.fileLargeWarning ?? 'Large attachment may slow saves and backups.'),
    onReadError: () => showMediaError(t.uploadError),
    onStaged: (attachment) => {
      setMediaError(null);
      setStagedMaterial(attachment);
    },
  });

  void wipeMode; // tracked by SettingsPanel via setWipeMode for symmetry; kept stable for future surfacing.

  useEffect(() => {
    onEditingStarsChange?.(isEditingStars);
  }, [isEditingStars, onEditingStarsChange]);

  return (
    <>
      <SettingsPanel
        theme={theme}
        language={language}
        onSetLanguage={onSetLanguage}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        isViewingRecovery={isViewingRecovery}
        setIsViewingRecovery={setIsViewingRecovery}
        securityMode={securityMode}
        setSecurityMode={setSecurityMode}
        passwordHash={passwordHash}
        customIdentity={customIdentity}
        setCustomIdentity={setCustomIdentity}
        dynamicVersion={dynamicVersion}
        isUnlocked={isUnlocked}
        onSetTheme={onSetTheme}
        oldPassword={oldPassword}
        setOldPassword={setOldPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        securityError={securityError}
        securitySuccess={securitySuccess}
        handleSecuritySetup={handleSecuritySetup}
        isEditingStars={isEditingStars}
        setIsEditingStars={setIsEditingStars}
        tempDirectory={tempDirectory}
        tempSelected={tempSelected}
        customStarName={customStarName}
        setCustomStarName={setCustomStarName}
        toggleTempStar={toggleTempStar}
        handleDeleteCustomStar={handleDeleteCustomStar}
        handleAddCustomStar={handleAddCustomStar}
        handleSaveStars={handleSaveStars}
        selectedStars={selectedStars}
        onOpenPersonaBuilder={() => setShowPersonaBuilder(true)}
        onOpenMemoirBuilder={() => setShowMemoirBuilder(true)}
        mediaInputRef={mediaInputRef}
        handleMediaUpload={handleMediaUpload}
        isUploading={isUploading}
        stagedMaterial={stagedMaterial}
        setStagedMaterial={setStagedMaterial}
        onCreateMaterialEntry={onCreateMaterialEntry}
        setMediaSuccess={(message) => {
          if (message === null) {
            setMediaSuccess(null);
            return;
          }
          showMediaSuccess(message);
        }}
        mediaError={mediaError}
        mediaSuccess={mediaSuccess}
        activeEntries={activeEntries}
        handleExport={handleExport}
        dropdownRef={dropdownRef}
        isExportDropdownOpen={isExportDropdownOpen}
        setIsExportDropdownOpen={setIsExportDropdownOpen}
        exportTarget={exportTarget}
        setExportTarget={setExportTarget}
        handleDownloadNotes={handleDownloadNotes}
        entries={entries}
        importInputRef={importInputRef}
        handleImportBackup={handleImportBackup}
        importStatus={importStatus}
        wipeInput={wipeInput}
        setWipeInput={setWipeInput}
        handleWipeConfirm={handleWipeConfirm}
        setWipeMode={setWipeMode}
        handleGoHomeClick={handleGoHomeClick}
        isSailingHome={isSailingHome}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onTriggerScan={onTriggerScan}
        lastScanSummary={lastScanSummary}
        onOpenMigrationExport={onOpenMigrationExport}
        onOpenMigrationImport={onOpenMigrationImport}
        deviceFingerprint={deviceFingerprint}
        onRegenerateDeviceKeys={onRegenerateDeviceKeys}
        onOpenTrustedDevices={onOpenTrustedDevices}
        customPersonas={customPersonas}
        onOpenMemoirMemories={onOpenMemoirMemories}
        onOpenMemoirLetters={onOpenMemoirLetters}
        licenseInstallId={licenseInstallId}
        licenseCurrentTier={licenseCurrentTier}
        licensePayload={licensePayload}
        licenseFailure={licenseFailure}
        onActivateLicense={onActivateLicense}
        onDeactivateLicense={onDeactivateLicense}
        onOpenPricing={onOpenPricing}
      />
      <PersonaBuilderModal
        open={showPersonaBuilder}
        onClose={() => setShowPersonaBuilder(false)}
        theme={theme}
        language={language}
        t={t}
        paywallVerdict={personaPaywall}
        onPersonaCreated={async (persona) => {
          await onAddCustomPersona(persona);
        }}
      />
      <MemoirBuilderModal
        open={showMemoirBuilder}
        onClose={() => setShowMemoirBuilder(false)}
        theme={theme}
        language={language}
        t={t}
        paywallVerdict={memoirPaywall}
        onMemoirCreated={async (memoir) => {
          // Memoirs are persisted on the same `customPersonas` list
          // (with `kind === 'memoir'`) — `useCustomPersonas` is the
          // single source of truth for both surfaces. This keeps
          // backup serialisation and Settings rendering symmetric.
          await onAddCustomPersona(memoir);
        }}
      />
    </>
  );
};
