import type {
  Attachment,
  Container,
  CustomPersona,
  DiaryEntry,
  Language,
  Memory,
  PendingLetter,
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
  onNewEntry: () => void;
  onOpenArchive: () => void;
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
  /** Phase 4 §5.1.A — user-created custom 启明星. Empty array on Free
   *  tier (the Persona Builder paywall blocks creation; existing
   *  paid-tier personas still surface here when users downgrade). */
  customPersonas: CustomPersona[];
  /** Persist a freshly minted persona (Persona Builder hands its
   *  output here once the user confirms the preview). */
  onAddCustomPersona: (persona: CustomPersona) => Promise<void> | void;
  /** Phase 4 §5.1.A — bulk replace custom 启明星. Used by the v3
   *  backup importer to restore the user's persona library on a
   *  fresh device. Optional so legacy callers keep compiling. */
  onReplaceCustomPersonas?: (personas: CustomPersona[]) => Promise<void> | void;
  /** Phase 4 §5.1.B — Memoir long-term memories. Bundled into the
   *  v3 backup payload by `useDashboardExport`. Optional so legacy
   *  callers compile. */
  memories?: Memory[];
  /** Phase 4 §5.1.B — bulk replace Memoir memories on backup
   *  restore. Optional so legacy callers compile. */
  onReplaceMemories?: (memories: Memory[]) => Promise<void> | void;
  /** Phase 4.5 §E — pending Memoir letters, surfaced into the
   *  Settings panel so the migration export can pack them. */
  pendingLetters?: PendingLetter[];
  /** Phase 4.5 §E — bulk replace pending Memoir letters. Used by
   *  the migration import wizard. Optional so legacy callers compile. */
  onReplaceLetters?: (letters: PendingLetter[]) => Promise<void> | void;
  /** Phase 4.5 §E — opens the cross-device migration import wizard
   *  from inside Settings (the App-level wizard mount listens for
   *  this). Optional so legacy callers compile. */
  onOpenMigrationImport?: () => void;
  /** Phase 4 §4.b-3 — current device's Ed25519 fingerprint (16-char
   *  format: `ABCD-EFGH-IJKL-MNOP`). Surfaced in the Settings
   *  migration row. Null when no keypair has been generated yet. */
  deviceFingerprint?: string | null;
  /** Phase 4 §4.b-3 — handle a Settings click on "Regenerate device
   *  keys". Wraps `regenerateDeviceKeypair(password)` on the App
   *  layer (which has access to the masterPassword + the keypair
   *  service). Optional so legacy callers compile. */
  onRegenerateDeviceKeys?: () => Promise<void> | void;
  /** Phase 4 §4.b-3 follow-up (K1) — open the Trusted Devices
   *  audit panel anchored at App level. Optional. */
  onOpenTrustedDevices?: () => void;
  /** Phase 4.5 §E follow-up (L1) — open the Memory Management
   *  panel for the picked memoir id. Optional. */
  onOpenMemoirMemories?: (memoirId: string) => void;
  /** Phase 4.5 §E follow-up (L1) — open the Letter History panel
   *  for the picked memoir id. Optional. */
  onOpenMemoirLetters?: (memoirId: string) => void;
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
  /** Phase 4 §4.b-3 — on-demand signing material fetcher. The
   *  migration export modal calls this when the user clicks
   *  "Generate package"; the App-layer handler runs
   *  `unlockSecretKey(masterPassword)` and returns the secret +
   *  publicKey. Returns null when no keypair exists yet (export
   *  falls back to unsigned). Optional so legacy callers compile. */
  onUnlockSigningKey?: () => Promise<{ secretKey: Uint8Array; publicKey: string } | null>;
  /**
   * Phase 4.5 follow-ups (F4) — open the entry composer with a
   * pre-seeded payload (typically derived from a Proactive Recall
   * suggestion). When omitted, ProactiveRecallCard.onOpen falls
   * back to the legacy "just dismiss the card" behaviour.
   */
  onOpenComposerWithSeed?: (seed: { title?: string; content?: string; tags?: string }) => void;
  /**
   * Phase 4.5 §A (Letter Mode) — direct entry-mint callback used
   * by the letter delivery sweep to persist a Memoir reply as a
   * `DiaryEntry`. Returns the new entry's id so the sweep can
   * write a back-reference into `PendingLetter.replyEntryId`.
   * Optional so legacy callers compile; when omitted, letter
   * delivery short-circuits gracefully.
   */
  onMintEntry?: (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => Promise<string>;
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
}
