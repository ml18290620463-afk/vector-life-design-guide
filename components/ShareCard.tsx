import React, { CSSProperties, forwardRef, useMemo } from 'react';
import type { DiaryEntry } from '../types';
import {
  SHARE_CARD_DIMENSIONS,
  ShareCardPalette,
  getShareCardPalette,
} from '../lib/shareCardPalette';
import type { ShareCardOptions } from '../hooks/useShareCardOptions';
import { APP_VERSION } from '../constants';

export interface ShareCardProps {
  /** The diary entry being shared. */
  entry: DiaryEntry;
  /** User-controlled privacy / theme options (see
   *  `useShareCardOptions`). */
  options: ShareCardOptions;
  /** Identity displayed in the footer; usually the user's
   *  customised handle (`AppStorageKeys.customIdentity`) or the
   *  default `GUEST_01`. */
  displayIdentity: string;
  /** Localised "share card" labels (title, masked-body
   *  placeholder, footer). The component is theme-agnostic so
   *  every string is supplied by the caller. */
  labels: ShareCardLabels;
  /** Pixel scale of the rendered DOM. Defaults to 1 (canonical
   *  1080 × 1920); pass a value < 1 to render an in-page preview. */
  scale?: number;
}

export interface ShareCardLabels {
  /** Top-of-card eyebrow ("VECTOR · Reflection card"). */
  eyebrow: string;
  /** Placeholder rendered inside the body block when
   *  `options.showBody === false`. Should be reassuring rather
   *  than blank — the user is sharing the card publicly. */
  bodyMaskedPlaceholder: string;
  /** Footer attribution ("Local-first journal · vectorlife.app"). */
  footerAttribution: string;
  /** Visible label for the attachment badge ("Has attachment"). */
  attachmentBadge: string;
  /** Empty-content fallback for entries with no body. */
  emptyBodyPlaceholder: string;
}

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
};

const buildArchiveId = (entry: DiaryEntry): string => {
  const yearSuffix = new Date(entry.createdAt).getFullYear().toString().slice(2);
  return `AR-${yearSuffix}-${entry.id.slice(0, 4).toUpperCase()}`;
};

/**
 * Phase 3 §3.h — pure 1080 × 1920 share-card.
 *
 * Pure presentational. No state, no effects. Inline styles only
 * (no Tailwind classes) because:
 *   - The component is rendered offscreen / scaled in a preview;
 *     Tailwind utility classes carry no styling weight outside
 *     the live document if the rasterizer chooses to clone into
 *     `<foreignObject>` without the global stylesheet.
 *   - Inline styles let `modern-screenshot` capture the literal
 *     resolved values without depending on `var(--color-…)` /
 *     `color-mix()` resolution inside the SVG embed.
 *
 * The component forwards `ref` to the root so the export hook
 * (`useShareCardExport`) can pass it straight to `domToBlob`.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { entry, options, displayIdentity, labels, scale = 1 },
  ref,
) {
  const palette = useMemo(() => getShareCardPalette(options.theme), [options.theme]);

  const { width, height } = SHARE_CARD_DIMENSIONS;
  const rootStyle: CSSProperties = {
    boxSizing: 'border-box',
    width: `${width}px`,
    height: `${height}px`,
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: 'top left',
    background: palette.background,
    color: palette.textPrimary,
    fontFamily: '"Inter","PingFang SC","Hiragino Sans GB","Noto Sans","Helvetica Neue",sans-serif',
    overflow: 'hidden',
    position: 'relative',
    padding: '120px 80px',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div ref={ref} style={rootStyle} data-testid="share-card-root">
      <ShareCardEyebrow palette={palette} label={labels.eyebrow} />
      <ShareCardArchiveBadge entry={entry} palette={palette} />

      <h1
        style={{
          fontSize: '88px',
          lineHeight: 1.15,
          fontWeight: 700,
          margin: '64px 0 32px',
          letterSpacing: '-0.02em',
          color: palette.textPrimary,
          // Long titles wrap to two lines; clamp to 4 so a runaway
          // 200-char title never grows past the body.
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {entry.title || labels.emptyBodyPlaceholder}
      </h1>

      <ShareCardMeta entry={entry} palette={palette} />
      {options.showTags && entry.tags.length > 0 && (
        <ShareCardTags tags={entry.tags} palette={palette} />
      )}

      <div style={{ flex: 1, marginTop: '64px', position: 'relative' }}>
        <ShareCardBody
          entry={entry}
          palette={palette}
          showBody={options.showBody}
          maskedLabel={labels.bodyMaskedPlaceholder}
          emptyLabel={labels.emptyBodyPlaceholder}
        />
      </div>

      {options.showAttachmentBadge && entry.attachment && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            border: `1px solid ${palette.borderSubtle}`,
            borderRadius: '999px',
            color: palette.textSecondary,
            fontSize: '24px',
            alignSelf: 'flex-start',
            marginTop: '32px',
            letterSpacing: '0.04em',
          }}
        >
          <span aria-hidden="true">▢</span>
          {labels.attachmentBadge}
        </div>
      )}

      <ShareCardFooter
        identity={displayIdentity}
        attribution={labels.footerAttribution}
        palette={palette}
      />
    </div>
  );
});

const ShareCardEyebrow: React.FC<{ palette: ShareCardPalette; label: string }> = ({
  palette,
  label,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      fontSize: '24px',
      letterSpacing: '0.36em',
      color: palette.accent,
      textTransform: 'uppercase',
      fontWeight: 600,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: '64px',
        height: '4px',
        background: palette.brand,
      }}
    />
    {label}
  </div>
);

const ShareCardArchiveBadge: React.FC<{
  entry: DiaryEntry;
  palette: ShareCardPalette;
}> = ({ entry, palette }) => (
  <div
    style={{
      marginTop: '48px',
      fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
      fontSize: '28px',
      letterSpacing: '0.18em',
      color: palette.textMuted,
    }}
  >
    {buildArchiveId(entry)} · {formatDate(entry.createdAt)}
  </div>
);

const ShareCardMeta: React.FC<{ entry: DiaryEntry; palette: ShareCardPalette }> = ({
  entry,
  palette,
}) => {
  const flags: string[] = [];
  if (entry.isLocked || entry.isEncrypted) flags.push('SEALED');
  if (entry.unlockAt) flags.push('TIMELOCK');
  if (entry.isArchived) flags.push('ARCHIVED');
  if (entry.morningStarAnalysis) flags.push('ANALYSED');
  if (flags.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {flags.map((flag) => (
        <span
          key={flag}
          style={{
            padding: '8px 20px',
            border: `1px solid ${palette.divider}`,
            borderRadius: '6px',
            fontSize: '20px',
            letterSpacing: '0.24em',
            color: palette.textSecondary,
            fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
          }}
        >
          {flag}
        </span>
      ))}
    </div>
  );
};

const ShareCardTags: React.FC<{ tags: string[]; palette: ShareCardPalette }> = ({
  tags,
  palette,
}) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      marginTop: '8px',
    }}
  >
    {tags.slice(0, 8).map((tag) => (
      <span
        key={tag}
        style={{
          padding: '8px 20px',
          background: palette.surface,
          color: palette.accentSoft,
          fontSize: '24px',
          fontWeight: 500,
          borderRadius: '4px',
          fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
        }}
      >
        {tag.startsWith('#') ? tag : `#${tag}`}
      </span>
    ))}
  </div>
);

const ShareCardBody: React.FC<{
  entry: DiaryEntry;
  palette: ShareCardPalette;
  showBody: boolean;
  maskedLabel: string;
  emptyLabel: string;
}> = ({ entry, palette, showBody, maskedLabel, emptyLabel }) => {
  if (!entry.content) {
    return (
      <p
        style={{
          fontSize: '36px',
          lineHeight: 1.5,
          color: palette.textMuted,
          fontStyle: 'italic',
          margin: 0,
        }}
      >
        {emptyLabel}
      </p>
    );
  }

  if (!showBody) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: '420px',
          border: `2px dashed ${palette.divider}`,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '80px',
          textAlign: 'center',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '64px', color: palette.textMuted }}>
          ✦
        </span>
        <p
          style={{
            margin: 0,
            fontSize: '32px',
            lineHeight: 1.4,
            color: palette.textSecondary,
            maxWidth: '720px',
          }}
        >
          {maskedLabel}
        </p>
      </div>
    );
  }

  // Body visible: render the first ~600 chars (≈ four paragraphs)
  // so a 5000-word entry doesn't blow past the 1920-px height.
  // Strip raw markdown tokens — the share card is a text excerpt,
  // not a faithful render.
  const stripped = entry.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const excerpt = stripped.length > 540 ? `${stripped.slice(0, 540).trimEnd()}…` : stripped;
  return (
    <p
      style={{
        margin: 0,
        fontSize: '36px',
        lineHeight: 1.55,
        color: palette.textPrimary,
        whiteSpace: 'pre-wrap',
        // Keep total body within 11 lines (~36 × 1.55 × 11 ≈ 615 px)
        // so the footer never collides with the bottom edge.
        display: '-webkit-box',
        WebkitLineClamp: 11,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {excerpt}
    </p>
  );
};

const ShareCardFooter: React.FC<{
  identity: string;
  attribution: string;
  palette: ShareCardPalette;
}> = ({ identity, attribution, palette }) => (
  <div
    style={{
      marginTop: '64px',
      paddingTop: '32px',
      borderTop: `1px solid ${palette.divider}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: palette.watermark,
      fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
      fontSize: '22px',
      letterSpacing: '0.12em',
    }}
  >
    <span style={{ color: palette.textSecondary }}>@{identity}</span>
    <span>
      {attribution} · v{APP_VERSION}
    </span>
  </div>
);
