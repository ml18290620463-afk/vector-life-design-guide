/**
 * Phase 4.5 §D — `lib/noiseTexture.ts`
 *
 * Inline SVG `feTurbulence` noise as a data URI. Replaces the
 * previous 3rd-party `grainy-gradients.vercel.app/noise.svg`
 * reference which was on the cover-screen FCP critical path and
 * cost ~200 ms of third-party DNS + TLS + download per cold load.
 *
 * Bundle cost: ~330 bytes ungzipped, embedded in every consumer's
 * JS chunk. Cheap enough that we don't bother to extract it as a
 * static asset (which would re-introduce the network round-trip
 * we are trying to delete).
 *
 * Visual parameters chosen to match the previous external SVG:
 *   - `baseFrequency=0.85`  → fine-grained grain
 *   - `numOctaves=3`         → enough turbulence to feel organic
 *   - `stitchTiles=stitch`   → seamless when used with `bg-repeat`
 */
const NOISE_SVG = `<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`;

/** Data-URI form of the noise SVG. Uses single-quote attribute
 *  delimiters inside the SVG body so the outer `url("…")` wrapper
 *  in CSS doesn't need to escape them. */
export const NOISE_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}`;

/** Convenience React style snippet — `<div style={NOISE_BG_STYLE}>`. */
export const NOISE_BG_STYLE = {
  backgroundImage: `url("${NOISE_DATA_URI}")`,
} as const;
