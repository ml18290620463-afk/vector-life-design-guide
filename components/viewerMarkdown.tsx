import React from 'react';
import { Wind } from 'lucide-react';
import type { Components } from 'react-markdown';
import {
  ALLOWED_FRAME_SCHEMES,
  ALLOWED_IMAGE_SCHEMES,
  ALLOWED_LINK_SCHEMES,
  ALLOWED_MEDIA_SCHEMES,
  isSchemeAllowed,
} from '../lib/markdownSchemes';
import type { Theme } from '../types';

const Blocked: React.FC<{ label: string }> = ({ label }) => (
  <span className="text-xs font-mono text-rose-500/80">[blocked {label}]</span>
);

/**
 * Markdown component overrides for the entry viewer. Extracted from Viewer.tsx
 * so the schema-specific renderers (audio/video/pdf/img) live close to the
 * URL-scheme allow lists in `lib/markdownSchemes.ts`. Behaviour is unchanged;
 * the only difference is that this module is now independently testable and
 * can be reused by MorningStarPanel without dragging the whole Viewer in.
 */
export const buildViewerMarkdownComponents = (theme: Theme): Components => ({
  a: (props) => {
    const { href, children } = props;
    const label = String(children).toLowerCase();

    if (label === 'video') {
      if (!isSchemeAllowed(href, ALLOWED_MEDIA_SCHEMES)) {
        return <Blocked label="video link" />;
      }
      return (
        <div className="my-6">
          {/* User-supplied attachments rarely come with caption tracks; we
              surface that in a lint exception rather than rejecting the
              attachment outright. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={href}
            controls
            aria-label={`video attachment ${href ?? ''}`.trim()}
            className={`w-full max-h-[500px] rounded-lg border shadow-2xl ${theme === 'light' ? 'border-slate-200' : 'border-cyan-500/30'}`}
          />
        </div>
      );
    }
    if (label === 'audio') {
      if (!isSchemeAllowed(href, ALLOWED_MEDIA_SCHEMES)) {
        return <Blocked label="audio link" />;
      }
      return (
        <div className="my-4 p-4 rounded-lg border bg-black/20 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-500/70">
            <Wind className="w-3 h-3 animate-pulse" /> AUDIO_STREAM_DECODED
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            src={href}
            controls
            aria-label={`audio attachment ${href ?? ''}`.trim()}
            className="w-full"
          />
        </div>
      );
    }
    if (label === 'pdf' || label === 'paf') {
      if (!isSchemeAllowed(href, ALLOWED_FRAME_SCHEMES)) {
        return <Blocked label="document link" />;
      }
      return (
        <div className="my-6 w-full h-[600px] border rounded-lg overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full p-2 bg-black/60 backdrop-blur-md border-b border-white/10 z-10 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Document_Viewer_Active
            </span>
            <a
              href={href}
              download
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-white hover:text-cyan-400 underline"
            >
              Download_Raw
            </a>
          </div>
          <iframe
            src={href}
            className="w-full h-full bg-white"
            title="Document Viewer"
            sandbox="allow-same-origin allow-scripts"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (!isSchemeAllowed(href, ALLOWED_LINK_SCHEMES)) {
      return <Blocked label="link" />;
    }
    return (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
      >
        {children}
      </a>
    );
  },
  img: (props) => {
    if (!isSchemeAllowed(props.src as string | undefined, ALLOWED_IMAGE_SCHEMES)) {
      return <Blocked label="image" />;
    }
    return (
      <div className="my-8 relative group">
        <div
          className={`absolute -inset-1 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${theme === 'light' ? 'bg-cyan-600' : 'bg-cyan-400'}`}
        ></div>
        <img
          {...props}
          alt={typeof props.alt === 'string' ? props.alt : ''}
          className={`relative max-w-full h-auto rounded-lg border shadow-2xl transition-transform duration-500 group-hover:scale-[1.01] ${theme === 'light' ? 'border-slate-200' : 'border-cyan-500/30'}`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  },
});
