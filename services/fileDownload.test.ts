import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, downloadTextFile, sanitizeDownloadFilename } from './fileDownload';

describe('fileDownload', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:test-url');
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('sanitizes unsafe filename characters', () => {
    expect(sanitizeDownloadFilename('A/B:C*D?.txt')).toBe('A_B_C_D_.txt');
    expect(sanitizeDownloadFilename('   ')).toBe('download');
  });

  it('downloads blobs and revokes object URLs', () => {
    downloadBlob(new Blob(['hello']), 'note.txt');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    expect(document.body.querySelectorAll('a')).toHaveLength(0);
  });

  it('creates text blobs with the requested filename', () => {
    downloadTextFile('hello', 'entry/name.txt');

    const createdBlob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Blob;
    expect(createdBlob.type).toBe('text/plain;charset=utf-8');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
