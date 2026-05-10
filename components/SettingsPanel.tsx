import React from 'react';
import { Anchor, X } from 'lucide-react';
import { Language, Theme, DiaryEntry, Attachment } from '../types';
import { TRANSLATIONS } from '../constants';
import { StatisticsWidget } from './StatisticsWidget';
import { SettingsRecoveryView } from './SettingsRecoveryView';
import { SettingsSecurityForm } from './SettingsSecurityForm';
import { SettingsGuidingStarsSection } from './SettingsGuidingStarsSection';
import { SettingsMaterialSection } from './SettingsMaterialSection';
import { SettingsScanRepair } from './SettingsScanRepair';
import { SettingsBackupSection } from './SettingsBackupSection';
import { SettingsWipeSection } from './SettingsWipeSection';
import { FingerprintQr } from './FingerprintQr';
import { MemoirsPickerSection } from './MemoirsPickerSection';
import { LicenseSection } from './LicenseSection';
import type { CurrentTier } from '../hooks/useLicense';
import type { LicensePayload } from '../services/licenseToken';
import type { LoadLicenseFailure } from '../services/licenseStore';

interface SettingsPanelProps {
  theme: Theme;
  language: Language;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  isViewingRecovery: boolean;
  setIsViewingRecovery: (v: boolean) => void;
  securityMode: 'idle' | 'setup' | 'confirm';
  setSecurityMode: (mode: 'idle' | 'setup' | 'confirm') => void;
  passwordHash: string | null;
  customIdentity: string;
  setCustomIdentity: (ident: string) => void;
  dynamicVersion: string;
  isUnlocked: boolean;
  onSetTheme: (theme: Theme) => void;
  onSetLanguage: (lang: Language) => void;

  // Security setup
  oldPassword: string;
  setOldPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  securityError: string | null;
  securitySuccess: string | null;
  handleSecuritySetup: () => void;

  // Stars
  isEditingStars: boolean;
  setIsEditingStars: (v: boolean) => void;
  tempDirectory: string[];
  tempSelected: string[];
  customStarName: string;
  setCustomStarName: (v: string) => void;
  toggleTempStar: (s: string) => void;
  handleDeleteCustomStar: (s: string) => void;
  handleAddCustomStar: () => void;
  handleSaveStars: () => void;
  selectedStars: string[];
  /** Phase 4 §5.1.A — handler for the "AI 启明星" CTA inside the
   *  star editor. Optional so legacy callers compile without
   *  modification. */
  onOpenPersonaBuilder?: () => void;
  /** Phase 4 §5.1.B — handler for the "心象 (Memoir)" CTA inside the
   *  star editor. Optional. */
  onOpenMemoirBuilder?: () => void;

  // Material / staged upload
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  stagedMaterial: Attachment | null;
  setStagedMaterial: (a: Attachment | null) => void;
  onCreateMaterialEntry: (a: Attachment, isArchived: boolean) => void;
  setMediaSuccess: (m: string | null) => void;
  mediaError: string | null;
  mediaSuccess: string | null;

  // Backup export / import
  activeEntries: DiaryEntry[];
  handleExport: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isExportDropdownOpen: boolean;
  setIsExportDropdownOpen: (v: boolean) => void;
  exportTarget: string;
  setExportTarget: (t: string) => void;
  handleDownloadNotes: (mode: string) => void;
  entries: DiaryEntry[];
  importInputRef?: React.RefObject<HTMLInputElement | null>;
  handleImportBackup?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importStatus?: { kind: 'success' | 'error'; message: string } | null;

  // Wipe
  wipeInput: string;
  setWipeInput: (v: string) => void;
  handleWipeConfirm: () => void;
  setWipeMode: (v: boolean) => void;

  // Footer quote (carried for backwards compatibility — currently unused
  // here; the dashboard renders its own DashboardFooter independently).
  handleGoHomeClick: () => void;
  isSailingHome: boolean;

  // Scanning
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

  /** Phase 4.5 §E — open the cross-device migration EXPORT modal
   *  (mounted on Dashboard so it can read live entries / personas
   *  / memories / letters). Optional. */
  onOpenMigrationExport?: () => void;
  /** Phase 4.5 §E — open the cross-device migration IMPORT wizard
   *  (mounted on App). Optional. */
  onOpenMigrationImport?: () => void;

  /** Phase 4 §4.b-3 — current device fingerprint (16-char string
   *  like `ABCD-EFGH-IJKL-MNOP`). When null, no keypair has been
   *  generated yet (pre-§4.b-3 install / wiped). Surfaced in the
   *  Settings migration row so users can read it on their source
   *  device when the target wizard asks "is this your device?". */
  deviceFingerprint?: string | null;
  /** Phase 4 §4.b-3 — when set, the modal exposes a "Regenerate
   *  device keys" CTA. Wraps `regenerateDeviceKeypair(password)`
   *  on the App layer. */
  onRegenerateDeviceKeys?: () => Promise<void> | void;

  /** Phase 4 §4.b-3 follow-up (K1) — open the Trusted Devices
   *  panel for revoke / relabel. Optional: hidden when the
   *  callback is omitted (legacy storybook stories etc.). */
  onOpenTrustedDevices?: () => void;

  /** Phase 4.5 §E follow-up (L1) — full custom-persona list (the
   *  picker section filters down to `kind === 'memoir'`). When
   *  omitted, the picker section is hidden. */
  customPersonas?: import('../types').CustomPersona[];
  /** Phase 4.5 §E follow-up (L1) — open the Memory Management
   *  panel (Phase 4 W3 + F2 cascade) for the picked memoir id. */
  onOpenMemoirMemories?: (memoirId: string) => void;
  /** Phase 4.5 §E follow-up (L1) — open the Letter History panel
   *  (Phase 4.5 F1) for the picked memoir id. */
  onOpenMemoirLetters?: (memoirId: string) => void;

  /** Phase 5 §5.1 — license / subscription state, plumbed from
   *  `useLicense`. When ALL three of `licenseInstallId` /
   *  `onActivateLicense` / `onDeactivateLicense` are wired the
   *  Settings drawer renders the `LicenseSection`. */
  licenseInstallId?: string;
  licenseCurrentTier?: CurrentTier;
  licensePayload?: LicensePayload | null;
  licenseFailure?: LoadLicenseFailure | null;
  onActivateLicense?: (token: string) => Promise<LoadLicenseFailure | null>;
  onDeactivateLicense?: () => Promise<void>;
  /** Phase 5.2 — open the public pricing page from the
   *  LicenseSection card. */
  onOpenPricing?: () => void;
}

/**
 * The Settings drawer — a modal-shaped overlay that hosts identity,
 * security, guiding stars, storage, scan, backup and wipe-data flows.
 *
 * Phase 2 §2.j broke the original ~990-line monolithic component into
 * seven focused sub-components (`Settings*Section` / `Settings*View` /
 * `Settings*Form`). This file now only:
 *
 *   1. Owns the modal frame (overlay + close button + scroll container).
 *   2. Routes between the three top-level branches: recovery view,
 *      security form, default tab.
 *   3. Wires the dashboard-supplied props through to each sub-component.
 *
 * The default branch composes (in order): StatisticsWidget,
 * SettingsGuidingStarsSection, SettingsMaterialSection,
 * SettingsScanRepair, SettingsBackupSection, SettingsWipeSection.
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const t = TRANSLATIONS[props.language];
  if (!props.showSettings) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300 p-4 ${props.theme === 'light' ? 'bg-vector-ink-strong/20' : 'bg-black/90'}`}
    >
      <div
        className={`border w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[92vh] rounded-2xl md:rounded-[24px] ${props.theme === 'light' ? 'bg-vector-paper-white border-slate-200 shadow-[0_20px_50px_color-mix(in_srgb,_black_10%,_transparent)]' : 'bg-vector-night-navy border-cyan-950/50 shadow-2xl'}`}
      >
        <div
          className={`flex justify-between items-center p-4 sm:p-6 border-b shrink-0 ${props.theme === 'light' ? 'border-slate-100' : 'border-cyan-900/20'}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${props.theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-950/30 text-cyan-400'}`}
            >
              <Anchor className="w-5 h-5" />
            </div>
            <h3
              className={`text-xl font-bold tracking-tight ${props.theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
            >
              {t.navigationLog}
            </h3>
          </div>
          <button
            onClick={() => props.setShowSettings(false)}
            aria-label={t.cancel}
            className={`${props.theme === 'light' ? 'text-slate-300 hover:text-slate-600' : 'text-cyan-900 hover:text-cyan-400'} transition-all hover:rotate-90 duration-300`}
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-95">
          <input
            type="file"
            ref={props.mediaInputRef}
            className="hidden"
            onChange={props.handleMediaUpload}
            accept="image/*,video/*,audio/*,application/pdf"
            aria-label={t.loadSupply}
          />

          {props.isViewingRecovery ? (
            <SettingsRecoveryView
              theme={props.theme}
              language={props.language}
              t={t}
              onBack={() => props.setIsViewingRecovery(false)}
            />
          ) : props.securityMode !== 'idle' ? (
            <SettingsSecurityForm
              theme={props.theme}
              t={t}
              passwordHash={props.passwordHash}
              oldPassword={props.oldPassword}
              setOldPassword={props.setOldPassword}
              newPassword={props.newPassword}
              setNewPassword={props.setNewPassword}
              confirmPassword={props.confirmPassword}
              setConfirmPassword={props.setConfirmPassword}
              securityError={props.securityError}
              securitySuccess={props.securitySuccess}
              onCancel={() => props.setSecurityMode('idle')}
              onSubmit={props.handleSecuritySetup}
            />
          ) : (
            <>
              <StatisticsWidget
                theme={props.theme}
                language={props.language}
                onSetLanguage={props.onSetLanguage}
                customIdentity={props.customIdentity}
                setCustomIdentity={props.setCustomIdentity}
                dynamicVersion={props.dynamicVersion}
                isUnlocked={props.isUnlocked}
                onSetTheme={props.onSetTheme}
                setSecurityMode={props.setSecurityMode}
                setIsViewingRecovery={props.setIsViewingRecovery}
                passwordHash={props.passwordHash}
              />

              <SettingsGuidingStarsSection
                theme={props.theme}
                language={props.language}
                t={t}
                selectedStars={props.selectedStars}
                isEditing={props.isEditingStars}
                setIsEditing={props.setIsEditingStars}
                tempDirectory={props.tempDirectory}
                tempSelected={props.tempSelected}
                customStarName={props.customStarName}
                setCustomStarName={props.setCustomStarName}
                onToggleStar={props.toggleTempStar}
                onDeleteCustomStar={props.handleDeleteCustomStar}
                onAddCustomStar={props.handleAddCustomStar}
                onSave={props.handleSaveStars}
                onOpenPersonaBuilder={props.onOpenPersonaBuilder}
                onOpenMemoirBuilder={props.onOpenMemoirBuilder}
              />

              <SettingsMaterialSection
                theme={props.theme}
                t={t}
                mediaInputRef={props.mediaInputRef}
                isUploading={props.isUploading}
                stagedMaterial={props.stagedMaterial}
                setStagedMaterial={props.setStagedMaterial}
                onCreateMaterialEntry={props.onCreateMaterialEntry}
                onMaterialSaved={() => props.setMediaSuccess(t.materialSaved)}
                mediaError={props.mediaError}
                mediaSuccess={props.mediaSuccess}
              />

              <div className="space-y-6">
                <SettingsScanRepair
                  theme={props.theme}
                  language={props.language}
                  t={t}
                  isScanning={props.isScanning}
                  scanProgress={props.scanProgress}
                  lastScanSummary={props.lastScanSummary}
                  onTriggerScan={props.onTriggerScan}
                />

                <SettingsBackupSection
                  theme={props.theme}
                  t={t}
                  onExport={props.handleExport}
                  onDownloadNotes={props.handleDownloadNotes}
                  exportTarget={props.exportTarget}
                  setExportTarget={props.setExportTarget}
                  isExportDropdownOpen={props.isExportDropdownOpen}
                  setIsExportDropdownOpen={props.setIsExportDropdownOpen}
                  dropdownRef={props.dropdownRef}
                  entries={props.entries}
                  importInputRef={props.importInputRef}
                  onImportBackup={props.handleImportBackup}
                  importStatus={props.importStatus}
                />

                {/* Phase 4.5 §E — cross-device migration entries.
                    Two thin CTAs sit between Backup and Wipe so the
                    user reads them as "Move device-to-device" rather
                    than as a backup variant. The buttons are
                    skipped when the consumer didn't pass the
                    callbacks (legacy hosts / storybook). */}
                {(props.onOpenMigrationExport || props.onOpenMigrationImport) && (
                  <div
                    className={`flex flex-col gap-2 border rounded-lg p-3 ${props.theme === 'light' ? 'bg-amber-50/40 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'}`}
                    data-testid="settings-migration-row"
                  >
                    <p
                      className={`text-[11px] font-bold uppercase tracking-widest ${props.theme === 'light' ? 'text-amber-900/80' : 'text-amber-200/80'}`}
                    >
                      {(t.migrationSettingsTitle as string) ?? 'Cross-device migration'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {props.onOpenMigrationExport && (
                        <button
                          type="button"
                          onClick={props.onOpenMigrationExport}
                          className={`text-[11px] px-3 py-2 rounded-md border transition-colors ${props.theme === 'light' ? 'bg-white border-amber-200 hover:border-amber-300 text-amber-900' : 'bg-vector-night-deep/40 border-amber-500/30 hover:border-amber-500/50 text-amber-200'}`}
                          data-testid="settings-migration-export-cta"
                        >
                          {(t.migrationExportTitle as string) ?? 'Migrate to a new device'}
                        </button>
                      )}
                      {props.onOpenMigrationImport && (
                        <button
                          type="button"
                          onClick={props.onOpenMigrationImport}
                          className={`text-[11px] px-3 py-2 rounded-md border transition-colors ${props.theme === 'light' ? 'bg-white border-amber-200 hover:border-amber-300 text-amber-900' : 'bg-vector-night-deep/40 border-amber-500/30 hover:border-amber-500/50 text-amber-200'}`}
                          data-testid="settings-migration-import-cta"
                        >
                          {(t.migrationImportTitle as string) ?? 'Migrate from another device'}
                        </button>
                      )}
                    </div>
                    {/* Phase 4 §4.b-3 — device fingerprint chip */}
                    {props.deviceFingerprint && (
                      <div
                        className={`mt-1 pt-2 border-t ${props.theme === 'light' ? 'border-amber-200' : 'border-amber-500/20'}`}
                        data-testid="settings-device-fingerprint"
                      >
                        <p
                          className={`text-[10px] uppercase tracking-widest mb-1 ${props.theme === 'light' ? 'text-amber-900/60' : 'text-amber-200/60'}`}
                        >
                          {(t.deviceFingerprintLabel as string) ?? 'This device fingerprint'}
                        </p>
                        <div className="flex items-center gap-3">
                          <p
                            className={`flex-1 text-xs font-mono font-bold tracking-[0.25em] ${props.theme === 'light' ? 'text-amber-900' : 'text-amber-200'}`}
                          >
                            {props.deviceFingerprint}
                          </p>
                          {/* K2 — QR for one-glance scan from another device. */}
                          <FingerprintQr
                            fingerprint={props.deviceFingerprint}
                            size={80}
                            ariaLabel={
                              (t.fingerprintQrAria as string | undefined)?.replace(
                                '{fingerprint}',
                                props.deviceFingerprint,
                              ) ?? `QR of fingerprint ${props.deviceFingerprint}`
                            }
                            className={
                              props.theme === 'light' ? 'text-amber-900' : 'text-amber-200'
                            }
                          />
                        </div>
                        <p
                          className={`text-[10px] mt-1 ${props.theme === 'light' ? 'text-amber-900/60' : 'text-amber-200/60'}`}
                        >
                          {(t.deviceFingerprintHint as string) ??
                            'Read this on your other device when the migration wizard asks to confirm the source.'}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {props.onRegenerateDeviceKeys && (
                            <button
                              type="button"
                              onClick={() => void props.onRegenerateDeviceKeys?.()}
                              className={`text-[10px] underline-offset-4 hover:underline ${props.theme === 'light' ? 'text-amber-900/60 hover:text-amber-900' : 'text-amber-200/60 hover:text-amber-200'}`}
                              data-testid="settings-regenerate-device-keys"
                            >
                              {(t.regenerateDeviceKeys as string) ?? 'Regenerate device keys'}
                            </button>
                          )}
                          {props.onOpenTrustedDevices && (
                            <button
                              type="button"
                              onClick={() => props.onOpenTrustedDevices?.()}
                              className={`text-[10px] underline-offset-4 hover:underline ${props.theme === 'light' ? 'text-amber-900/60 hover:text-amber-900' : 'text-amber-200/60 hover:text-amber-200'}`}
                              data-testid="settings-open-trusted-devices"
                              aria-label={
                                (t.trustedDevicesOpenAria as string) ?? 'Open trusted devices list'
                              }
                            >
                              {(t.trustedDevicesOpenLabel as string) ?? 'Trusted devices'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 4.5 §E follow-up (L1) — Memoirs picker.
                    Only renders when both callbacks are wired AND
                    the persona list contains at least one memoir.
                    The section itself returns null when the
                    filter yields zero rows, so we don't have to
                    duplicate the no-memoir guard here. */}
                {props.customPersonas &&
                  props.onOpenMemoirMemories &&
                  props.onOpenMemoirLetters && (
                    <MemoirsPickerSection
                      theme={props.theme}
                      t={t}
                      personas={props.customPersonas}
                      onOpenMemories={props.onOpenMemoirMemories}
                      onOpenLetters={props.onOpenMemoirLetters}
                    />
                  )}

                {/* Phase 5 §5.1 — license / subscription card. */}
                {props.licenseInstallId && props.onActivateLicense && props.onDeactivateLicense && (
                  <LicenseSection
                    theme={props.theme}
                    t={t}
                    installId={props.licenseInstallId}
                    currentTier={props.licenseCurrentTier ?? 'free'}
                    payload={props.licensePayload ?? null}
                    failure={props.licenseFailure ?? null}
                    onActivate={props.onActivateLicense}
                    onDeactivate={props.onDeactivateLicense}
                    onOpenPricing={props.onOpenPricing}
                  />
                )}

                <SettingsWipeSection
                  theme={props.theme}
                  t={t}
                  wipeInput={props.wipeInput}
                  setWipeInput={props.setWipeInput}
                  onConfirmWipe={props.handleWipeConfirm}
                  onCancel={() => {
                    props.setWipeMode(false);
                    props.setWipeInput('');
                    props.setShowSettings(false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
