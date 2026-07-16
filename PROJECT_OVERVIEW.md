# PROJECT_OVERVIEW — VECTOR 矢量人生经验进化系统

Snapshot: 2026-07-13.

This document describes the current project shape after the product cleanup pass. Older roadmap, changelog, and postmortem files may still mention retired experiments; treat those as historical records.

## 1 · Current pitch

VECTOR is a local-first, zero-knowledge personal experience system.

The current product spine is:

```text
Now capture
  → Past review and management
  → Future action transformation
  → Avatar record assistance and summary support
  → Dashboard system governance / ordinary backup
```

The project no longer presents Morning Star, Memoir, Echo Chamber, delayed letters, cross-device migration packages, trusted devices, or advanced signed backup as active product surfaces.

## 2 · Main surfaces

| Surface | Purpose |
| --- | --- |
| Now | Primary creation path for new text, image, video, link, tag, and avatar-assisted records |
| Past | Responsive record repository for timeline review, search, archive access, principle work, and record management |
| Future | Lightweight transformation surface that turns records and principles into trends and next-action prompts |
| Avatar | Conversational record-assistance and summary surface built around the user's existing Past context |
| Dashboard | System hub for global status, quick capture, backup/import/export, settings, security, recovery, and license controls |
| Viewer | Reading, sharing, archiving, deleting, container movement, and locked-entry access |
| Pricing | Subscription/license surface with current product capabilities only |
| Server | Express backend for health, records API, avatar summary, model listing, and billing |

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

The ordinary backup schema is intentionally light:

```json
{
  "type": "vector-vault-backup",
  "schemaVersion": 1,
  "version": "...",
  "exportedAt": "...",
  "entryCount": 0,
  "entries": []
}
```

It is meant for casual users who need a simple export/import path. It does not carry retired AI-persona or migration payloads.

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
npx vitest run services/dashboardImport.test.ts services/dashboardExport.test.ts hooks/useDashboardExport.test.ts hooks/useBackupImport.test.ts
npx vitest run services/sampleEntries.test.ts components/PastEntryPreview.test.tsx components/PastEntryText.test.tsx components/PastEntryMedia.test.tsx features/mobile/PastRepository.test.tsx components/ViewerReadingPanel.test.tsx components/ShareCard.test.tsx services/quotaService.test.ts
```

Use Playwright smoke tests when changing navigation, responsive layouts, or browser-only storage behavior.

## 8 · Historical archive

Historical roadmap, evaluation, postmortem, and product-vision documents are kept for project memory. They may describe retired experiments and should not override current code or current product docs.

Start here: [docs/archive/README.md](./docs/archive/README.md).
