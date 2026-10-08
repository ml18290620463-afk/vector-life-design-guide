import React, { lazy, Suspense, useState } from 'react';
import { Download, FileText, Image, Music, Video } from 'lucide-react';
import { Attachment, Theme } from '../types';
import { useAttachmentBlobUrl } from '../hooks/useAttachmentBlobUrl';

const PdfAttachmentViewer = lazy(() => import('./PdfAttachmentViewer'));

interface ViewerAttachmentPanelProps {
  attachment: Attachment;
  theme: Theme;
}

const PdfAttachmentSlot: React.FC<{ attachment: Attachment; theme: Theme }> = ({
  attachment,
  theme,
}) => {
  // W3.3 — promote the persisted base64 data URL to a blob URL so
  // PDF.js can stream partial bytes instead of decoding the whole
  // base64 blob on every render. Falls back to the raw data URL
  // when the cache early-returns (non-data-URL inputs).
  const pdfUrl = useAttachmentBlobUrl(attachment.data);
  // The react-pdf bundle is heavy (~460 KB). Defer loading the viewer until
  // the user explicitly asks for it, so opening any entry that *contains* a
  // PDF attachment doesn't ship the entire pdf.js stack.
  const [shouldRender, setShouldRender] = useState(false);

  if (!shouldRender) {
    return (
      <div
        className={`w-full flex flex-col items-center gap-3 p-6 rounded-lg border ${theme === 'light' ? 'border-slate-200 bg-white/60' : 'border-cyan-900/30 bg-black/30'}`}
      >
        <div
          className={`text-[10px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}
        >
          PDF · {attachment.name}
        </div>
        <button
          type="button"
          onClick={() => setShouldRender(true)}
          className={`px-4 py-2 rounded border text-[11px] font-mono uppercase tracking-widest transition-colors ${theme === 'light' ? 'border-cyan-300 text-cyan-700 hover:bg-cyan-50' : 'border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/20'}`}
        >
          Load Document
        </button>
        <a
          href={pdfUrl ?? attachment.data}
          download={attachment.name}
          rel="noopener noreferrer"
          className={`text-[10px] font-mono underline ${theme === 'light' ? 'text-slate-500 hover:text-cyan-700' : 'text-cyan-700 hover:text-cyan-400'}`}
        >
          Download raw
        </a>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="w-full flex flex-col items-center overflow-x-auto rounded-lg border border-slate-200 dark:border-cyan-900/30 bg-white p-4">
          <div className="font-mono text-cyan-600 animate-pulse my-10">Loading Document...</div>
        </div>
      }
    >
      <PdfAttachmentViewer file={pdfUrl ?? attachment.data} theme={theme} />
    </Suspense>
  );
};

export const ViewerAttachmentPanel: React.FC<ViewerAttachmentPanelProps> = ({
  attachment,
  theme,
}) => {
  // W3.3 — single blob URL acquisition for the entire panel; the
  // refcount in lib/blobUrlCache.ts handles the case where a PDF
  // sub-component also acquires the same data URL.
  const blobUrl = useAttachmentBlobUrl(attachment.data);
  const src = blobUrl ?? attachment.data;
  return (
    <div
      className={`mt-8 p-4 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-vector-ink-deep border-cyan-900/30'}`}
    >
      <div
        className={`flex items-center gap-2 mb-4 font-mono text-xs uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-cyan-600'}`}
      >
        {attachment.type === 'image' && <Image className="w-4 h-4" />}
        {attachment.type === 'video' && <Video className="w-4 h-4" />}
        {attachment.type === 'audio' && <Music className="w-4 h-4" />}
        {attachment.type === 'pdf' && <FileText className="w-4 h-4" />}
        <span>{attachment.name}</span>
      </div>

      <div className="flex justify-center">
        {attachment.type === 'image' && (
          <img
            src={src}
            alt={attachment.name}
            className="max-w-full rounded-lg shadow-lg border border-slate-200 dark:border-cyan-900/30 max-h-[600px] object-contain"
          />
        )}
        {attachment.type === 'video' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={src}
            controls
            aria-label={attachment.name}
            className="max-w-full rounded-lg shadow-lg"
          />
        )}
        {attachment.type === 'audio' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={src} controls aria-label={attachment.name} className="w-full" />
        )}
        {attachment.type === 'pdf' && <PdfAttachmentSlot attachment={attachment} theme={theme} />}
      </div>

      {attachment.type !== 'pdf' && (
        <div className="mt-4 flex justify-end">
          <a
            href={src}
            download={attachment.name}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border rounded transition-colors ${theme === 'light' ? 'border-cyan-200 text-cyan-700 hover:bg-cyan-50' : 'border-cyan-900/50 text-cyan-400 hover:bg-cyan-900/30'}`}
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </div>
      )}
    </div>
  );
};
