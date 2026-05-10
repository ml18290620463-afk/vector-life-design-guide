# PROJECT_OVERVIEW — VECTOR 矢量人生启航日志

> One-document tour for evaluators. Read top-to-bottom in 15 minutes
> for a full picture, or jump to any section.

**Snapshot**: 2026-05-03 · 33 commits ahead of `origin/main` (Phase
1 + Phase 2 + Phase 3 all landed locally; push pending GitHub PAT
`workflow` scope fix).

---

## 1 · 30-Second Pitch

VECTOR is a **local-first, zero-knowledge** journal for "life-design"
reflection. Three things make it different:

1. **Local-first encryption** — everything is stored encrypted in
   IndexedDB with PBKDF2-SHA256 600k (Argon2id verifier behind a
   feature flag). No cloud sync, no telemetry. The user's recovery
   key is the only escape hatch.
2. **Morning Star AI reflection** — the user picks 1–3 "guiding
   stars" (Marcus Aurelius / Camus / Borges / Naval / Musk / Laozi /
   Aurelius / custom) and the LLM writes a multi-perspective
   "letter" back. AI runs through a server-side proxy with
   prompt-injection envelope + per-installation rate limiting; the
   user's API key never leaves the server.
3. **PWA + offline-aware** — installable to homescreen via PWA
   manifest, OS dark/light theme detection, `prefers-reduced-motion`
   honored throughout, 7-language i18n with drift detector in CI.

---

## 2 · Where to Start (5-minute tour)

| Order | File                           | What you'll learn                                                                                                                |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `README.md`                    | How to install + run locally                                                                                                     |
| 2     | `EVALUATION.md`                | Multi-dimension production-readiness scorecard (the original brief that drove everything below)                                  |
| 3     | `ROADMAP.md`                   | Phase 1/2/3/4 charter, with checkboxes that mirror commit reality (37/61 ✅, 24 unticked are intentional v1.x post-launch items) |
| 4     | `CHANGELOG.md`                 | Per-commit highlights for every Phase since v1.0.5 baseline                                                                      |
| 5     | `docs/phase-3-postmortem.md`   | Honest "what we shipped vs what we set out to do" delta + open follow-ups                                                        |
| 6     | `docs/security/argon2-eval.md` | Argon2id GO/NO-GO writeup with benchmark numbers                                                                                 |

---

## 3 · Codebase Map

```
.
├── App.tsx                       # Top-level router (5 AppStates)
├── server.ts                     # Express AI proxy (helmet, rate limit,
│                                  Sentry, SIGTERM, prompt envelope)
├── server/                       # Server-only modules
│   ├── aiProxyAuth.ts            # Origin allowlist + bearer
│   ├── promptEnvelope.ts         # Prompt injection guard
│   ├── observability.ts          # @sentry/node init
│   └── scrubLog.ts               # Secret/PII redaction
├── components/  (~70 files)      # React components, all ≤ 350 LOC
├── hooks/       (~30 files)      # Custom hooks (mostly state machines)
├── services/    (~30 files)      # Domain logic (security, storage,
│                                  filters, grouping, migration, Argon2id)
├── lib/                          # Utils (designTokens, vitals, palette,
│                                  random, error, markdownSchemes)
├── i18n/locales/                 # 7-language translation map
├── e2e/                          # Playwright (api / app / backup /
│                                  a11y / visual)
├── scripts/                      # check-beta.sh, lint-tokens.mjs,
│                                  i18n-diff.ts, argon2-bench.ts
├── .storybook/                   # Storybook 10 (preview + addon-a11y +
│                                  addon-themes)
├── docs/                         # security/argon2-eval.md +
│                                  phase-3-postmortem.md
├── deploy/nginx.conf.example     # Reverse proxy reference
├── Dockerfile / docker-compose.yml
└── .github/workflows/ci.yml      # CI: lint + typecheck + test + build
```

---

## 4 · Phase-by-Phase Highlights

### Phase 1 — Public Beta Readiness (9 commits)

Tag: `v1.0.5-beta.1` exists locally (annotated, not yet pushed
because of PAT issue). Every Phase 1 invariant validated by
`scripts/check-beta.sh` (28/28 PASS).

| Section       | Highlight                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security      | PBKDF2 100k → 600k (env-overridable, with min/max guards); hash mirror removed from localStorage; PDF worker localised; prompt envelope; helmet + Origin allowlist + optional bearer; SIGTERM/SIGINT graceful shutdown; @sentry/node lazy init |
| A11y          | viewport `maximum-scale=1.0` removed; `eslint-plugin-jsx-a11y --max-warnings=0`; global `:focus-visible`; `useReducedMotion` adopted via `useMotionPreference`; axe-playwright spec on cover/onboarding                                        |
| Legal         | LICENSE / PRIVACY / TERMS / SECURITY / CHANGELOG; package.json metadata; Morning Star AI disclaimer in all 7 locales                                                                                                                           |
| Observability | server-side Sentry; SIGTERM; immutable cache for `dist/assets/*`; web-vitals → Sentry custom metrics                                                                                                                                           |
| Brand         | 1200×630 OG image; 192/512 maskable PNG icons; OG/Twitter card meta                                                                                                                                                                            |

### Phase 2 — Code Health (12 commits, 6 component split tracks)

| Component              |   Before |    After | Reduction |
| ---------------------- | -------: | -------: | --------: |
| `Viewer.tsx`           |     1247 |      312 |      −75% |
| `MasterLock.tsx`       |      866 |      190 |      −78% |
| `SettingsPanel.tsx`    |      988 |      282 |      −71% |
| `ArchiveVault.tsx`     |      805 |      143 |      −82% |
| `Dashboard.tsx`        |      983 |      350 |      −64% |
| `StatisticsWidget.tsx` |      354 |      124 |      −65% |
| **Total**              | **5243** | **1413** |  **−73%** |

Plus: 30+ extracted hooks (each with ≥5 test cases), 20+ extracted
sub-components, all under 350 LOC. Coverage thresholds ratchet from
71/47 → 78/54 → today's measured 83.67/62.21.

### Phase 3 — Long-Term Investments (10 commits)

| ID     | Item                                                       | Where to look                                                                                 |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| §3.a   | Design tokens + lint scoreboard + first-wave migration     | `lib/designTokens.ts`, `index.css` `@theme` block, `scripts/lint-tokens.mjs`                  |
| §3.b   | Storybook 10 + 11 stories                                  | `.storybook/`, `components/*.stories.tsx`                                                     |
| §3.c   | Seven-sage portraits                                       | **Pending** — external commission                                                             |
| §3.d   | i18n drift detector + CI gate                              | `scripts/i18n-diff.ts` (also wired into `check-beta.sh`)                                      |
| §3.e   | Argon2id PoC + benchmark + writeup                         | `services/argon2idPoc.ts`, `scripts/argon2-bench.ts`, `docs/security/argon2-eval.md`          |
| §3.e-2 | Argon2id verifier wired into `verifyPassword` (flag-gated) | `services/securityService.ts:188`, 8 new test cases                                           |
| §3.f   | Visual regression with seeded baselines                    | `e2e/visual.spec.ts`, `e2e/seedHelpers.ts`, `e2e/visual.spec.ts-snapshots/` (6 PNG baselines) |
| §3.g   | PWA install banner + dismissal hook                        | `components/PwaInstallBanner.tsx`, `hooks/usePwaInstallPrompt.ts`                             |
| §3.h   | Privacy-first ShareCard PNG export                         | `components/ShareCard*.tsx`, `hooks/useShareCard*.ts`, `lib/{canvas,shareCard}Palette.ts`     |

---

## 5 · Numbers at a Glance

```text
Source LOC           ~22 000  (TS/TSX, excluding tests/stories/dist)
Test LOC             ~12 000  (vitest + playwright)
Test cases             ~600   (vitest)
                        + 14   (playwright e2e)
Coverage             83.67% lines / 62.21% branches
                          (vitest.config.ts threshold floor 78/54)
Build size           dist/    3.9 MB (with code splits, top chunk 327kB)
Bundle on disk       node_modules ~489 MB
Dependencies            22   runtime
                        29   dev
i18n locales            7   (zh / en / ja / ko / fr / es / de)
ROADMAP checkboxes   37 / 61  ticked (61% — remainder = post-Phase-3
                                 product / Phase 4 items)
check-beta.sh        28 / 28  invariants PASS + 4/4 quality gates
ESLint warnings        0   (--max-warnings=0)
TypeScript errors      0
Component files        ~70  (every one ≤ 350 LOC after Phase 2)
Hook files             ~30  (each with sibling test)
Service files          ~30
```

---

## 6 · Where to Look First (Evaluator Checklist)

### A · Code quality (15 min)

1. `services/securityService.ts` — auth crypto, the most security-sensitive
   file. Look for: PBKDF2 600k default with backwards-compat verify;
   constant-time compare; Argon2id branch flag-gated; `needsRehash`
   versioning logic.
2. `server.ts` + `server/*.ts` — AI proxy. Look for: helmet CSP (prod);
   prompt envelope wrapping; Origin allowlist; SIGTERM; structured
   logging via `scrubLog`.
3. `components/Viewer.tsx` (312 LOC) + the 5 panels it composes
   (`ViewerSealedPanel`, `ViewerReadingPanel`, `ViewerStarfield`,
   `ViewerActionFooter`, `ViewerAttachmentPanel`) — the canonical
   example of how the 6 monoliths got split.
4. `hooks/useDashboardGroupedEntries.ts` + sibling test — pattern
   for the 30+ extracted hooks (single-purpose, ≥5 cases each).

### B · Security posture (10 min)

1. `docs/security/argon2-eval.md` — full GO/NO-GO writeup with
   benchmark numbers. The decision rationale is honest about both
   the WIN (memory-hardness) and the COSTS (52 kB wasm + low-end
   Android latency).
2. `services/promptEnvelope.ts` (and its test) — how user content
   gets wrapped before it hits the LLM.
3. `services/scrubLog.ts` — how secrets/PII are stripped from
   structured logs.
4. `PRIVACY.md` — what data leaves the device, when, and how.

### C · Test discipline (5 min)

1. `scripts/check-beta.sh` — the 28-invariant + 4-gate validator
   that has to pass before any "release" tag.
2. `vitest.config.ts` — coverage thresholds with detailed history
   comments showing the ratchet (71/47 → 78/54 over 5 split waves).
3. `e2e/visual.spec.ts` — visual regression suite with 6 baselines.
4. Sample of test files: `services/securityService.test.ts` (19
   cases including the new Argon2id branch), `hooks/useLockoutTimer.test.ts`
   (vitest fake-timer pattern), `components/MasterLockBackdrop.test.tsx`
   (a11y + decorative-component test pattern).

### D · UX / design (10 min)

1. `lib/designTokens.ts` + `index.css` `@theme` block — token
   catalogue (color / spacing / radius / shadow / motion / z-index
   buckets); run `npm run lint:tokens` for the scoreboard.
2. `components/CoverScreen.tsx` + its `.stories.tsx` — landing
   experience, three modes (warp / terminal / static).
3. `components/MorningStarPanel.tsx` — multi-persona AI reply UX
   with metric radar.
4. `components/ShareCard.tsx` + its modal — privacy-first PNG export.
5. `i18n/locales/zh.ts` + `en.ts` — translation depth.

### E · Process discipline (5 min)

1. `git log --oneline origin/main..HEAD` — the 33 commits should
   read as a clean Phase 1 → 2 → 3 narrative. Every commit body has
   "what / why / how verified" structure.
2. `ROADMAP.md` — checkboxes were rigorously synchronised to commit
   reality in two dedicated docs commits (b388588 + 5b8c849).
3. `docs/phase-3-postmortem.md` — honest retro at every phase
   boundary, per the cross-phase agreement in ROADMAP.

---

## 7 · Run / Inspect Commands

```bash
# Install (one-time, ~2 min)
npm install
cp .env.example .env.local
# fill OPENROUTER_API_KEY in .env.local (free key at https://openrouter.ai/keys)

# Dev server (Vite + Express AI proxy on :3000)
npm run dev

# Run all gates (28/28 invariants + lint + typecheck + test + build)
bash scripts/check-beta.sh

# Individual gates
npm test                    # ~600 vitest cases, <2s
npm run typecheck
npm run lint                # eslint --max-warnings=0
npm run lint:tokens         # design token scoreboard
npm run i18n:diff           # 7-locale drift detector (soft mode)
npm run build               # production bundle

# Storybook (component playground)
npm run storybook           # → http://localhost:6006

# E2E (5 specs: api / app / backup / a11y / visual)
npm run test:e2e

# Argon2id benchmark (Phase 3 §3.e)
npm run bench:argon2
```

---

## 8 · Open Items (transparency)

Per `docs/phase-3-postmortem.md` §6:

| #   | Item                                                     | Owner               | Why it's not done                                                                |
| --- | -------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| 1   | ~~§3.e-2 Argon2id verifier wiring~~                      | —                   | ✅ DONE (commit `01b922e`)                                                       |
| 2   | i18n translator backlog (232 keys across ja/ko/fr/es/de) | translator queue    | Not engineering — drift script in CI catches new additions                       |
| 3   | First-day empty-state with sample reflections            | Phase 4 §4.a-1      | Substantial UX work; consolidated into Phase 4 activation track                  |
| 4   | Seven-sage portrait illustrations                        | external commission | Asset-only                                                                       |
| 5   | PWA install banner mounted in App                        | —                   | ✅ already wired in `Dashboard` via `DashboardOverlays` (see `Dashboard.tsx:85`) |

ROADMAP unchecked items (24/61) all map to either Phase 4
activation tracks, post-launch v1.x improvements, or items
explicitly deferred to a translator/designer queue.

---

## 9 · Known Limitations / Honest Caveats

1. **PAT push pending**: The 33 local commits cannot be pushed to
   `origin/main` until the user updates their GitHub Personal Access
   Token to include the `workflow` scope. The push is blocked
   server-side; the local repository is in good shape.
2. **Argon2id minter still PBKDF2**: Hash MINTING stays on PBKDF2
   even with the §3.e-2 flag on. Promotion to default minter is
   tracked as Phase 4 §4.b-2; rollout plan in
   `docs/security/argon2-eval.md`.
3. **Storybook stories ≠ test coverage**: `*.stories.tsx` files
   are excluded from vitest coverage (they're for the Storybook
   addon-a11y review path, not unit tests). The component itself
   still has its sibling `.test.tsx`.
4. **Visual regression baselines are macOS-darwin**: Cross-OS CI
   would need `--update-snapshots` once and then platform-pinned
   baselines per worker. Currently CI runs only chromium-darwin so
   tolerance (2% max diff pixel ratio) is fine.
5. **No real users yet**: Everything in this snapshot is shipped to
   `main` locally but not yet exposed to a public user base.
   `v1.0.5-beta.1` is intentionally a public-beta tag, not a 1.0
   release.

---

## 10 · Contact / Continuity

- All commits follow the `<type>(scope): <subject>` style and carry
  a body explaining "what / why / how verified". `git log` is
  designed to be read as documentation.
- Every phase ended with a postmortem (`docs/phase-N-postmortem.md`)
  per the cross-phase agreement in ROADMAP §7.
- Every test file colocated with its source file. `npm test` should
  be your first port of call when grokking unfamiliar code.

— end of overview —
