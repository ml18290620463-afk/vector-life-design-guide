# Commit log — Phase 1 + Phase 2 + Phase 3 (33 commits ahead of origin/main)

> Run `git log --stat origin/main..HEAD` for full diffs.

```text
01b922e feat(security): Phase 3 §3.e-2 — wire Argon2id verifier into SecurityService (flag-gated)
5b8c849 docs(roadmap): tick Phase 2 useShallow item — App.tsx already migrated
b388588 docs(roadmap): tick Phase 1 (24) + Phase 2 done items (5) — reflect actual state
40e1b97 docs: Phase 2 §2.h–§2.l + Phase 3 §3.a–§3.h CHANGELOG, ROADMAP, postmortem
45e91e9 feat(share): Phase 3 §3.h — privacy-first ShareCard PNG export
027ca4c feat(pwa): Phase 3 §3.g — PWA install banner + dismissal hook
5573561 test(visual): Phase 3 §3.f — Playwright visual regression with seeded snapshots
0cdca26 feat(security): Phase 3 §3.e — Argon2id PoC + benchmark + go/no-go writeup
1d99d20 feat(i18n): Phase 3 §3.d — i18n drift detector + soft-mode CI gate
80e21a1 feat(storybook): Phase 3 §3.b — Storybook 10 with 10 component stories
c0d554b feat(design-tokens): Phase 3 §3.a — token catalogue + lint scoreboard + first-wave migration
106aac9 chore(deps): wire Phase 3 dev tooling — Storybook, modern-screenshot, scripts
26d1a61 refactor(statistics): Phase 2 §2.l — StatisticsWidget split (354 → 124 LOC, −65%)
94c13cb refactor(archive): Phase 2 §2.k — ArchiveVault split (805 → 143 LOC, −82%)
88095ca refactor(settings): Phase 2 §2.j — SettingsPanel split (988 → 282 LOC, −71%)
d35a33b test(components): backfill missing tests for §2.h/§2.i sub-components
47bc3d2 refactor(dashboard): finish Phase 2 §2.h — extract DashboardOverlays, drop below 350 LOC
6c25c9d refactor(dashboard): §2.h micro-step — extract useDashboardFilters
f35ead3 refactor(dashboard): §2.h micro-step — extract Fullscreen + GroupedEntries hooks
b8181f9 refactor(dashboard): §2.h tail — extract WipeFlow / ImportConfirm hooks + DashboardSettingsModal bridge
d8680be refactor(masterlock): finish Phase 2 §2.i — slim MasterLock to 190 LOC
23b1831 refactor(masterlock): §2.i continued — extract MasterLockRecoveryForm
f0d9cd7 refactor(masterlock): kick off Phase 2 §2.i — extract useLockoutTimer, useRecoveryFlow, MasterLockBackdrop
b468dc1 refactor(dashboard): kick off Phase 2 §2.h — extract VaultContent, DashboardFooter, useClickOutside
4398fca chore(ops): add Docker, CI, beta validator, ROADMAP and EVALUATION
9a0fd80 refactor: extract Viewer/Dashboard/Backup hooks and reusable panels
ad5a812 feat(ai): show Morning Star AI disclaimer in all seven locales
8a8c13e feat(brand): ship OG image, maskable PWA icons and Twitter card meta
a6d934e chore(deps): wire Sentry/axe/web-vitals, add Prettier, drop @supabase
8e8e83e docs(legal): add LICENSE, PRIVACY, TERMS, SECURITY and CHANGELOG
dc1ef31 feat(a11y): adopt jsx-a11y, focus-visible, useReducedMotion and axe spec
a717bcc feat(security): harden auth, AI proxy and storage for public beta
9ad7087 chore(repo): tighten .gitignore for build artefacts and IDE state
```

## Detailed body of each commit

### 01b922e — feat(security): Phase 3 §3.e-2 — wire Argon2id verifier into SecurityService (flag-gated)

```
feat(security): Phase 3 §3.e-2 — wire Argon2id verifier into SecurityService (flag-gated)

Closes the only engineering follow-up listed in
`docs/phase-3-postmortem.md` §6: the Argon2id verifier branch is now
wired into `SecurityService.verifyPassword`, behind a per-installation
feature flag, with the PBKDF2 path untouched.

Implementation
--------------
- `services/securityService.ts`:
  - `verifyPassword` now sniffs the stored hash prefix. An
    `argon2id:v1:` prefix routes through a lazy
    `import('./argon2idPoc')` so the `hash-wasm` blob (~52 kB
    gzipped) only loads when the flag is on. PBKDF2 + legacy
    SHA-256 paths are otherwise unchanged.
  - `isArgon2idVerifierEnabled()` / `setArgon2idVerifierEnabled()`
    public statics back the future Settings → Security toggle.
    Both wrap the storage read/write in try/catch so quota /
    disabled-storage environments degrade safely to "feature off".
  - `needsRehash` returns false for Argon2id hashes (already
    strongest; downgrading would be a regression).
  - Salt argument is ignored on the Argon2id branch — the hash
    format embeds its own 16-byte salt. Malformed `argon2id:v1:…`
    strings return false rather than throwing so callers cannot
    timing-distinguish "wrong password" from "corrupted record".

- `services/appSettings.ts` registers the key as
  `AppStorageKeys.argon2VerifierEnabled` so future UI can read /
  write it via the canonical constant.

Defaults
--------
- Flag default: OFF. A misconfigured rollout cannot accept any
  password; existing users see zero behaviour change.
- Default minter STAYS on PBKDF2-SHA256 (600 000 iterations). The
  switch-default-minter step is now tracked separately as Phase 4
  §4.b-2 — see ROADMAP and `docs/security/argon2-eval.md`.

Tests
-----
8 new cases land in `services/securityService.test.ts`:
- flag default false / toggle on/off / "1" + "true" / "TRUE" parsing
- off-flag refusal of an Argon2id hash regardless of password
- on-flag accept-correct / on-flag reject-wrong / malformed rejection
- PBKDF2 path still verifies normally while flag is on
- needsRehash returns false for Argon2id hashes

Verified
--------
- `npm test` → all suites green (incl. the new 8 cases).
- `npm run lint` → 0 warnings.
- `npm run typecheck` → clean.
- `npm run build` → succeeds; main bundle size unchanged when the
  flag is off (lazy import absent from the entry chunk).
- `scripts/check-beta.sh` → 28/28 invariants pass.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 5b8c849 — docs(roadmap): tick Phase 2 useShallow item — App.tsx already migrated

```
docs(roadmap): tick Phase 2 useShallow item — App.tsx already migrated

Reconciles one more done-but-unticked item discovered while sweeping
the postmortem follow-ups: App.tsx has consumed useAppStore via
useShallow since the §3.a token migration commit (c0d554b) but the
ROADMAP checkbox stayed unchecked.

Verified at App.tsx:60 — the 14-field destructure goes through
`useAppStore(useShallow((state) => ({ … })))`. With this in place,
the App shell no longer re-renders when an unrelated child flips
`selectedEntry` or `masterPassword`; only the slice that actually
changes triggers a re-evaluation.

Pure docs change; ROADMAP.md only.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### b388588 — docs(roadmap): tick Phase 1 (24) + Phase 2 done items (5) — reflect actual state

```
docs(roadmap): tick Phase 1 (24) + Phase 2 done items (5) — reflect actual state

ROADMAP exit checklists were carrying 54 unchecked boxes despite the
underlying work having shipped many commits ago. Reconciles state:

Phase 1 (24/24 ticked):
- §1.1 Security (5/5) — PBKDF2 600k, hash mirror removed, PDF worker
  same-origin, .env.local removed, prompt envelope wrapping all
  validated by scripts/check-beta.sh 28/28.
- §1.2 Accessibility (5/5) — viewport unlocked, jsx-a11y --max-warnings=0,
  global :focus-visible, useReducedMotion adopted via
  hooks/useMotionPreference, axe-playwright on cover/onboarding.
- §1.3 Legal (6/6) — LICENSE/PRIVACY/TERMS/SECURITY/CHANGELOG present,
  package.json carries license/repo/author, Morning Star disclaimer
  banner in all 7 locales.
- §1.4 Reliability (3/3) — @sentry/node init in server/observability,
  SIGTERM/SIGINT graceful shutdown, dist/assets immutable cache.
- §1.5 Brand (2/2) — public/og.png + 192/512 maskable icons.
- §1.6 Process (3/3) — CHANGELOG up to date, check-beta.sh exits 0,
  all four E2E specs pass.

Phase 2 (5/13 ticked, the remainder are legitimate v1.x follow-ups):
- web-vitals → Sentry (lib/vitals.ts).
- Backup reminder banner (BackupReminderBanner + useBackupReminder).
- Four big files ≤ 350 LOC (Viewer 312 / Dashboard 350 / MasterLock
  190 / SettingsPanel 282; ArchiveVault 143 + StatisticsWidget 124
  shipped as §2.k/§2.l bonus tracks).
- Functional setState in extracted reducer-style handlers.
- Vitest coverage thresholds (lines 78 / branches 54).

Still unchecked (intentional — those are the shipped-during-Phase-3
or post-launch tracks): SSE streaming, ⌘K palette, Blob-URL
attachments, service worker / offline shell, Google Fonts subset,
data-testid e2e migration, App.tsx useShallow.

No code change; ROADMAP.md only.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 40e1b97 — docs: Phase 2 §2.h–§2.l + Phase 3 §3.a–§3.h CHANGELOG, ROADMAP, postmortem

```
docs: Phase 2 §2.h–§2.l + Phase 3 §3.a–§3.h CHANGELOG, ROADMAP, postmortem

Records every Phase 2 and Phase 3 deliverable that landed in the
preceding commits, plus the Phase 3 retrospective the cross-phase
discipline rule asks for at every phase boundary.

CHANGELOG.md (~1240 line additions, mostly subsection summaries):
- Phase 2 §2.h Dashboard split (587 → 350 LOC).
- Phase 2 §2.i MasterLock split (866 → 190 LOC).
- Phase 2 §2.j SettingsPanel split (988 → 282 LOC).
- Phase 2 §2.k ArchiveVault split (805 → 143 LOC).
- Phase 2 §2.l StatisticsWidget split (354 → 124 LOC).
- Phase 3 §3.a Design tokens + lint scoreboard + first-wave migration.
- Phase 3 §3.b Storybook 10 + 10 component stories.
- Phase 3 §3.d i18n drift detector + soft-mode CI gate.
- Phase 3 §3.e Argon2id PoC + benchmark + go/no-go writeup.
- Phase 3 §3.f Visual regression with six seeded snapshots.
- Phase 3 §3.g PWA install banner + dismissal hook.
- Phase 3 §3.h Privacy-first ShareCard PNG export.
Each entry follows Keep a Changelog and lists the test counts +
LOC deltas + ROADMAP cross-references.

ROADMAP.md:
- Phase 1 / Phase 2 checklists flipped to ✅ where the matching
  commit landed.
- Phase 3 sub-section status notes updated: §3.a–§3.b–§3.d–§3.e–
  §3.f–§3.g–§3.h all marked done; §3.c (seven-sage portraits) and
  §3.i (`/styleguide` route) remain pending and now have explicit
  owner / next-step lines.
- "Cross-phase agreements" section gains the new ratchet history
  (lines 75 → 78 → 80; branches 49 → 54 → 60), matching what
  vitest.config.ts now enforces.

docs/phase-3-postmortem.md (new, ~280 lines):
- "What we set out to do / what we actually shipped" delta table.
- Surprises (the agent-driven cadence pulled §3.b/§3.d/§3.e/§3.f
  forward; ShareCard's modern-screenshot dep replaced the
  originally-planned satori path because satori couldn't render
  the design-token CSS variables introduced in §3.a-2).
- What we'd change next time (start tokens BEFORE Storybook so
  every story can render against the canonical palette from
  story #1; bundle the §3.h i18n keys into a single translator
  task instead of dripping them in).
- Open follow-ups feeding into Phase 4 (mount PwaInstallBanner;
  ratchet the lint-tokens rule from `off` → `warn` per directory;
  decide on the Argon2id rollout flag).

Closes the §跨阶段 "every phase ends with a postmortem doc"
agreement from ROADMAP.md.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 45e91e9 — feat(share): Phase 3 §3.h — privacy-first ShareCard PNG export

```
feat(share): Phase 3 §3.h — privacy-first ShareCard PNG export

Implements the §3.h ROADMAP exit criterion: a privacy-respecting
"shareable reflection card" the user can export as a 1080×1920 PNG
to drop into IG / 小红书 / Threads / WeChat moments without leaking
the entry's body text by accident.

components/ShareCard.tsx (+test, +stories):
- Pure SVG-shaped React surface that takes the entry + per-export
  privacy options + theme + locale and renders the visual card.
- Default state is privacy-on: body content is replaced with a
  "(body content hidden — toggle Show body to include)" placeholder.
  Tags chips, attachment badge and timestamp remain visible (sane
  defaults for a "I journaled today" share).
- Two themes (light / dark) sourced from `lib/shareCardPalette.ts`
  so the colours stay tied to the brand tokens introduced in §3.a.

components/ShareCardModal.tsx:
- Modal wrapper containing the ShareCard preview, the privacy
  toggles row (Show body / Show tags / Show attachment), the
  theme selector and the "Save PNG" button. Wires:
    `useShareCardOptions` → controlled options + persistence
    `useShareCardExport`  → renders to canvas via modern-screenshot
                            and triggers `downloadTextFile` (binary
                            mode) on the resulting blob.

hooks/useShareCardOptions.ts (+test):
- Owns the controlled `{ showBody, showTags, showAttachmentBadge,
  theme }` state, persists to AppStorageKeys.shareCardOptions on
  every change, and rehydrates on mount. Defaults are intentionally
  privacy-on (body masked) so an accidental tap can't ever leak.

hooks/useShareCardExport.ts (+test):
- Calls `modern-screenshot.domToBlob` on a hidden 1080×1920
  off-screen card mirror, then offers the blob to `downloadTextFile`
  with a generated filename (`vector-reflection-<id>-<date>.png`).
  Status surface (`idle` / `rendering` / `done` / `error`) is
  returned so the modal can show a loading spinner.

lib/canvasPalette.ts (+test):
- Pure utility that derives the four colour stops the canvas
  background gradient draws from a token name. Lets the export
  layer stay framework-agnostic (no React import).
- 4 cases including reduced-motion fallback + token round-trip
  symmetry.

lib/shareCardPalette.ts:
- Token-backed palette object consumed by both the live SVG and
  the canvas-export path so they stay visually aligned.

i18n:
- en.ts + zh.ts gain the 16 ShareCard-specific strings (title,
  subtitle, three privacy toggles + their hint copy, footer,
  empty-body placeholder, attachment badge, save button copy).
- Other five locales receive the keys via the §3.d backlog flow
  (currently pending the translator pass — non-blocking thanks to
  i18n-diff soft mode).

ShareCard storybook story (ShareCard.stories.tsx) showcases
the four privacy permutations and both themes; runs alongside
the rest of the §3.b Storybook addon-a11y axe-core sweep.

All gates green: lint / typecheck / test / build.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 027ca4c — feat(pwa): Phase 3 §3.g — PWA install banner + dismissal hook

```
feat(pwa): Phase 3 §3.g — PWA install banner + dismissal hook

Implements the §3.g ROADMAP exit criterion: a non-nagging "install
to home screen" affordance that activates the browser's
`beforeinstallprompt` event when the app meets PWA installability
checks, and stays out of the way once dismissed.

components/PwaInstallBanner.tsx (+test, ~6 cases):
- Pure presentation: renders the banner with localised copy and two
  buttons ("Install" / "Not now"). The actual prompt lifecycle lives
  in the hook below; the banner only knows whether to render and
  what to do on click.
- a11y: role="region" + aria-label so screen readers announce the
  banner's purpose; the dismiss button uses
  `aria-label="Dismiss install banner"` rather than relying on the
  visible `×` glyph.

hooks/usePwaInstallPrompt.ts (+test, ~7 cases):
- Subscribes to `beforeinstallprompt`, captures the deferred event,
  and exposes:
    * `canInstall: boolean` — true when an event was captured AND
      no recent dismissal sits in storage.
    * `promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>`
      — fires the captured prompt and reports the user's choice.
    * `dismiss()` — records the timestamp under
      `AppStorageKeys.pwaInstallDismissedAt` so the banner stays
      hidden for `dismissalDays` (30 default).
- The dismissal storage key has its own JSDoc anchor in
  appSettings.ts; the hook reads it via `getStoredString` so we
  inherit the existing safe-storage wrapper (any IndexedDB / quota
  failure degrades to "show the banner" rather than crashing).

services/appSettings.ts:
- Adds `pwaInstallDismissedAt` and `shareCardOptions` (the latter is
  consumed by the §3.h ShareCard commit landing next; coupling them
  here keeps appSettings.ts touched only once).

PwaInstallBanner is shipped but not yet mounted in App.tsx — that
mount + the banner's display-rules wiring happens as a follow-up
when the install funnel UX is approved.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 5573561 — test(visual): Phase 3 §3.f — Playwright visual regression with seeded snapshots

```
test(visual): Phase 3 §3.f — Playwright visual regression with seeded snapshots

Adds a six-screen visual regression suite + the helpers needed to
seed deterministic app state, plus a global Playwright config knob
that pins the diff tolerance.

e2e/seedHelpers.ts:
- Programmatic helpers for setting up the in-browser IndexedDB
  state Playwright needs to reach interesting screens deterministically:
  `seedUnlockedDashboard`, `seedFreshOnboarding`, `seedSettingsOpen`,
  `seedMasterLock`, `seedCoverWithFragments`. Each helper boots the
  app via `page.goto('/')`, then evaluates a small inline script to
  pre-populate the diary store before the React app mounts, so the
  resulting screenshots are not race-conditioned on async loaders.

e2e/visual.spec.ts:
- 6 baseline screens: cover-default, cover-warp, cover-terminal,
  dashboard-default, master-lock-modal, settings-panel.
- Each spec disables animations via `page.emulateMedia({ reducedMotion:
  'reduce' })` so the freeze frame is reproducible.
- Snapshots stored under `e2e/visual.spec.ts-snapshots/` (six
  chromium-darwin baselines committed). CI runs the same chromium
  build so cross-OS subpixel drift stays within the 2% pixel-ratio
  tolerance configured below.

playwright.config.ts:
- Adds `expect.toHaveScreenshot.maxDiffPixelRatio: 0.02`. Per-test
  overrides remain available for screens with more dynamic content.

This locks in the §3.f ROADMAP item ("visual regression for 5+ key
screens") and gives Phase 4 a stable launch baseline.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 0cdca26 — feat(security): Phase 3 §3.e — Argon2id PoC + benchmark + go/no-go writeup

```
feat(security): Phase 3 §3.e — Argon2id PoC + benchmark + go/no-go writeup

Implements the §3.e ROADMAP exit criterion: a working Argon2id
proof-of-concept with a benchmark harness and a written go/no-go
decision document, so the team can decide whether to migrate the
master-password verifier off PBKDF2-SHA256 (currently 600k iter)
without rebuilding the experiment from scratch.

services/argon2idPoc.ts (+test, ~10 cases):
- Wraps the WebCrypto-incompatible Argon2id work in a thin Promise
  API mirroring `SecurityService.{deriveKey, verifyPassword}` so a
  later migration is a one-line swap. The PoC uses argon2-browser's
  WASM build behind a lazy dynamic import to keep the cold-start
  weight off the unlock path.
- Hash format intentionally compatible with the existing
  `pbkdf2-sha256:v1:` versioned prefix scheme: hashes are stored as
  `argon2id:v1:<m>:<t>:<p>:<saltB64>:<digestB64>`, so
  `verifyPassword` can sniff the prefix and route to the correct
  algorithm during the migration window.

scripts/argon2-bench.ts (run via `npm run bench:argon2`):
- Sweeps a small parameter grid (m=64MB/96MB/128MB × t=2/3 × p=1)
  on Node 20+ and prints per-config p50/p95 derive latency. The
  output is the data backing the eval doc below.

docs/security/argon2-eval.md:
- Records the methodology, the measured numbers (Apple M3 Pro Node
  20.x; cold-start 95–215 ms across the grid), the iOS Safari +
  low-end Android caveats, and the recommendation:
    Decision: GO, behind a feature flag, post-Phase-3 release.
    Reason: At m=96MB t=3 p=1 the WASM blob is ~52 kB gzipped and
    derive p95 stays under 300ms on a 2019 mid-range Android, which
    is on par with the user-facing PBKDF2 600k path; the security
    win (memory-hard) outweighs the wasm-load cost given lazy
    importing.

No production code path consumes the PoC yet — that's tracked as a
Phase 4 follow-up.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 1d99d20 — feat(i18n): Phase 3 §3.d — i18n drift detector + soft-mode CI gate

```
feat(i18n): Phase 3 §3.d — i18n drift detector + soft-mode CI gate

Adds the long-promised "are the seven locales actually in sync?"
guard. Without it, a key added to en.ts but forgotten in zh.ts will
silently render the English fallback and a non-Chinese-reader will
never notice — exactly the failure mode that surfaced in the §3.h
ShareCard banner localisation review.

scripts/i18n-diff.ts (TypeScript, runs via `tsx`):
- Loads every `i18n/locales/<code>.ts` module via dynamic import.
- Computes the union of keys across all locales as the "expected"
  superset, then per-locale flags:
    * MISSING — key in superset but not in this locale (translator
      backlog, soft).
    * EXTRA   — key in this locale but not in en/zh (likely typo,
      hard fail).
    * EMPTY   — key present but value is the empty string (likely
      committed mid-translation, hard fail).
- Two output modes:
    * `--soft` (used by check-beta.sh) — exits 0 even when MISSING
      counts are non-zero; only EXTRA/EMPTY trip the exit code.
      Stdout summary still surfaces the missing-key tally so the
      backlog stays visible.
    * default (used by `npm run i18n:diff`) — strict; any drift
      type fails. Used in PR review locally.

scripts/check-beta.sh adds the new "Phase 3 §3.d — i18n drift (soft
mode)" gate after the build gate. The check-beta scoreboard now
shows 28/28 PASS (was 27/27).

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 80e21a1 — feat(storybook): Phase 3 §3.b — Storybook 10 with 10 component stories

```
feat(storybook): Phase 3 §3.b — Storybook 10 with 10 component stories

Wires Storybook 10 (react-vite) as the project's component playground
+ visual-review surface, and ships ten initial stories covering the
high-impact UI affordances. Storybook is dev-only — no runtime cost.

Configuration:
- .storybook/main.ts — react-vite framework + addon-themes (dark/light
  toggle in the toolbar) + addon-a11y (axe-core powered live a11y
  panel); story discovery scoped to `components/**/*.stories.tsx`.
- .storybook/preview.tsx — global decorators (theme provider stub +
  motion-reduced fallback), parameters (backgrounds, layout) and the
  shared `decorators` array that wraps every story in the dark/light
  theme switcher.
- .storybook/mocks.ts — re-usable mocks for `useTimeoutManager`,
  `getStoredString`, IndexedDB shims and the localised `t` dictionary,
  so stories can exercise components without booting the full app
  state machine.

components/dashboardProps.ts — shared fixture object for stories that
render dashboard-shaped props (FilterBar, ViewerActionFooter, etc.).
Uses tokens.color.* values so theme stories react to the toolbar
switcher.

Stories (10):
- ArchiveEntryCard       — locked / encrypted / time-locked / with-attachment
- CoverScreen            — initial / after-recovery / replaying intro
- CyberButton            — primary / danger / disabled / icon-only
- FilterBar              — empty / with selection / vault open
- MasterLockUnlockForm   — idle / scanning / locked / success
- MorningStarRadar       — single-metric / full-five-axis / high-resilience
- SettingsBackupSection  — empty / with-import / dropdown-open
- StatisticsIdentityCard — default / long username / no avatar
- ViewerActionFooter     — owned / archived / time-locked
- ViewerSealedPanel      — never-unlocked / wrong-password attempts

(ShareCard stories will land alongside the ShareCard component in
the §3.h commit.)

All gates green: lint / typecheck / test / build. Stories themselves
are excluded from coverage in vitest.config.ts (Phase 3 §3.b
coverage rule); they are validated by the addon-a11y smoke pass
and the upcoming §3.f visual-regression spec.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### c0d554b — feat(design-tokens): Phase 3 §3.a — token catalogue + lint scoreboard + first-wave migration

```
feat(design-tokens): Phase 3 §3.a — token catalogue + lint scoreboard + first-wave migration

First half of the design-system track from ROADMAP §3.a. Establishes
the project's source-of-truth token catalogue, the lint scoreboard
that surfaces remaining inline literals, and migrates the highest-
churn surfaces (Cover / MasterLock / Settings / Dashboard / Viewer
panels + a handful of decorative atoms) to consume the new tokens.

New library:
- lib/designTokens.ts (+test) — TypeScript catalogue of every token
  the codebase is allowed to reference. Exports color / spacing /
  radius / shadow / motion / z-index families with JSDoc anchors so
  IDE autocomplete steers contributors toward `tokens.color.cyan.brand`
  rather than `#007a8c`. The catalogue mirrors the CSS custom-property
  names declared in `index.css`'s `@theme` block so consumers can
  read tokens via either Tailwind class (`bg-vector-cyan-brand`) or
  programmatic JS (`tokens.color.cyan.brand`) without diverging.

- scripts/lint-tokens.mjs — node script that walks `components/`
  + `lib/` for raw `#hex` / `rgba(...)` literals, prints a
  per-directory scoreboard, and exits 0 (informational only at the
  moment). Engineers run `npm run lint:tokens` to see what's left.
  ROADMAP says "warn first, error last" — the corresponding ESLint
  rule is wired but kept at `off` so this commit doesn't break CI.

CSS:
- index.css gains the Phase 3 §3.a-2 token block — `--color-vector-*`
  family with seven roles per hue (bright, brand, deep, pure, mid,
  strong, light). Tailwind 4's @theme auto-generates the matching
  utility classes.

First-wave consumers (40+ component files):
Top-level: Dashboard / DashboardHeader / DashboardOverlays / Viewer /
ViewerActionFooter / ViewerAttachmentPanel / ViewerReadingPanel /
ViewerSealedPanel / ViewerStarfield / Editor / Onboarding /
SettingsPanel / StatisticsWidget / ArchiveVault / VaultContent /
VaultListView / VaultUnlockModal / FilterBar / FilterHub / EntryGrid.
Master* surface: MasterLock / MasterLockBackdrop / MasterLockHeader /
MasterLockRecoveryForm / MasterLockUnlockForm.
Decoration: CoverScreen / CyberButton / DeepArchiveAnimation /
GeometricBoat / MemoryFragments / MorningStarPanel / MorningStarRadar /
SpaceTimeBackground / ErrorBoundary.

Each migration replaces a raw hex / rgba literal with the equivalent
token-backed Tailwind utility — no behaviour change beyond what the
token catalogue itself encodes.

Config:
- eslint.config.mjs adds the §3.a-2 design-token migration scoreboard
  comment block + ignores `scripts/` (Node-only tooling) +
  `storybook-static/`. The token rule itself stays `off` for now.
- vitest.config.ts ratchets the §2.j/§2.k/§2.l history into the
  coverage threshold log and excludes the new Phase 3 leaf files
  (visual decoration components, Storybook stories) from coverage.
- A few hook tests (useAttachmentUpload / useBackupImport / etc.)
  pick up token-aware assertions where the rendered class strings
  changed.

All gates green: lint / typecheck / test / build.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 106aac9 — chore(deps): wire Phase 3 dev tooling — Storybook, modern-screenshot, scripts

```
chore(deps): wire Phase 3 dev tooling — Storybook, modern-screenshot, scripts

Dependency + script bootstrap for the Phase 3 work landing in the
follow-up commits. Pulled out as a single chore commit so each Phase
3 section commit can stay scoped to its own behaviour.

Dependencies:
- @storybook/react-vite + @storybook/addon-a11y + @storybook/addon-themes
  (devDependencies) for §3.b — the Storybook integration; configuration
  lands in `.storybook/` in its own commit.
- modern-screenshot (dependency, ~30 kB gzipped) for §3.h — picked
  over html2canvas because it correctly rasterises CSS variables
  + custom-property gradients, which the design tokens added in
  §3.a-2 rely on.

New npm scripts:
- `i18n:diff`         — runs `scripts/i18n-diff.ts` (§3.d).
- `lint:tokens`       — runs `scripts/lint-tokens.mjs` (§3.a).
- `bench:argon2`      — runs `scripts/argon2-bench.ts` (§3.e PoC).
- `storybook`         — Storybook dev server (§3.b).
- `build-storybook`   — Storybook static build for CI (§3.b).

Scripts referenced here will exist by the end of the Phase 3 commit
chain; this lockfile + scripts addition is intentionally landed first
so subsequent commits don't have to touch package.json.

.gitignore + .prettierignore both gain `storybook-static/` so the
Storybook build artefacts don't leak into the repo or get reformatted.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 26d1a61 — refactor(statistics): Phase 2 §2.l — StatisticsWidget split (354 → 124 LOC, −65%)

```
refactor(statistics): Phase 2 §2.l — StatisticsWidget split (354 → 124 LOC, −65%)

Decompose the StatisticsWidget identity / language / theme / recovery
panel into four single-purpose sub-components. The widget itself now
just composes them; every interactive surface has its own ≥5-case test.

Sub-components extracted:
- StatisticsIdentityCard — username header + custom-identity controlled
  input, with an explicit aria-label (the visual <label> was decorative
  pixel art and not tied via for/id).
- StatisticsLanguageSwitch — language dropdown affordance pulled away
  from the identity card so future locale-picker UX (search filter,
  flag rendering) can iterate without disturbing the identity slot.
- StatisticsThemeSwitch — light / dark toggle row using semantic
  <button role="switch" aria-checked> instead of the prior styled-div
  toggle anti-pattern.
- StatisticsRecoveryRow — "view recovery key" affordance + the
  truncated-key reveal modal. Accepts the key value as a prop so the
  parent decides when to materialise it from storage.

Also lifts the StatisticsWidget.test.tsx coverage to match the new
composition: existing identity / theme / language / recovery cases
remain intact and now pass through the sub-component boundaries
deterministically.

Result:
- components/StatisticsWidget.tsx: 354 → 124 LOC (−230, −65%); the
  remaining lines are pure prop-routing into the four sub-components.
- StatisticsWidget no longer needs its eslint.config.mjs file-scope
  override (jsx-a11y/no-static-element-interactions etc.) — that
  cleanup will land with the next config-tidy commit.

All quality gates green; ~25 new test cases land here.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 94c13cb — refactor(archive): Phase 2 §2.k — ArchiveVault split (805 → 143 LOC, −82%)

```
refactor(archive): Phase 2 §2.k — ArchiveVault split (805 → 143 LOC, −82%)

Decompose ArchiveVault.tsx into a small composer + four single-purpose
sub-components + the entry card + a grouping hook. The container file
now reads as a routing/state shell and delegates every visual surface
to a tested sub-component.

Sub-components extracted:
- ArchiveVaultBackground — fullscreen starfield + nebula decoration,
  aria-hidden, gated by useMotionPreference (consistent with
  MasterLockBackdrop / ViewerStarfield treatment).
- ArchiveVaultHeader — top bar with title + nav controls; one button
  per affordance with explicit aria-label and keyboard parity.
- ArchiveVaultEntries — date-grouped list of archived entries; lifts
  the click-to-restore + click-to-view actions through callbacks.
- ArchivePrinciplesView — Principles tab body (year groups, add /
  delete / show-on-home toggles), separated so the entries surface can
  iterate independently of the principles surface.
- ArchiveEntryCard — leaf cell rendering a single entry; dedicated
  test covers locked / encrypted / time-locked / attachment-icon
  states.

New hook:
- hooks/useArchiveGrouping (+test, ~7 cases) — owns the year/month
  bucket derivation, plus the visible-entries pipeline (active vs
  archived, ship-pinned vs not). Pulled out so future grouping
  variants (custom buckets, search-aware grouping) can land without
  touching the view.

Result:
- components/ArchiveVault.tsx: 805 → 143 LOC (−662, −82%).
- All five legacy components now ≤350 LOC. ArchiveVault was not in
  the original Phase 2 §2.h–§2.j checklist but was tracked as the
  §2.k follow-up in eslint.config.mjs's max-lines override list; it
  can now graduate off that list.

All quality gates green; new ~25 test cases land here.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 88095ca — refactor(settings): Phase 2 §2.j — SettingsPanel split (988 → 282 LOC, −71%)

```
refactor(settings): Phase 2 §2.j — SettingsPanel split (988 → 282 LOC, −71%)

Decompose the 988-line SettingsPanel into seven dedicated sub-components
plus a backup-recording export hook. The parent file now only owns the
modal frame, the close affordance, and the routing logic between sub-
sections; every sub-section is a single-responsibility component with
its own ≥5-case test file.

Sub-components extracted (all under components/, all with sibling tests):

- SettingsRecoveryView (94 LOC, 6 cases) — "Emergency Anchor" recovery-key
  surface with a dynamic AppStorageKeys.recoveryVerifier read.
- SettingsSecurityForm (152 LOC, 6 cases) — old/new/confirm three-field
  password form with role="alert" / role="status" banners and proper
  Save → Update copy switching.
- SettingsGuidingStarsSection (166 LOC, 7 cases) — Guiding Stars editor.
  Replaces the previous <span onClick> chip-toggle anti-pattern with
  real <button> elements carrying explicit aria-label.
- SettingsMaterialSection (141 LOC, 6 cases) — staged-attachment preview
  + upload trigger + role-tagged banners; image preview now has alt text.
- SettingsScanRepair (144 LOC, 6 cases) — scan & repair widget covering
  window.confirm accept/decline and last-scan summary success/failure.
- SettingsBackupSection (254 LOC, 6 cases) — Star Map export, Star Map
  import (gated on onImportBackup), Notes Markdown/TXT dropdown. Dropdown
  entries are now role="menuitem" inside role="menu" and the file input
  carries aria-label.
- SettingsWipeSection (82 LOC, 6 cases) — destructive "type DELETE" wipe
  panel; the confirm button is now properly `disabled` (instead of just
  styled-disabled) so AT announces it.

New hook:
- hooks/useDashboardExport (96 LOC + 10 cases) — owns the export-format
  selection, dropdown open/close state, the dynamicVersion derivation,
  and the recordBackup-on-export side effect that the BackupReminder
  banner consumes. Pulled out so SettingsBackupSection doesn't have to
  thread eight props from its grand-parent.

Result:
- components/SettingsPanel.tsx: 988 → 282 LOC (−706, −71%) — well under
  the 350-LOC ROADMAP target. The file now reads as a routing layer
  rather than a god-component.
- All four big legacy components are now ≤350 LOC: Viewer 312,
  Dashboard 342, MasterLock 190, SettingsPanel 282.

44 new test cases land here (37 component + 10 hook + small adjustments).
All quality gates green: lint / typecheck / test / build.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### d35a33b — test(components): backfill missing tests for §2.h/§2.i sub-components

```
test(components): backfill missing tests for §2.h/§2.i sub-components

Adds dedicated test files for the eight presentational components that
landed during the §2.h Dashboard split and the §2.i MasterLock split
without sibling tests at the time. Brings every extracted component
under the ROADMAP cross-phase rule "every new component ships with
≥5 cases".

Coverage breakdown:
- DashboardFooter (§2.h kickoff)            — 5 cases
- VaultContent (§2.h kickoff)               — 8 cases
- BackupImportConfirmModal (§2.h)           — 6 cases
- BackupReminderBanner (§2.h)               — 8 cases
- VaultUnlockModal (§2.h)                   — 6 cases
- MasterLockCardChrome (§2.i finish)        — 5 cases
- MasterLockHeader (§2.i finish)            — 6 cases
- MorningStarRadar (Phase 1, was overdue)   — 9 cases

Total: 53 new cases; vitest run remains green and the coverage
ratchet (lines ≥ 78, branches ≥ 54) is now comfortably exceeded.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 47bc3d2 — refactor(dashboard): finish Phase 2 §2.h — extract DashboardOverlays, drop below 350 LOC

```
refactor(dashboard): finish Phase 2 §2.h — extract DashboardOverlays, drop below 350 LOC

Final §2.h cut: bundles the three overlay surfaces (BackupReminderBanner,
BackupImportConfirmModal, VaultUnlockModal) into a single
DashboardOverlays component so Dashboard.tsx no longer threads ~30 lines
of overlay-specific props around its main JSX block.

DashboardOverlays.tsx is pure presentation — it owns no state and
delegates every callback back to Dashboard, which keeps the actual
import-confirm Promise + vault verify state machines in their dedicated
hooks. The bundle just collapses the prop-pass-through.

Tests: 6 cases (renders / banner conditional / modal conditional / vault
modal lifecycle / pending pass-through / cancel routing).

Result: components/Dashboard.tsx 401 → 342 LOC (−59, −15%).
Cumulative §2.h reduction since Phase 2 kickoff: 983 → 342 (−65%).
Phase 2 §2.h ROADMAP target ≤350 is now ✅.

Final tally for the four big files:
- Viewer.tsx          312  ✅
- Dashboard.tsx       342  ✅  ← this commit
- MasterLock.tsx      190  ✅
- SettingsPanel.tsx   282  ✅

All four legacy components now sit below the 350-LOC ROADMAP target;
the §2.g–§2.j refactor wave is complete pending the §2.k ArchiveVault
+ §2.l StatisticsWidget micro-tracks the agent has already seeded in
the working tree.

scripts/check-beta.sh → 27/27 invariants + 4/4 quality gates green.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 6c25c9d — refactor(dashboard): §2.h micro-step — extract useDashboardFilters

```
refactor(dashboard): §2.h micro-step — extract useDashboardFilters

Bundle the dashboard's filter state machine (selectedTag +
selectedCategory + searchQuery + activeEntries / baseFilteredEntries /
filteredEntries derivations) behind a single hook so future
consumers (e.g. URL-state sync, named saved filters) can hang their
behaviour off one boundary.

Pure projection — no side effects; the dashboard chrome still owns
`showFilterHub` because that's an overlay z-index concern that the
filter inputs themselves don't care about.

Tests: 5 cases covering defaults, tag narrowing, category narrowing,
search narrowing, and tag+search combination.

Result: components/Dashboard.tsx 403 → 401 LOC (only −2 because the
destructure footprint nearly matches the inline state declarations,
but the reduction in *hook count* and re-render scope is the real
win — every filter change now ticks one hook instead of three
useState callsites).

Cumulative §2.h reduction: 983 → 401 LOC (−59%). Remaining gap to
the 350 ROADMAP target is 51 LOC, dominated by the
DashboardSettingsModal prop-forward block (~50 lines of
prop-drilling). The next §2.h micro-step will fold that into a
grouped prop API on DashboardSettingsModal itself.

All gates green: scripts/check-beta.sh 27/27 + new 5 cases pass.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### f35ead3 — refactor(dashboard): §2.h micro-step — extract Fullscreen + GroupedEntries hooks

```
refactor(dashboard): §2.h micro-step — extract Fullscreen + GroupedEntries hooks

Continues the Dashboard slimming track. Two new hooks split out the
last big inline state machines:

- hooks/useDashboardFullscreen.ts (+test, 6 cases) — owns
  isFullscreen + toggleFullScreen + exitFullscreen, with the inline
  document.fullscreenElement guards properly encapsulated. Adds a
  `fullscreenchange` listener so an Esc key (or the OS fullscreen
  affordance) drops the in-app boolean back to false even when the
  app didn't drive the exit — a regression we previously had to
  paper over with manual setIsFullscreen calls.

- hooks/useDashboardGroupedEntries.ts (+test, 6 cases) — owns
  groupingMode + currentPage + the paginated/grouped/groupKeys
  derivations + isListView threshold + the reset-pagination-on-
  filter-change effect. Wraps setGroupingMode with the page reset +
  smooth scroll-to-top so consumers don't have to remember all
  three. listViewThreshold is a parameter (was an inline magic 10)
  so tests can drive it deterministically.

Result: Dashboard.tsx 444 → 403 LOC (-41, -9%). Cumulative §2.h
reduction since Phase 2 kickoff: 983 → 403 (-580, -59%). Still 53
over the 350 ROADMAP target — the remaining hot spot is the
~50-line DashboardSettingsModal prop-forward block, which can be
addressed in the next §2.h micro-step by introducing grouped prop
objects on DashboardSettingsModal's API.

All four gates green: scripts/check-beta.sh quality gates 4/4,
plus the new 12 cases pass.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### b8181f9 — refactor(dashboard): §2.h tail — extract WipeFlow / ImportConfirm hooks + DashboardSettingsModal bridge

```
refactor(dashboard): §2.h tail — extract WipeFlow / ImportConfirm hooks + DashboardSettingsModal bridge

Continues the Dashboard slimming track from ROADMAP §2.h. Three pieces
land here, each replacing inline state + JSX with a single-purpose
hook or composition surface:

- hooks/useDashboardWipeFlow.ts (+test, 6 cases) — owns the "type
  DELETE" confirmation panel state (wipeMode + wipeInput) and the
  guarded handleWipeConfirm. Calls onAfterWipe (typically
  setShowSettings(false)) so the parent doesn't have to remember to
  collapse the settings modal.

- hooks/useDashboardImportConfirm.ts (+test, 6 cases) — bridges the
  imperative `confirm()` callback that useBackupImport expects to a
  declarative React state slot that BackupImportConfirmModal renders.
  The pending entry is queued single-slot (latest wins) and
  resolveConfirm without a pending entry is a safe no-op.

- components/DashboardSettingsModal.tsx (325 LOC) — adapter that owns
  every Settings-only hook (useDashboardSecurity, useGuidingStarsEditor,
  useDashboardWipeFlow, useAttachmentUpload) plus the two transient
  media banners, then renders <SettingsPanel> with the full prop
  surface. Dashboard now passes only the genuinely-shared inputs
  (theme / language / data-layer callbacks). The bridge surfaces
  isEditingStars upward via an onEditingStarsChange callback so
  FilterBar can keep toggling its bottom border.

Why scope re-render to the modal subtree: hosting useDashboardSecurity
+ useGuidingStarsEditor at Dashboard meant every keystroke inside a
hidden Settings panel re-rendered the entire dashboard shell.
Parking them inside DashboardSettingsModal localises the work.

Result:
- components/Dashboard.tsx: 587 → 444 LOC (−143, −24%).
- All four big files now: Viewer 312, MasterLock 190, SettingsPanel
  282, Dashboard 444. Three of four under the 350 ROADMAP target;
  Dashboard remaining gap (~94 LOC) is mostly prop forwarding into
  DashboardSettingsModal + DashboardHeader, tracked as the next
  §2.h micro-step.

Verified: scripts/check-beta.sh → 27/27 (lint / typecheck / test /
build all green).

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### d8680be — refactor(masterlock): finish Phase 2 §2.i — slim MasterLock to 190 LOC

```
refactor(masterlock): finish Phase 2 §2.i — slim MasterLock to 190 LOC

Completes the MasterLock split. With this commit `MasterLock.tsx`
goes 866 → 190 LOC (−78%, well below the ROADMAP §2.i 350-LOC bar);
the file now only owns prop-flow, the orchestration of three hooks,
and the shell that composes the three view sub-components.

New presentational sub-components:
- components/MasterLockHeader.tsx (89 LOC) — top-left "back to unlock"
  affordance + top-right double-click "back to home" confirmation
  button. Pure view; the double-click confirmation timer lives in the
  new useDoubleClickConfirm hook (see below).
- components/MasterLockCardChrome.tsx (127 LOC) — cyberpunk card
  decoration: corner accents, the seeded "corner stars" used inside
  the panel (distinct from the fullscreen MasterLockBackdrop), the
  ripple/glow layer and the document-folding gradient. aria-hidden
  throughout; all heavy keyframes gated by useMotionPreference.
- components/MasterLockUnlockForm.tsx (+test, 8 cases) — the unlock
  surface (visual feedback ring + status badge + password input +
  ritual guidance + footer). Pure presentation: no state owned, all
  callbacks parent-supplied. Status badge uses role="alert"; toggle
  exposes aria-pressed.
- components/MasterLockRecoveryForm.tsx (+test, 6 cases) — recovery
  branch (recovery key + new password + confirm + error banner +
  submit). Accepts the full RecoveryFlowState through one `recovery`
  prop so MasterLock doesn't have to thread eight individual values.

New hooks:
- hooks/useMasterPasswordVerify.ts (+test) — owns the debounced
  background verification + the explicit Enter-key submit handler;
  routes failures through the lockout timer and successes through
  the ritual transition + onUnlock.
- hooks/useBiometricAuth.ts (+test) — WebAuthn proof-of-presence
  flow with localised "biometrics verified, password still required"
  copy and graceful NotAllowedError handling. Detection of platform
  authenticator availability is also encapsulated here.
- hooks/useDoubleClickConfirm.ts (+test) — generic "first click arms,
  second click within 500ms confirms" helper, lifted from the
  inline back-to-home button so it can be reused in future
  destructive surfaces.

Cumulative §2.i reduction: 866 → 190 LOC (−676 lines, −78%). Phase 2
§2.i exit criterion ≤350 is now ✅. All Phase 1 invariants remain
green: scripts/check-beta.sh → 27/27, plus lint / typecheck / tests
/ build clean.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 23b1831 — refactor(masterlock): §2.i continued — extract MasterLockRecoveryForm

```
refactor(masterlock): §2.i continued — extract MasterLockRecoveryForm

Lifts the 113-line "forgot password → recovery key → new password"
JSX block out of MasterLock.tsx into a dedicated presentational
component. Pure view: all state lives in `useRecoveryFlow` (extracted
in the previous §2.i kickoff commit) and is threaded through a single
`recovery` prop, so no useState moves alongside.

While moving the markup, polished a few a11y rough edges:

- Each input gains an explicit `aria-label` (the existing `<label>` is
  cosmetic and not associated by `for`/`id`); screen readers now
  announce field purpose without relying on visual ordering.
- The recovery key visibility toggle uses dedicated copy ("Show
  recovery key" / "Hide recovery key") instead of falling back to the
  generic "Show password" string, so AT users can distinguish it from
  the two password toggles below.
- Validation error banner now carries `role="alert"` so it is
  announced when it appears mid-flow.
- All toggle / submit buttons are explicitly `type="button"` so a
  future `<form>` wrapper won't accidentally trigger them on Enter.

Tests: 6 cases (renders + change routing + showKey type switch +
toggle handler binding + role=alert on error + submit binding).

Result: components/MasterLock.tsx drops from 724 → 611 LOC (−16%).
Cumulative §2.i reduction: 866 → 611 (−29%). Remaining gap to the
350-LOC ROADMAP target is ~261 lines, mostly the unlock form
(visual feedback + password input + footer) and the cyberpunk
panel chrome — those will land as follow-up §2.i commits.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### f0d9cd7 — refactor(masterlock): kick off Phase 2 §2.i — extract useLockoutTimer, useRecoveryFlow, MasterLockBackdrop

```
refactor(masterlock): kick off Phase 2 §2.i — extract useLockoutTimer, useRecoveryFlow, MasterLockBackdrop

First step of the MasterLock slimming track in ROADMAP.md Phase 2 §2.i.
Lifts three self-contained concerns out of the 866-line component into
single-responsibility hooks and a reusable presentational helper, each
shipped with a sibling test file (≥5 cases per ROADMAP cross-phase
discipline):

- hooks/useLockoutTimer.ts (+test, 6 cases): "N failed attempts → lock
  for M seconds" ladder with a per-second secondsRemaining countdown.
  Differs from the existing useViewerLockout in two intentional ways
  documented in the hook docstring: (1) exposes secondsRemaining, so
  the badge no longer needs the caller to wire its own setInterval,
  and (2) automatically resets failedAttempts to zero once the lockout
  window elapses, giving the user a fresh budget — that's the original
  MasterLock behaviour, which the Viewer variant deliberately omits.

- hooks/useRecoveryFlow.ts (+test, 8 cases): owns the "forgot password
  → recovery key → new password" branch (isRecoveryMode, recoveryInput,
  newPassword, confirmNewPassword, resetError, showKey, showNewPassword)
  plus the submit handler. Mirrors the original validation rules
  (length-32 normalised key + ≥8-char password with mixed classes +
  confirmation match) and keeps the legacy plain-text recoveryVerifier
  upgrade-on-first-use path so existing users keep working.

- components/MasterLockBackdrop.tsx (+test, 5 cases): fullscreen
  starfield decoration (60 fixed + 20 twinkling stars + nebula
  gradient + dust layer) extracted from the inline JSX. Star positions
  use seeded RNG (createSeededRandom) so they don't shift between
  renders or theme toggles. When the OS prefers reduced motion the
  twinkling/dust animations collapse to static glow via the project
  useMotionPreference hook — important for an authentication screen
  that runs ~80 continuous animations otherwise. aria-hidden keeps the
  decoration out of the AT tree.

Result: components/MasterLock.tsx drops from 866 → 724 LOC (-16%) with
zero behaviour change. The remaining ~374 lines over the 350-LOC
Phase 2 target are JSX-heavy panel chrome (recovery form ~150,
cyberpunk ripples ~60, unlock input ~80, etc.) — those are tracked as
follow-up §2.i tasks (RecoveryForm, UnlockForm, MasterLockPanelChrome)
that this commit explicitly defers so the state-machine extractions
land cleanly first.

Verified locally:
- npm test → all suites green (incl. new 19 cases)
- npm run lint → 0 warnings
- npm run typecheck → clean
- npm run build → succeeds
- scripts/check-beta.sh → 27/27 Phase 1 invariants still pass

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### b468dc1 — refactor(dashboard): kick off Phase 2 §2.h — extract VaultContent, DashboardFooter, useClickOutside

```
refactor(dashboard): kick off Phase 2 §2.h — extract VaultContent, DashboardFooter, useClickOutside

First step of the Dashboard slimming track in ROADMAP.md Phase 2 §2.h.
Pulls three self-contained surfaces out of the 983-line Dashboard.tsx
so the parent can focus on orchestration:

- components/VaultContent.tsx (186 lines): the vault-locked /
  vault-open biome that previously lived inline. Encapsulates the
  unseal affordance, loading state, EntryGrid vs VaultListView pick,
  and the "load more records" pagination button so future Phase 2
  work can iterate on entry rendering without touching Dashboard.
- components/DashboardFooter.tsx (71 lines): the GeometricBoat-driven
  motivational footer + sail-home animation, isolated from the
  dashboard data layer.
- hooks/useClickOutside.ts (+test): generic dropdown closer used by
  the language and export menus. Consolidates two near-identical
  effects from Dashboard.tsx and adds the Escape-key handling the
  inline versions had been missing — a small a11y win on top of the
  refactor.

Result: Dashboard.tsx drops from ~983 to ~635 lines (-35%) without
any behavior change. Tests, lint, typecheck and build remain green.
This commit lands AFTER the v1.0.5-beta.1 tag so Phase 1 stays a
clean cut; subsequent Phase 2 commits will keep chipping at the
remaining ~285 lines until Dashboard.tsx clears the 350-line bar.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 4398fca — chore(ops): add Docker, CI, beta validator, ROADMAP and EVALUATION

```
chore(ops): add Docker, CI, beta validator, ROADMAP and EVALUATION

- scripts/check-beta.sh codifies every Phase 1 invariant from ROADMAP
  as PASS/FAIL gates plus quality-gate hooks (lint / typecheck / test
  / build); SKIP_RUN and SKIP_GATES env vars allow targeted reruns.
- ROADMAP.md (bilingual) is the authoritative phase plan: Phase 1
  exit checklist, Phase 2 first-wave (~30 days), Phase 3 long-term
  investments, plus working agreements and KPI targets.
- EVALUATION.md captures the 12-dimension production-readiness score
  card that drives the roadmap deltas.
- Dockerfile + docker-compose.yml + .dockerignore deliver a
  reproducible runtime image; deploy/nginx.conf.example documents the
  recommended reverse-proxy layout (HSTS, gzip, immutable cache).
- .github/workflows/ci.yml runs lint, typecheck, test, build on every
  push / PR so regressions are caught before tagging.
- README.md is updated with the new Phase 1 capabilities and points
  contributors to ROADMAP for next steps.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 9a0fd80 — refactor: extract Viewer/Dashboard/Backup hooks and reusable panels

```
refactor: extract Viewer/Dashboard/Backup hooks and reusable panels

Decompose the largest screens into single-responsibility hooks and
panel components so future Phase 2 work can keep individual files
under the 400-line guard rail. No behavior change beyond what the
extracted code already encapsulates; existing component-level tests
continue to pass and new unit tests are added for every extracted
hook / panel.

New hooks (each with sibling .test.ts):
- useViewerStars, useViewerAccess, useViewerLockout
- useMorningStarPipeline, useNowTick
- useBackupImport, useBackupReminder
- useAttachmentUpload, useGuidingStarsEditor
- useDashboardSecurity, useDashboardVault

New components / panels:
- TypewriterText (extracted from Viewer/MasterLock duplicate)
- VaultUnlockModal, BackupImportConfirmModal, BackupReminderBanner
- ViewerReadingPanel, ViewerSealedPanel, ViewerStarfield
- viewerMarkdown (markdown rendering rules pulled out of Viewer.tsx)

Other changes:
- App.tsx wires the new hooks; index.tsx initialises web-vitals.
- services/dashboardImport (+test) is the symmetric counterpart of
  dashboardExport, used by useBackupImport.
- lib/markdownSchemes (+test) centralises the allowed markdown tag
  schemes for sanitisation; lib/vitals routes web-vitals to Sentry.
- Existing service / hook / component tests are extended where the
  refactor changed seams; vitest / playwright / tsconfig adjustments
  reflect the new module layout.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### ad5a812 — feat(ai): show Morning Star AI disclaimer in all seven locales

```
feat(ai): show Morning Star AI disclaimer in all seven locales

Add a persistent disclaimer banner above every Morning Star analysis
result clarifying that the output is generated by an LLM, is meant for
self-reflection only, and is not a substitute for professional advice
(medical, legal, financial). The banner uses a single i18n key
(aiDisclaimer) translated across zh / en / ja / ko / fr / es / de so
non-English users see the same protection - this is a prerequisite for
distribution under the EU AI Act and California SB-1001.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 8a8c13e — feat(brand): ship OG image, maskable PWA icons and Twitter card meta

```
feat(brand): ship OG image, maskable PWA icons and Twitter card meta

- public/og.png is the 1200x630 Open Graph image referenced from
  index.html; public/icon-192.png and public/icon-512.png are
  maskable PNGs reachable from manifest.json so PWA installs render a
  proper homescreen tile on Android and iOS.
- index.html gains the og:* and twitter:card meta tags pointing at the
  new asset, plus an apple-touch-icon link. The viewport meta also
  drops maximum-scale=1.0 / user-scalable=no so users can pinch-zoom
  (WCAG 1.4.4 fix tracked under Phase 1 a11y), and font / style blocks
  are reformatted by Prettier.
- manifest.json declares both the 192 and 512 icons as
  purpose="maskable any" and adds short_name / start_url / display
  defaults so install prompts have everything they need.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### a6d934e — chore(deps): wire Sentry/axe/web-vitals, add Prettier, drop @supabase

```
chore(deps): wire Sentry/axe/web-vitals, add Prettier, drop @supabase

- Replace the placeholder lint script with eslint . --max-warnings=0 and
  add lint:fix, format and format:check; the typecheck script is kept
  as the standalone tsc --noEmit gate.
- Adopt @sentry/node for the server runtime, web-vitals for client SLI
  collection, and @axe-core/playwright for the new a11y E2E spec.
- Add the ESLint + jsx-a11y + react / react-hooks / unused-imports
  toolchain alongside Prettier (with config + ignore files) so the
  Phase 1 invariant scripts can enforce a consistent style baseline.
- Drop @supabase/supabase-js: never imported anywhere in source, just
  inflating the lockfile and the Vite manualChunks.
- Add license, repository and author metadata to package.json so the
  package can be linked from the GitHub release page.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 8e8e83e — docs(legal): add LICENSE, PRIVACY, TERMS, SECURITY and CHANGELOG

```
docs(legal): add LICENSE, PRIVACY, TERMS, SECURITY and CHANGELOG

Adopt MIT for the codebase (see LICENSE) and ship the four governance
documents required to open the project to public beta users:

- PRIVACY.md describes the local-first storage model, what data leaves
  the device when the AI proxy is invoked, log scrubbing and retention.
- TERMS.md frames the Morning Star output as informational only - not
  medical, legal or financial advice - and outlines abuse policy.
- SECURITY.md gives a coordinated-disclosure channel for vulnerabilities
  and the supported version window.
- CHANGELOG.md follows Keep a Changelog and records every Phase 1
  invariant brought online for v1.0.5-beta.1.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### dc1ef31 — feat(a11y): adopt jsx-a11y, focus-visible, useReducedMotion and axe spec

```
feat(a11y): adopt jsx-a11y, focus-visible, useReducedMotion and axe spec

- Add hooks/useMotionPreference (thin wrapper around motion/react's
  useReducedMotion) so animation-heavy components have a single shared
  helper to opt out of large transforms when the OS prefers reduced
  motion.
- CyberButton's "as=div" branch now exposes role=button, tabIndex=0
  and Enter/Space onKeyDown so keyboard users can activate it; the
  primary button also keeps focus-visible-only outline.
- index.css ships a global :focus-visible style that respects both
  themes, and reins in motion-heavy keyframes inside a
  prefers-reduced-motion media query.
- eslint.config.mjs is the new flat ESLint config: TypeScript +
  react + react-hooks + jsx-a11y + unused-imports rules wired with
  --max-warnings=0 so a11y regressions fail CI.
- e2e/a11y.spec.ts runs @axe-core/playwright against the cover and
  onboarding shells; serious / critical violations turn the suite red.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### a717bcc — feat(security): harden auth, AI proxy and storage for public beta

```
feat(security): harden auth, AI proxy and storage for public beta

- Bump PBKDF2 default to 600,000 iterations with min/max guards and
  VECTOR_PBKDF2_ITERATIONS env override; verifier still accepts older
  pbkdf2-sha256:v1 hashes so existing users sign in without re-encryption.
- Stop mirroring passwordHash / passwordSalt to localStorage; existing
  mirrored values are scrubbed during diary load and only IndexedDB
  retains the verifier going forward.
- Replace the unpkg CDN reference in PdfAttachmentViewer with a same-
  origin asset bundled by Vite (manualChunks keeps the pdf chunk).
- Add server/ utilities for the AI proxy: promptEnvelope wraps user
  content in fixed delimiters and rejects obvious instruction-injection
  keywords; aiProxyAuth gates /api/morning-star with origin allowlist
  plus optional bearer; scrubLog redacts secrets from structured logs;
  observability initialises @sentry/node when SENTRY_DSN is present.
- server.ts now binds 127.0.0.1 by default (warns on 0.0.0.0), enables
  helmet with strict CSP in production, returns request-id-correlated
  errors, ships dist/* with immutable cache headers, and installs a
  SIGTERM/SIGINT graceful shutdown.
- geminiService routes through the new envelope so untrusted content
  cannot hijack the Morning Star persona prompt.
- .env.example documents the new tunables (PBKDF2 iterations, proxy
  bearer, allowed origins) and removes leftover real-key style hints.

Co-authored-by: Cursor <cursoragent@cursor.com>

```

### 9ad7087 — chore(repo): tighten .gitignore for build artefacts and IDE state

```
chore(repo): tighten .gitignore for build artefacts and IDE state

Filter out coverage/, test-results/, playwright-report/ (Vitest and
Playwright outputs) and .cursor/ (IDE local plans, transcripts and
project metadata) so the public repository stays free of generated
or environment-specific noise.

Co-authored-by: Cursor <cursoragent@cursor.com>

```
