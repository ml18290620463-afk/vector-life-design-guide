# VECTOR independent technical aesthetic audit (Assessment B)

Scope: read-only source review; no product code changes. Parent owns visual assessment. No browser performance, full accessibility compliance, or responsive pass asserted here.

## Installation / tool execution
- Read installed web-design-guidelines skill and fetched fresh upstream Vercel command.md successfully.
- Impeccable launcher initially failed because engine cache directory could not be created under sandbox. Fallback was explicitly communicated. Parent confirmed install authorization; reran with escalation and installed engine 0.1.17 successfully. CLI help and detector now work.
- Ran `impeccable detect components styles --json`; completed exit 2 (findings), not operational failure. Output: `/private/tmp/vector-aesthetic-detector.json`.
- Detector returns exactly 3 overused-font warnings: CoverScreen.brush.css:10 and :37 Helvetica, entrance-theme.css:6 Inter. These are style heuristics, NOT objective failures. Do not replace user's explicitly chosen Inter/system Chinese merely to satisfy detector. Cover glyph consistency deserves separate treatment below.
- No skill slug installation attempted in this subtask; parent installed the skills. No overlay command was run in this subtask. No overlay was injected; nothing to clean from app. Only temporary audit artifacts created. Engine installed outside repo as authorized.

## High-confidence findings
1. Typography theme selector misses actual principle content. `styles/theme-v1.css:167` targets `.principle-card__content`, while `components/ArchivePrinciplesView.tsx:671` uses `.mobile-principle-card__content`. Actual p at :678 carries text-sm/leading-relaxed/tracking-wide. Desktop legacy override `styles/experiences.css:3068–3074` sets serif, 17–19px, 450, tracking .01em, line1.7, so the agreed 17px/1.8 sans-serif standard does not reliably cover this module. Fix actual text selector and consolidate direct paragraph styles, validate mobile + desktop computed style. P1 consistency/readability.
2. Browser-shell colors disagree with chosen theme. `index.html:8` theme-color #050b14; `index.html:64` critical body background #030303. `manifest.json:6–7` background #030303/theme #0a0f1e. Actual theme page #10171d. Align browser chrome/PWA/critical background. P2. This confirms color mismatch, not an observed flash.
3. Brand wordmark combines platform-dependent Helvetica Neue/Arial letters with fixed SVG E. `components/CoverScreen.tsx:27–33`, `components/CoverScreen.brush.css:37,44–48`. E geometry stays fixed while glyph metrics and stroke change with font availability. Recommend one outlined SVG wordmark retaining E or a bundled brand font + verified E metrics. P2 cross-platform identity risk; Windows not visually tested.
4. Cover animation runs indefinitely with no explicit pause control: `components/CoverScreen.brush.css:139` 4s infinite, CoverScreen.tsx has no pause. Reduced-motion IS supported at CSS:212–224, so do not claim missing. Vercel rule for autoplay lasting >5sec suggests pause/stop/hide; preserve user-requested upward light but provide global motion choice or discreet pause if adopted. P2 improvement, not measured performance issue.
5. Cover image `components/CoverScreen.tsx:50` has no intrinsic width/height. It is absolutely positioned and hence normal-flow CLS impact limited. Add source intrinsic dimensions for reliable predecode art/mask geometry. P3; no measured layout shift claim.

## Existing strengths verified
- `styles/theme-v1.css:1–29` chosen palette and semantic aliases; :31–43 dark color-scheme.
- :160–176 explicit body writing 17px/1.8/400, :179 override now editor; :196–198 focus ring; :200–228 dark-text ice-blue primary actions; :240–243 reading width680px.
- `components/AppMotionConfig.tsx` and `hooks/useMotionPreference.ts` respect OS reduced motion; App.tsx wraps application.
- Cover native entry button and accessible VECTOR h1; decorative SVG hidden; viewport permits zoom.
- Existing cover has no progressbar. Do not repeat historic issue.

## Interpretation
The global design direction is coherent; the most useful technical improvement is consolidating real component selectors and removing overlapping legacy typography, rather than changing palette again. Detector's generic anti-font warnings should be overruled by product design intent. Performance/responsive scores require parent visual/browser evidence. Principles editor has many cascading rules (experiences.css ~2180–3800); inspect computed styles before asserting which heading rule wins.
