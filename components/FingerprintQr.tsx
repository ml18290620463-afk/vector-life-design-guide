import React, { useMemo } from 'react';
import { fingerprintToQrSvg, type FingerprintQrOptions } from '../lib/fingerprintQr';

/**
 * Phase 4 §4.b-3 follow-up (K2) — `FingerprintQr`
 *
 * Tiny presentational wrapper around `fingerprintToQrSvg`. Memoises
 * the generated SVG string so re-renders driven by the surrounding
 * card don't pay for QR encoding more than once per fingerprint.
 *
 * Renders inside a `<div role="img" aria-label="...">` so screen
 * readers can describe what's on screen without reading the QR
 * pixel-by-pixel. The data is also displayed adjacent to the QR in
 * every consumer surface (export modal / verify-trust pane /
 * Settings) so this is purely a visual aid for sighted users.
 */
interface FingerprintQrProps {
  fingerprint: string;
  size?: FingerprintQrOptions['size'];
  /** Visible label for screen-reader users. Defaults to a generic
   *  "QR code of fingerprint X" string but consumers should pass
   *  the localised version. */
  ariaLabel?: string;
  /** Forwarded to the wrapping div for layout tweaks. */
  className?: string;
  color?: FingerprintQrOptions['color'];
  background?: FingerprintQrOptions['background'];
}

export const FingerprintQr: React.FC<FingerprintQrProps> = ({
  fingerprint,
  size,
  ariaLabel,
  className,
  color,
  background,
}) => {
  const svg = useMemo(
    () => fingerprintToQrSvg(fingerprint, { size, color, background }),
    [fingerprint, size, color, background],
  );
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `QR code of fingerprint ${fingerprint}`}
      className={className}
      data-testid="fingerprint-qr"
      // Inline SVG inherits CSS (`currentColor`) so the QR adopts
      // the parent's text colour automatically.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
