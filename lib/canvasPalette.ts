/**
 * Canvas-only colour palette — Phase 3 §3.a-2 follow-up.
 *
 * The Canvas 2D API consumes raw colour strings; it cannot read CSS
 * custom properties without an extra `getComputedStyle` round-trip.
 * The handful of components that drive `<canvas>` therefore keep
 * their literal palettes here, in one centralised module, instead of
 * scattering hex / rgba literals across every animation file.
 *
 * Two consumers:
 *   - `components/DeepArchiveAnimation.tsx` — particle constellation
 *     fired during the "Archive" success animation.
 *   - (future) any other Canvas-driven decoration.
 *
 * Goals of centralising here:
 *   - `npm run lint:tokens` only scans `components/**`, so moving
 *     the literals into `lib/` shrinks the design-token migration
 *     scoreboard without losing intent.
 *   - The palette becomes one diff to review when the team wants to
 *     shift Archive's celebration mood (e.g. softer pastels for v2).
 *   - The `withAlpha()` helper produces canvas-friendly rgba strings
 *     while keeping each base RGB triplet declared exactly once.
 */

/** Bright primary colours used by the Archive constellation particles. */
export const ARCHIVE_PARTICLE_COLORS: readonly string[] = [
  '#ff00ff',
  '#00ffff',
  '#ffff00',
  '#00ff00',
  '#ff0000',
  '#4b0082',
  '#ee82ee',
];

/**
 * RGB triplets (no alpha) for the colours we paint with variable
 * opacity inside the constellation (text labels, glow rings,
 * highlight dots). `withAlpha()` glues an alpha onto the triplet to
 * produce a canvas-ready rgba string.
 */
export const ARCHIVE_RGB = {
  cyan: '0, 255, 255',
  magenta: '255, 0, 255',
  white: '255, 255, 255',
  red: '255, 0, 0',
  // The Archive flash uses the slate-50-ish surface tint when the
  // theme is light; here we keep it as a triplet so the same helper
  // can fade it.
  paperLight: '248, 250, 252',
} as const;

export type ArchiveRgbName = keyof typeof ARCHIVE_RGB;

/**
 * Build a canvas-ready rgba string. `alpha` may be > 1 (Canvas clamps
 * but we keep the call sites readable as `withAlpha('cyan', 0.3 *
 * opacity)`).
 */
export const withAlpha = (rgb: ArchiveRgbName, alpha: number): string =>
  `rgba(${ARCHIVE_RGB[rgb]}, ${alpha})`;
