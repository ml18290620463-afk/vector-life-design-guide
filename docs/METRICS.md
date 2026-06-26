# Quantitative snapshot — 2026-05-03 15:42 CST · v1.1.0

> Refreshed at Phase 4 close. The Phase 3 snapshot is in
> `git log --diff-filter=D -- docs/METRICS.md` if you need it.

## Source size

```text
components/    122 files (incl. tests + stories)
hooks/          65 files (incl. tests)
services/       32 files (incl. tests)
lib/            17 files (incl. tests)
server/          8 files (incl. tests)
i18n/locales/    7 locales
```

## Tests

```text
vitest cases:        631   (was 537 at Phase 3 close — Δ +94)
vitest test files:   104   (was 97  at Phase 3 close — Δ +7)
playwright specs:    5 files (api / app / a11y / backup / visual)

Vitest threshold floor: lines >= 82  branches >= 61
ROADMAP §3 target:      branches >= 60   <- exceeded with margin

Phase 4 test additions (94 cases, 7 files):
  server/aiProviders.test.ts          +23  (W2.3 + W2.4 streaming)
  services/securityService.test.ts    + 9  (W2.1 minter quadrants)
  services/geminiService.test.ts      + 6  (W2.4 client SSE)
  components/SettingsArgon2idToggle   + 7  (W2.2 toggle UI)
  components/CommandPalette           + 9  (W3.1 cmdk palette)
  lib/blobUrlCache.test.ts            + 8  (W3.3 refcount cache)
  hooks/useAttachmentBlobUrl.test.ts  + 6  (W3.3 React binding)
  lib/pwaRegister.test.ts             + 4  (W3.2 SW status singleton)
  hooks/useMorningStarPipeline        + 1  (W2.4 streamingPreview seed)
```

## Big-component reduction (Phase 2 §2.g–§2.l, unchanged through Phase 4)

```text
Component                          Before    After    Δ
--------------------------------   ------    -----    -----
components/Viewer.tsx                1247          324   -75%
components/Dashboard.tsx              983          350   -64%
components/MasterLock.tsx             866          190   -78%
components/SettingsPanel.tsx          988          282   -71%
components/ArchiveVault.tsx           805          143   -82%
components/StatisticsWidget.tsx       354          124   -65%
TOTAL                                5243         1413   -73%

server.ts                              471         362   -23%   (Phase 4 W2.3)

All six big components stay <= 350 LOC (the ROADMAP §0.1 ceiling).
Phase 4 added one new "shrink": server.ts dropped to 362 LOC after
the W2.3 aiProviders extraction.
```

## Build (dist/assets, top 8 by raw size)

```text
   462831  pdf-*.js              (PDF.js viewer, lazy-loaded)
   391459  index-*.js            (main app + cmdk + pwaRegister + Argon2id glue)
   216615  index.esm-*.js        (Sentry SDK chunk)
   214430  react-*.js            (React + scheduler + react-dom)
   191513  Viewer-*.js           (lazy: Viewer + ShareCard + MorningStarPanel)
   128292  motion-*.js           (motion/react, animation library)
    35965  icons-*.js            (lucide-react)
    27290  index-*.js            (Editor lazy chunk)

woff2 files:                  11   (W4.2 self-hosted, latin + latin-ext only)
PWA precache entries:         44   (W3.2 service worker, ~3.5 MiB on disk)
PWA SW + workbox runtime:    dist/sw.js + dist/workbox-*.js
```

Bundle delta vs Phase 3 close:

- main `index.js` +6 kB gz from cmdk (W3.1).
- `motion`, `react`, `icons`, `pdf` chunks unchanged.
- Sentry chunk slightly larger (SDK update during W1.2 distribution
  switch; offset by removing the `Sentry.captureMessage` glue code).
- New: 11 woff2 files (≈220 kB on disk), `dist/sw.js`,
  `dist/workbox-*.js` (≈12 kB gz, lazy-loaded once).

## Git state

```text
Total commits on main:           51
Commits ahead of origin/main:    48   (waiting on W1.1 PAT scope)
Annotated tags on trunk:          2   (v1.0.5-beta.1, v1.1.0)
```

## Quality gates (today, run on this snapshot)

```text
scripts/check-beta.sh                                  PASS=28  FAIL=0
npm run lint   (--max-warnings=0)                      clean
npm run typecheck                                      clean
npm run build                                          clean
npm test                                               104 files / 631 cases pass
npm audit --omit=dev --audit-level=high                0 vulnerabilities
                                                       (W4.4 hard-gated in CI)
```

## Translation coverage

```text
Reference locale:                zh
Active locales:                  zh + en + ja + ko + fr + es + de  (7 total)
i18n drift entries (soft mode):  357 missing keys across 6 non-zh locales
                                 (translator backlog inherited from Phase 3;
                                  Phase 4 added 0 NEW drift)
i18n drift entries (strict):     357 (same — strict mode would block CI;
                                  ROADMAP target is to clear this in §4.c-4)
```

## Feature flags currently shipped (`localStorage` keys)

```text
vector_argon2_verify              §3.e-2  Argon2id verifier branch
vector_argon2_minter              §W2.1   Argon2id default minter
                                  (verify ≥ mint enforced in code)
vector_morning_star_stream        §W2.4   Morning Star SSE streaming
vector_share_card_options         §3.h    Share card privacy toggles
vector_last_backup_at             §2.d    Backup recency banner trigger
vector_pwa_install_dismissed_at   §3.g    PWA install banner dismissal
```

All flags routed through `services/browserStorage.ts` per the
cross-phase agreement.
