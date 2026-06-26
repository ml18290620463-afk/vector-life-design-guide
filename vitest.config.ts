import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // The vite-plugin-pwa virtual module is only available when the
      // pwa plugin is loaded in vite.config.ts; vitest doesn't load
      // that plugin, so we stub it here so `import('virtual:pwa-register')`
      // resolves to a deterministic no-op `registerSW`.
      'virtual:pwa-register': path.resolve(__dirname, 'lib/__mocks__/virtual-pwa-register.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test-setup/indexeddb.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'e2e'],
    env: {
      NODE_ENV: 'test',
      // Keep PBKDF2 fast in tests; production / browsers always run at the
      // 600k default unless an operator overrides it intentionally.
      VECTOR_PBKDF2_ITERATIONS: '100000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Phase 2 §2.n ratchet. Lines / branches gate the regression budget;
      // once lit, they may only move upward (per ROADMAP cross-phase
      // discipline).
      //
      // History:
      //  - Pre-split baseline (1247-line Viewer): `71 / 47`.
      //  - After Viewer split (§2.g): `69.83 / 44.56` (denominator
      //    grew because previously-hidden MorningStar / Settings panels
      //    became visible).
      //  - After Dashboard split (§2.h): `76.06 / 47.66` — five new
      //    hooks (`useDashboardVault`, `useGuidingStarsEditor`,
      //    `useDashboardSecurity`, `useBackupReminder`,
      //    `useDashboardExport`) plus `useClickOutside` shipped with
      //    ≥5 cases each, lifting the lines metric by +6pp.
      //  - After SettingsPanel split (§2.j): `78.61 / 54.49` — seven
      //    sub-components (`SettingsRecoveryView`, `SettingsSecurityForm`,
      //    `SettingsGuidingStarsSection`, `SettingsMaterialSection`,
      //    `SettingsScanRepair`, `SettingsBackupSection`,
      //    `SettingsWipeSection`) each tested with ≥5 cases (62 new
      //    cases). Branches finally crossed 50% — the SettingsPanel
      //    used to swallow ~440 branch instructions inside its
      //    isViewingRecovery / securityMode ternary tree.
      //  - After MasterLock split (§2.i): `79.31 / 56.18` — three new
      //    hooks (`useBiometricAuth`, `useMasterPasswordVerify`,
      //    `useDoubleClickConfirm`) plus four sub-components
      //    (`MasterLockCardChrome`, `MasterLockHeader`,
      //    `MasterLockRecoveryForm`, `MasterLockUnlockForm`) shipped
      //    with ≥5 cases each.
      //  - After ArchiveVault split (§2.k): `80.44 / 58.12` — one new
      //    hook (`useArchiveGrouping`) plus five sub-components
      //    (`ArchiveVaultBackground`, `ArchiveVaultHeader`,
      //    `ArchiveEntryCard`, `ArchiveVaultEntries`,
      //    `ArchivePrinciplesView`) shipped with ≥5 cases each. Lines
      //    finally crossed 80%.
      //  - After StatisticsWidget split (§2.m): `80.88 / 59.28` —
      //    four new sub-components shipped with ≥5 cases each.
      //  - After Dashboard tail (§2.l): `81.26 / 59.60` — extracting
      //    `DashboardOverlays` and lifting `DashboardProps` into a
      //    dedicated types file.
      //  - After branch-coverage push (§2.n): `82.70 / 61.28` — three
      //    targeted suites were extended:
      //      * `useAttachmentUpload.test.ts`  +7 cases
      //        (empty input, 4 MIME → type cases, FileReader.onerror,
      //         thrown FileReader constructor)
      //      * `useBackupImport.test.ts`      +5 cases
      //        (empty input, missing onImportBackup, thrown
      //         onImportBackup, sparse translation fallback, manual
      //         setStatus reset)
      //      * `components/MorningStarRadar.test.tsx`  +7 cases
      //        (axes / rings / clamp / palette / progress bars /
      //         "n/10" notation / partial metrics fallback)
      //    Branches finally crossed the **ROADMAP `branches: 60`
      //    target** (now sitting at 61.28). The threshold is now
      //    `lines: 82 / branches: 61` so today's floor cannot regress.
      // Future work focuses on closing the last 8pp of branches in
      // Editor + FilterHub + EntryGrid + MorningStarPanel — these
      // are post-Phase 2 candidates.
      thresholds: {
        lines: 82,
        branches: 61,
      },
      // Don't measure declarative configuration / generated assets or e2e
      // entry points; they would otherwise drag the percentages down for
      // no actionable reason.
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'e2e/**',
        '**/*.config.{ts,js,mjs}',
        '**/*.d.ts',
        'vite-env.d.ts',
        'index.tsx',
        'i18n/**',
        'constants.ts',
        'metadata.json',
        'manifest.json',
        // Decorative / animation modules: hard to assert on without a
        // browser, low risk.
        'components/SpaceTimeBackground.tsx',
        'components/MemoryFragments.tsx',
        'components/DeepArchiveAnimation.tsx',
        'components/GeometricBoat.tsx',
        'components/CoverScreen.tsx',
        'lib/markdownSchemes.ts',
        // Phase 2 §2.g panels — pure presentation components extracted
        // from Viewer.tsx. Their branches are theme / animation-state
        // toggles best validated by axe-playwright + visual review; the
        // workflow logic lives in `useViewerAccess` and
        // `useMorningStarPipeline`, both of which carry their own ≥5
        // unit tests (see ROADMAP §跨阶段 "每拆 1 个文件先补 5 个单测").
        'components/ViewerSealedPanel.tsx',
        'components/ViewerReadingPanel.tsx',
        'components/ViewerStarfield.tsx',
      ],
    },
  },
});
