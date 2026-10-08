const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export const sanitizeDownloadFilename = (filename: string) => {
  const sanitized = filename.replace(UNSAFE_FILENAME_CHARS, '_').replace(/\s+/g, ' ').trim();

  return sanitized || 'download';
};

export const downloadBlob = async (blob: Blob, filename: string) => {
  const safeName = sanitizeDownloadFilename(filename);

  if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const downloadTextFile = async (
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
) => {
  await downloadBlob(new Blob([content], { type: mimeType }), filename);
};
