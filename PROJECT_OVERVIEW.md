# PROJECT_OVERVIEW — VECTOR 矢量人生经验进化系统

Snapshot: 2026-09-22.

This document describes the current project shape after the product cleanup pass. Older roadmap, changelog, and postmortem files may still mention retired experiments; treat those as historical records.

## 1 · Current pitch

VECTOR is a local-first personal experience and growth system.

The current product spine is:

```text
Now capture
  → Past review and principle distillation
  → Future design and practice
  → Avatar self-understanding: about me, patterns, changes
  → Settings: complete backup and reliable recovery
```

The project no longer presents Morning Star, Memoir, Echo Chamber, delayed letters, cross-device migration packages, trusted devices, or advanced signed backup as active product surfaces.

## 2 · Main surfaces

| Surface   | Purpose                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now       | Primary creation path for new text, image, video, link, tag, and avatar-assisted records                                                          |
| Past      | Responsive record repository for timeline review, search, archive access, principle work, and record management                                   |
| Future    | Design visions, goals and action plans; record action outcomes in practice                                                                        |
| Avatar    | Conversation and self-understanding through About me / My patterns / My changes; references canonical records rather than duplicating their lists |
| Dashboard | A lightweight access point to settings, recovery, security, and license controls; low-frequency data continuity stays out of daily work           |
| Viewer    | Reading, sharing, archiving, deleting, container movement, and locked-entry access                                                                |
| Pricing   | Subscription/license surface with current product capabilities only                                                                               |
| Server    | Express backend for health, records API, avatar summary, model listing, and billing                                                               |

## 3 · Codebase map

```text
.
├── App.tsx                         # Top-level app composition and state routing
├── server.ts                       # Express server: health, records, avatar, models, billing
├── components/                     # Desktop UI, viewer, dashboard, settings, pricing
├── features/now/                   # Now flow, material capture, avatar chat rules
├── features/mobile/                # Mobile shell, Past repository, responsive navigation
├── hooks/                          # App boot/routing/storage/viewer/dashboard hooks
├── services/                       # Storage, backup, import/export, security, license, checkout
├── lib/                            # Routing rules, markdown safety, pricing, entry/media helpers
├── i18n/locales/                   # Translation maps
├── e2e/                            # Playwright smoke and app specs
├── docs/                           # Historical docs and current supporting docs
├── deploy/                         # Nginx reference config
├── Dockerfile / docker-compose.yml
└── .github/workflows/ci.yml
```

## 4 · Active data model

Core active entities:

- `DiaryEntry`
- `Principle`
- `Container`
- `Attachment`
- `EntryMaterial`
- future visions, goals and action plans
- understandings, confirmed memory and source relationships
- license / install metadata

Retired entities were removed from the runtime model:

- custom personas
- memoirs
- long-term memoir memories
- pending letters
- echo-chamber entries
- trusted devices
- migration packages
- old Editor draft state

## 5 · Backup posture

Full vault backups use schema v3, preserving records, principles, actions, future plans, understandings, memory and their relationships. Readers retain v2 and legacy record-backup compatibility. See [data ownership and linkage](docs/data-linkage.md) for current rules.

AI requests may send the selected context to the configured model provider; local storage does not mean external AI processing stays on device.

## 6 · Server posture

Active server endpoints include:

- `GET /api/health`
- record APIs under `/api/v1/records`
- `POST /api/v1/avatar/summarize`
- `GET /api/models`
- billing / checkout / license routes when Stripe is configured

Server AI configuration now uses generic `AI_*` names. Old `MORNING_STAR_*` env names may still be read as compatibility fallback, but new deployments should use:

- `AI_ALLOWED_ORIGINS`
- `AI_ACCESS_TOKEN`
- `AI_RATE_LIMIT_WINDOW_MS`
- `AI_RATE_LIMIT_MAX`

## 7 · Validation checklist

Recommended checks before handoff:

```bash
npm run typecheck
npx vitest run services/appStateMachine.test.ts lib/appEntryRoutes.test.ts lib/appPathRules.test.ts features/mobile/mobileRoutes.test.ts
npx vitest run services/dashboardImport.test.ts hooks/useDashboardExport.test.ts hooks/useBackupImport.test.ts
npx vitest run services/sampleEntries.test.ts components/PastEntryPreview.test.tsx components/PastEntryText.test.tsx components/PastEntryMedia.test.tsx features/mobile/PastRepository.test.tsx components/ViewerReadingPanel.test.tsx components/ShareCard.test.tsx services/quotaService.test.ts
```

Use Playwright smoke tests when changing navigation, responsive layouts, or browser-only storage behavior.

## 8 · Historical archive

Historical roadmap, evaluation, postmortem, and product-vision documents are kept for project memory. They may describe retired experiments and should not override current code or current product docs.

Start here: [docs/archive/README.md](./docs/archive/README.md).
