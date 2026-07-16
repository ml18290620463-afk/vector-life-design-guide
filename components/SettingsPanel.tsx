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
