import QRCodeSvg from 'qrcode-svg';

/**
 * Phase 4 §4.b-3 follow-up (K2) — `lib/fingerprintQr`
 *
 * Renders a 16-character device fingerprint (`ABCD-EFGH-IJKL-MNOP`)
 * as a small SVG QR code. Used in three surfaces:
 *
 *   - **Settings → "This device fingerprint"**: shows a QR alongside
 *     the human-readable string so the user can scan it from their
 *     receiving device with any QR app.
 *   - **MigrationExportModal success pane**: same QR, so the source
 *     device displays it after generating a `.vectormigration` file.
 *   - **MigrationImportWizard verify-trust pane**: shows the QR of
 *     the **incoming** package's fingerprint so the user can match
 *     it visually against the QR on the source device. (Scanning is
 *     out-of-scope for v1 — the QR is purely a "compare two pictures"
 *     aid, which dramatically reduces the error rate vs reading
 *     16 base32 characters aloud.)
 *
 * The QR payload is the literal fingerprint string (no URL prefix,
 * no JSON envelope) so any generic QR scanner can read it as plain
 * text. We deliberately don't encode anything secret — fingerprints
 * are 96-bit checksums of public keys and are safe to broadcast.
 *
 * Encoding params:
 *   - `ecl: 'M'` (Medium error correction, ~15%) — plenty for a
 *     screen-to-screen viewing distance and keeps the QR small.
 *   - `padding: 0` — the surrounding card supplies its own
 *     whitespace; baking padding into the SVG bloats the file.
 *   - `width / height` — passed through; defaults are 144 px so
 *     the QR comfortably fits inside the existing fingerprint card.
 *
 * `@noble/ed25519` keypair lifecycle is per-device, not global, so
 * the QR generator is pure-data — no IDB / network reads.
 */

const DEFAULT_SIZE = 144;
const QR_PADDING = 0;
const QR_ECL = 'M';

export interface FingerprintQrOptions {
  /** Side length of the SVG, in CSS pixels. Default 144. */
  size?: number;
  /** Foreground colour. Default `currentColor` (so it inherits from
   *  the surrounding `<div>` text colour and works under both
   *  themes without a runtime palette lookup). */
  color?: string;
  /** Background colour. Default `transparent` (light theme cards
   *  already supply a white-ish background; dark theme cards want
   *  the QR's quiet zone to disappear into the surface so the data
   *  modules read crisply). */
  background?: string;
}

/**
 * Encode `fingerprint` as an inline SVG string (no `<?xml ...>`
 * preamble, suitable for `<div dangerouslySetInnerHTML>`).
 *
 * Why dangerouslySetInnerHTML and not an `<img src=data:...>`:
 *   - Inline SVG inherits CSS (`currentColor`) so the QR adopts
 *     the parent's text colour automatically.
 *   - Avoids a base64 round-trip per render.
 *   - The payload is purely a fingerprint we just produced — no
 *     untrusted input gets near the SVG generator.
 */
export const fingerprintToQrSvg = (
  fingerprint: string,
  options: FingerprintQrOptions = {},
): string => {
  const size = options.size ?? DEFAULT_SIZE;
  const qr = new QRCodeSvg({
    content: fingerprint,
    padding: QR_PADDING,
    width: size,
    height: size,
    color: options.color ?? 'currentColor',
    background: options.background ?? 'transparent',
    ecl: QR_ECL,
  });
  // The library prepends an `<?xml ...?>` declaration which React
  // refuses inside a `dangerouslySetInnerHTML` payload (warns about
  // "extra content at end of document"). Strip it.
  return qr.svg().replace(/^<\?xml[^?]*\?>\s*/, '');
};
