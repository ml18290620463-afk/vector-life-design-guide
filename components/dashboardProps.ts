import type {
  Attachment,
  Container,
  DiaryEntry,
  Language,
  Theme,
} from '../types';

/**
 * Public input contract for `<Dashboard>`. Lifted out of the component
 * file as part of Phase 2 §2.l so the dashboard's body stays focused on
 * composition rather than 45 lines of prop typing.
 *
 * Keep this file dependency-free of any React internals so it can be
 * imported by tests, mocks and the eventual `DashboardShell` view
 * without dragging the dashboard module graph along.
 */
export interface DashboardProps {
  entries: DiaryEntry[];
  currentUser: string | null;
  isGuest: boolean;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  onUpdateEntry: (entry: DiaryEntry) => void;
  onBulkUpdateEntries: (entries: DiaryEntry[]) => void;
  onReplayIntro: () => void;
  onWipeData: () => void;
  onCreateMaterialEntry: (material: Attachment, isArchived: boolean) => void;
  isUnlocked: boolean;
  passwordHash: string | null;
  passwordSalt: string | null;
  onSetPassword: (password: string) => void;
  onClearPassword: () => void;
  onImportBackup?: (
    entries: DiaryEntry[],
    mode: 'merge' | 'replace',
  ) => Promise<{ importedCount: number; totalAfter: number; mode: 'merge' | 'replace' }>;
  guidingStars: string[];
  onSaveGuidingStars: (stars: string[]) => void;
  selectedStars: string[];
  onSaveSelectedStars: (stars: string[]) => void;
  /** Phase 5 §5.1 — license / subscription state passed from
   *  `useLicense`. Plumbed through to `SettingsPanel.LicenseSection`. */
  licenseInstallId?: string;
  licenseCurrentTier?: import('../hooks/useLicense').CurrentTier;
  licensePayload?: import('../services/licenseToken').LicensePayload | null;
  licenseFailure?: import('../services/licenseStore').LoadLicenseFailure | null;
  onActivateLicense?: (
    token: string,
  ) => Promise<import('../services/licenseStore').LoadLicenseFailure | null>;
  onDeactivateLicense?: () => Promise<void>;
  /** Phase 5.2 — open the public pricing page. Hidden when the
   *  callback isn't wired. */
  onOpenPricing?: () => void;
  containers: Container[];
  onAddContainer: (name: string) => void;
  onDeleteContainer: (id: string) => void;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
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
  syncStatus?: 'synced' | 'local-only' | 'error' | 'merging' | 'mirror-skipped';
  loading: boolean;
  /** Preview/deep-link helper: open the settings surface on first render. */
  startInSettings?: boolean;
}
