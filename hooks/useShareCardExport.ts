import { useCallback, useState } from 'react';
import { downloadBlob, sanitizeDownloadFilename } from '../services/fileDownload';
import { SHARE_CARD_DIMENSIONS } from '../lib/shareCardPalette';

export interface ShareCardExportOptions {
  /** Filename WITHOUT extension. Will be sanitised + suffixed
   *  with `.png`. Defaults to `vector-share-card-<timestamp>`. */
  filename?: string;
  /** Output device-pixel scale. The card itself renders at 1 ×
   *  internally; we scale up at rasterization time so the final
   *  PNG is the canonical 1080 × 1920 px even when the source
   *  node was rendered into a smaller preview window. Defaults
   *  to whatever ratio brings the output to 1080 × 1920. */
  scale?: number;
  /** Background colour fed to `modern-screenshot` so transparent
   *  edges of the card don't pick up a white default. The card
   *  already paints its own surface, so this is mainly defensive
   *  cover for `border-radius` corner cutouts. */
  backgroundColor?: string;
}

export type ShareCardExportStatus = 'idle' | 'rendering' | 'success' | 'error';

export interface UseShareCardExportResult {
  status: ShareCardExportStatus;
  errorMessage: string | null;
  /** Rasterise the supplied DOM node (the offscreen / preview
   *  share-card root) and trigger a PNG download. Resolves with
   *  the produced Blob so callers can wire "Copy" / "Share via
   *  Web Share API" alongside "Save". */
  exportPng: (node: HTMLElement | null, options?: ShareCardExportOptions) => Promise<Blob | null>;
  /** Reset to `idle` so consumers can dismiss an error / success
   *  state without a follow-up export. */
  reset: () => void;
}

/**
 * Phase 3 §3.h — share-card PNG export.
 *
 * Wraps `modern-screenshot`'s `domToBlob` behind a lazy `import()`
 * so the rasterizer (~32 KB gz, plus its `<foreignObject>` + DOM
 * cloning overhead) only ships when the user actually opens the
 * share-card flow. The first-paint bundle stays unchanged.
 *
 * Design notes:
 *   - Returns the Blob from `exportPng` so callers can plug into
 *     `navigator.share` / `navigator.clipboard.write` without
 *     re-rasterizing.
 *   - Status machine is explicit (`idle | rendering | success |
 *     error`) so the modal can show inline progress + recovery
 *     UI rather than fighting with a generic toast layer.
 *   - The card is canonically 1080 × 1920. Callers usually render
 *     the source DOM at a scaled-down preview size; we infer the
 *     correct `scale` from the node's measured width unless the
 *     caller passes `scale` explicitly.
 */
export const useShareCardExport = (): UseShareCardExportResult => {
  const [status, setStatus] = useState<ShareCardExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const exportPng = useCallback(
    async (
      node: HTMLElement | null,
      options: ShareCardExportOptions = {},
    ): Promise<Blob | null> => {
      if (!node) {
        setStatus('error');
        setErrorMessage('SHARE_CARD_EXPORT_NO_NODE');
        return null;
      }
      setStatus('rendering');
      setErrorMessage(null);

      try {
        const { domToBlob } = await import('modern-screenshot');

        // Compute scale: if the live node is being rendered into a
        // scaled-down preview, multiply the rasterizer scale to
        // hit the canonical 1080 × 1920 output. Falls back to
        // `options.scale` when supplied.
        const measuredWidth = node.getBoundingClientRect().width || SHARE_CARD_DIMENSIONS.width;
        const targetScale =
          options.scale ?? Math.max(1, SHARE_CARD_DIMENSIONS.width / measuredWidth);

        const blob = await domToBlob(node, {
          type: 'image/png',
          scale: targetScale,
          backgroundColor: options.backgroundColor,
          width: SHARE_CARD_DIMENSIONS.width,
          height: SHARE_CARD_DIMENSIONS.height,
        });

        if (!blob) {
          setStatus('error');
          setErrorMessage('SHARE_CARD_EXPORT_NO_BLOB');
          return null;
        }

        const baseName = options.filename ?? `vector-share-card-${Date.now()}`;
        downloadBlob(blob, `${sanitizeDownloadFilename(baseName)}.png`);
        setStatus('success');
        return blob;
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, exportPng, reset };
};
