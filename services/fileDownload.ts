const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export const sanitizeDownloadFilename = (filename: string) => {
  const sanitized = filename.replace(UNSAFE_FILENAME_CHARS, '_').replace(/\s+/g, ' ').trim();

  return sanitized || 'download';
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = sanitizeDownloadFilename(filename);
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

export const downloadTextFile = (
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
) => {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
};
