/**
 * Phase 3 §3.h — palette consumed by the offscreen share-card
 * rasterizer.
 *
 * Why a separate module (rather than reading from `index.css`'s
 * `--color-vector-*` custom properties)?
 *   - DOM-to-PNG libraries (`modern-screenshot`, `html-to-image`,
 *     `html2canvas`) snapshot the *resolved* CSS at rasterization
 *     time. CSS custom properties resolve correctly inside
 *     `<foreignObject>` trees in modern Chromium / Firefox /
 *     WebKit, but `color-mix()` does NOT (Chromium 121+ added it,
 *     Firefox 134+, Safari 17.4+ — older Android / iOS we still
 *     ship to does not). The card therefore uses literal hex
 *     values for every colour to keep rendering identical across
 *     all supported rasterizer backends.
 *   - Keeps the share-card pixel-perfect across user themes; the
 *     card itself ships its own dark / light pair rather than
 *     inheriting whatever the user has currently selected.
 *
 * The literal values mirror `lib/designTokens.ts`. Adding a new
 * token here requires updating both files (caught by the unit
 * test in `lib/shareCardPalette.test.ts`).
 */

import { colors } from './designTokens';

export type ShareCardTheme = 'dark' | 'light';

export interface ShareCardPalette {
  background: string;
  surface: string;
  borderStrong: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  brand: string;
  divider: string;
  watermark: string;
}

export const SHARE_CARD_DARK: ShareCardPalette = {
  background: colors.ink.panelDeep, // #05070a
  surface: colors.ink.panel, // #0a0d12
  borderStrong: colors.cyan.brand, // #007a8c
  borderSubtle: colors.slate[800], // #1e293b
  textPrimary: colors.slate[50], // #f8fafc
  textSecondary: colors.slate[300], // #cbd5e1
  textMuted: colors.slate[500], // #64748b
  accent: colors.cyan.neon, // #12d8ff
  accentSoft: colors.cyan[400], // #22d3ee
  brand: colors.cyan.brand, // #007a8c
  divider: colors.slate[700], // #334155
  watermark: colors.slate[600], // #475569
};

export const SHARE_CARD_LIGHT: ShareCardPalette = {
  background: colors.ink.skyLight, // #f0f4f7
  surface: colors.ink.parchment, // #faf9f6
  borderStrong: colors.cyan.brand, // #007a8c
  borderSubtle: colors.slate[200], // #e2e8f0
  textPrimary: colors.ink.text, // #1a202c
  textSecondary: colors.ink.muted, // #4a5568
  textMuted: colors.ink.placeholder, // #718096
  accent: colors.cyan[600], // #0891b2
  accentSoft: colors.cyan[500], // #06b6d4
  brand: colors.cyan.brand, // #007a8c
  divider: colors.slate[300], // #cbd5e1
  watermark: colors.slate[400], // #94a3b8
};

export const getShareCardPalette = (theme: ShareCardTheme): ShareCardPalette =>
  theme === 'light' ? SHARE_CARD_LIGHT : SHARE_CARD_DARK;

/** Canonical export size: 1080 × 1920, 9:16 portrait. Matches
 *  Instagram Stories / Threads / Xiaohongshu story / WeChat
 *  Moments full-screen. */
export const SHARE_CARD_DIMENSIONS = {
  width: 1080,
  height: 1920,
} as const;
