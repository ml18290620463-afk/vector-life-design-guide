import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
// Bundle the pdf.js worker locally (Vite resolves `?url` to a hashed asset
// served from /assets) so we are not dependent on unpkg.com and our CSP
// `worker-src 'self'` does not need to allow third-party origins.
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfAttachmentViewerProps {
  file: string;
  theme: 'light' | 'dark';
}

export const PdfAttachmentViewer: React.FC<PdfAttachmentViewerProps> = ({ file, theme }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <div className="w-full flex flex-col items-center overflow-x-auto rounded-lg border border-slate-200 dark:border-cyan-900/30 bg-white p-4">
      <Document
        file={file}
        onLoadSuccess={({ numPages: pages }) => {
          setNumPages(pages);
          setPageNumber((prev) => Math.min(prev, pages));
        }}
        className="max-w-full"
        loading={
          <div className="font-mono text-cyan-600 animate-pulse my-10">Loading Document...</div>
        }
      >
        <Page
          pageNumber={pageNumber}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          className="shadow-lg max-w-full"
        />
      </Document>

      {numPages && (
        <div className="flex items-center gap-4 mt-4 font-mono text-xs">
          <button
            onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
            className={`px-3 py-1 rounded disabled:opacity-50 ${
              theme === 'light'
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400'
            }`}
          >
            Previous
          </button>
          <span className="text-slate-600 dark:text-slate-400">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
            disabled={pageNumber >= numPages}
            className={`px-3 py-1 rounded disabled:opacity-50 ${
              theme === 'light'
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfAttachmentViewer;
