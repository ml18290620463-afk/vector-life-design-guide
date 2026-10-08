/**
 * Design tokens — Phase 3 §3.a baseline.
 *
 * One source of truth for the colour, spacing, radius, shadow, motion
 * and z-index scales used across the app. The file is intentionally
 * dependency-free and `as const` so it can be consumed by:
 *
 *   - any `.ts` / `.tsx` module (typed access via the `Token*` aliases)
 *   - Tailwind config (importable through `tailwind.config.ts`
 *     extension when we eventually replace the inline arbitrary values)
 *   - Storybook controls (3.b)
 *   - the `eslint-plugin-no-restricted-syntax` rule that bans raw hex /
 *     rgba literals in `components/**` (3.a-2; gradually opted-in)
 *
 * Conventions:
 *   - Colour names follow the brand vocabulary in `index.css`
 *     (`vector-cyan`, `vector-magenta`, `vector-indigo`, `vector-rose`)
 *     plus the neutral slate scale used everywhere.
 *   - All numeric values are quoted strings ending in `rem` / `ms` /
 *     `px`. The string form keeps interop with Tailwind arbitrary
 *     values (`p-[var(--…)]`) trivial without runtime conversion.
 *   - Adding a new token is OK; **renaming** a token requires a
 *     codebase-wide grep + Storybook update.
 */

/* -------------------------------------------------------------------------- */
/*  Colours                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Brand palette. Each colour exposes a 50→900 lightness scale plus an
 * optional `glow` token used by neon-shadow effects (`shadow-[0_0_20px_…]`).
 *
 * `cyan` is the canonical interactive hue; `magenta` is reserved for
 * accents; `indigo` for secondary depth; `rose` for destructive
 * states.
 */
export const colors = {
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    brand: '#00c8e8',
    neon: '#3fe7f2',
    glow: 'rgba(0, 200, 232, 0.45)',
  },
  magenta: {
    400: '#ff58da',
    500: '#ff2ecc',
    600: '#d8158a',
    glow: 'rgba(255, 46, 204, 0.45)',
  },
  indigo: {
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    glow: 'rgba(99, 102, 241, 0.4)',
  },
  rose: {
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    danger: '#C85F72',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
  green: {
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    teal: '#11bfaf',
  },
  amber: {
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  ink: {
    bg: '#030303',
    surface: '#0a0a0a',
    panel: '#0a0d12',
    panelMid: '#0a0f14',
    panelDeep: '#05070a',
    text: '#1a202c',
    muted: '#4a5568',
    placeholder: '#718096',
    chrome: '#6e8198',
    paperLight: '#fafafa',
    paperWarm: '#fcfdfe',
    parchment: '#faf9f6',
    skyLight: '#f0f4f7',
  },
} as const;

export type ColorTokens = typeof colors;
export type ColorFamily = keyof ColorTokens;

/* -------------------------------------------------------------------------- */
/*  Spacing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Spacing scale in `rem`. Aligned with Tailwind defaults but
 * deliberately exposed here so non-Tailwind contexts (motion durations
 * driven by spacing, calculated SVG paddings) share the same series.
 */
export const spacing = {
  0: '0rem',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
} as const;

export type SpacingTokens = typeof spacing;
export type SpacingKey = keyof SpacingTokens;

/* -------------------------------------------------------------------------- */
/*  Radius                                                                    */
/* -------------------------------------------------------------------------- */

export const radius = {
  none: '0px',
  sm: '0.125rem',
  base: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const;

export type RadiusTokens = typeof radius;

/* -------------------------------------------------------------------------- */
/*  Shadow                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Layered shadows. Anything starting with `glow*` is a neon accent
 * (uses brand colours via `colors.<family>.glow`); the rest match
 * Tailwind's elevation scale at 1.5× the spread to keep our
 * cyber-paper aesthetic.
 */
export const shadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  md: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 12px 24px -6px rgba(0, 0, 0, 0.12), 0 4px 8px -4px rgba(0, 0, 0, 0.06)',
  xl: '0 24px 50px -12px rgba(0, 0, 0, 0.18)',
  glowCyan: `0 0 20px ${colors.cyan.glow}`,
  glowCyanLg: `0 0 40px ${colors.cyan.glow}, 0 0 80px rgba(6, 182, 212, 0.2)`,
  glowMagenta: `0 0 20px ${colors.magenta.glow}`,
  glowIndigo: `0 0 20px ${colors.indigo.glow}`,
  glowRose: `0 0 20px ${colors.rose.glow}`,
  glowAmber: `0 0 20px ${colors.amber.glow}`,
  insetGlowCyan: 'inset 0 0 40px rgba(6, 182, 212, 0.1)',
  alertHalo: '0 0 15px rgba(200, 95, 114, 0.1), 0 4px 12px rgba(200, 95, 114, 0.15)',
} as const;

export type ShadowTokens = typeof shadow;

/* -------------------------------------------------------------------------- */
/*  Motion                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Animation durations + easing curves. Anything beyond 1.2 s belongs to
 * the "ritual" tier and should respect `prefers-reduced-motion` via
 * `useMotionPreference()` (already wired in `App.tsx` via
 * `<MotionConfig>`).
 */
export const motion = {
  durations: {
    instant: '0ms',
    fast: '150ms',
    base: '300ms',
    slow: '500ms',
    slower: '800ms',
    ritual: '1200ms',
    ceremony: '2200ms',
  },
  easings: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    cyber: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const;

export type MotionTokens = typeof motion;

/* -------------------------------------------------------------------------- */
/*  Z-index                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Z-index scale. The numeric gaps leave room for inline overrides
 * without re-numbering the whole stack. Inline `z-[NN]` values in
 * `.tsx` files SHOULD be replaced with these tokens; the lint rule
 * (3.a-2) covers that opt-in.
 */
export const zIndex = {
  background: 0,
  base: 10,
  raised: 20,
  dropdown: 50,
  sticky: 100,
  drawer: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  ritual: 1000,
} as const;

export type ZIndexTokens = typeof zIndex;

/* -------------------------------------------------------------------------- */
/*  Aggregate export                                                          */
/* -------------------------------------------------------------------------- */

export const tokens = {
  colors,
  spacing,
  radius,
  shadow,
  motion,
  zIndex,
} as const;

export type DesignTokens = typeof tokens;
