# Lighthouse Audit Harness — Phase 4.5 §D

> **Status:** SHIPPED — default-on Phase 4.5 §D (2026-05-04).
> **Author:** vector-life-design-guide perf WG
> **Mobile / desktop budget:** ≥ 90 across all four categories
> (performance, accessibility, best-practices, seo).

This document is the engineer-facing reference for the Lighthouse
audit harness shipped in Phase 4.5 §D and the optimisations that
brought the mobile performance score from a baseline **77 → 91**.

---

## 1 · How to run

```bash
# Build the production bundle first (audit needs `dist/`).
npm run build

# Run the audit. Boots `vite preview` on :4173, runs Lighthouse in
# both mobile + desktop modes, exits non-zero if any category
# drops below the budget in `lighthouse-budget.json`.
npm run audit:lighthouse

# Informational only (never exits non-zero):
npm run audit:lighthouse:soft

# Single form factor:
node scripts/lighthouse-audit.mjs --form-factor=mobile
```

HTML + JSON reports land in `lighthouse-reports/` (gitignored).
Open `mobile.html` / `desktop.html` in any browser for the full
breakdown.

The harness is also wired into `scripts/check-beta.sh` as an
**opt-in** check (Lighthouse adds ~25 s to a check-beta run, so
it stays off by default). Enable with:

```bash
RUN_LIGHTHOUSE=1 bash scripts/check-beta.sh
```

## 2 · Budget config

`lighthouse-budget.json` at repo root:

```json
{
  "performance": 90,
  "accessibility": 90,
  "best-practices": 90,
  "seo": 90
}
```

Bumping the floors here is the **single source of truth** for the
audit gate. The script (`scripts/lighthouse-audit.mjs`) silently
falls back to `90` if the file is missing or malformed.

## 3 · §D rollout — what we changed

The Phase 4 baseline ran a Lighthouse audit and found **mobile
performance at 77 / 100**. Five categories of changes brought it
to a stable 91 (verified across 3 consecutive runs):

### 3.1 Lazy-load every screen that isn't the cover

`App.tsx` historically eager-imported `Dashboard`, `MasterLock`,
`Onboarding`, `CommandPalette`, and `SpaceTimeBackground`. None of
those render on the cover screen, but their tree was bundled into
the entry chunk regardless — pushing it to **615 kB raw / 191 kB
gzip**.

§D moves them all to `React.lazy(() => import(...))`, wrapped in
`<Suspense fallback={<ScreenLoader>}>`. The entry chunk dropped
to **187 kB raw / 68 kB gzip** — a 64% reduction in critical-path
JS.

`CoverScreen` itself is also lazy now: the brief `<ScreenLoader>`
spinner becomes the FCP element while the cover bundle streams
in. This trade actually _improves_ LCP because the spinner paints
in <1 s instead of waiting for the full cover render.

### 3.2 Replace third-party noise SVG with an inline data URI

`CoverScreen` / `Onboarding` / `MemoryFragments` referenced
`https://grainy-gradients.vercel.app/noise.svg` for the
decorative grain texture. The request was on the FCP critical
path (DNS + TLS + ~200 ms transfer for a non-functional asset)
AND it cost a "third-party request" Lighthouse ding in
best-practices.

§D extracts the SVG body into `lib/noiseTexture.ts` as a
`data:image/svg+xml` URI. Same visual texture, zero network
round-trip, and best-practices score climbed from **96 → 100**
as a side effect.

### 3.3 Drop the `latin-ext` font subsets

The old `index.css` eagerly imported six woff2 subsets: Inter +
JetBrains Mono × `latin` + `latin-ext` × multiple weights. The
`latin-ext` subsets cover Czech / Polish / Vietnamese diacritics
that ~95 % of our zh+en target users never see.

§D drops the four `latin-ext` imports entirely. Users who do hit
a `latin-ext` glyph (rare) see the system fallback chain
(PingFang SC, Microsoft YaHei) render the codepoint correctly —
no missing glyphs, just slightly different metrics for that one
character. **3 fewer woff2 fetches × ~25 kB each = ~75 kB shaved
from the FCP critical path**.

### 3.4 Hoist the bundled stylesheet above the entry script

Vite's default emits `<link rel="stylesheet">` AT THE END of
`<head>`, after `<script type="module">` and every
`<link rel="modulepreload">`. On slow networks this can push the
render-blocking CSS dispatch past the FCP critical path.

§D adds a tiny `vector-hoist-stylesheet` plugin to
`vite.config.ts` that relocates the auto-injected hashed
stylesheet link to BEFORE the entry script tag. The browser's
preload scanner now dispatches the CSS request first.

### 3.5 Drop the synthesised `font-black` (900) weight

The `<h1>VECTOR</h1>` on the cover screen used `font-black`
(900). Inter 900 was never in the bundle — the browser was
synthesising bold from Inter 700. The synthesis introduces a
small paint delay that pushed the LCP element by ~50-100 ms.

§D switches to `font-bold` (700, the actual TTF). Same heroic
visual weight, no synth delay.

## 4 · Score breakdown — before vs after

| Category       | Mobile pre-§D | Mobile post-§D | Desktop pre-§D | Desktop post-§D |
| -------------- | ------------: | -------------: | -------------: | --------------: |
| performance    |            77 |         **91** |             99 |         **100** |
| accessibility  |            96 |         **96** |             96 |          **96** |
| best-practices |            96 |        **100** |             96 |         **100** |
| seo            |            91 |         **91** |             91 |          **91** |

Mobile metric improvements:

| Metric                   | Before | After |
| ------------------------ | -----: | ----: |
| First Contentful Paint   |  3.6 s | 2.1 s |
| Largest Contentful Paint |  4.2 s | 2.6 s |
| Total Blocking Time      |   0 ms |  0 ms |
| Speed Index              |  3.6 s | 2.1 s |
| Cumulative Layout Shift  |  0.078 | 0.032 |

(Numbers may drift ±50 ms run-to-run; the Lighthouse score is
stable to within ±1 across 3 consecutive runs.)

## 5 · What's explicitly out-of-scope for §D

- **Server-side rendering / SSG** — would push mobile mobile-perf
  toward 100 by skipping the React mount + paint cycle entirely,
  but it's a Phase 5+ architectural decision (changes the entire
  hosting story).
- **Per-route preloading** — `link[rel=prefetch]` for the most-
  likely-next-route bundle. Marginal win, lots of edge cases.
- **AVIF / WebP for any future hero images** — we don't ship
  raster images on the cover today; the only image asset is the
  SVG icon.
- **Brotli content-encoding** — already handled by every modern
  static-host CDN.

## 6 · Future ratchets

When mobile performance climbs past 95, raise the budget in
`lighthouse-budget.json`. The harness will keep the gate honest
on every CI run (or every check-beta run with `RUN_LIGHTHOUSE=1`).
