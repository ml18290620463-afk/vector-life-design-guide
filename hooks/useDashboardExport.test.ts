import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardExport } from './useDashboardExport';
import * as fileDownload from '../services/fileDownload';
import { exportVaultBackupFile } from '../services/vaultBackup';

vi.mock('../services/vaultBackup', () => ({ exportVaultBackupFile: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useDashboardExport', () => {
  it('downloads the complete backup before recording success', async () => {
    vi.mocked(exportVaultBackupFile).mockResolvedValue({
      schemaVersion: 2,
      version: '1.1.0',
    } as Awaited<ReturnType<typeof exportVaultBackupFile>>);
    const recordBackup = vi.fn();
    const downloadSpy = vi
      .spyOn(fileDownload, 'downloadTextFile')
      .mockImplementation(() => Promise.resolve());
    const { result } = renderHook(() => useDashboardExport({ currentUser: null, recordBackup }));

    await act(async () => {
      await result.current.handleExport();
    });

    const [content, filename] = downloadSpy.mock.calls[0];
    expect(JSON.parse(content).version).toBe('1.1.0');
    expect(filename).toMatch(/^VECTOR-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(recordBackup).toHaveBeenCalledOnce();
  });

  it('does not record success when the backup download fails', async () => {
    vi.mocked(exportVaultBackupFile).mockResolvedValue({ schemaVersion: 2 } as Awaited<
      ReturnType<typeof exportVaultBackupFile>
    >);
    vi.spyOn(fileDownload, 'downloadTextFile').mockRejectedValue(new Error('下载失败'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const recordBackup = vi.fn();
    const { result } = renderHook(() => useDashboardExport({ currentUser: null, recordBackup }));

    await act(async () => {
      await result.current.handleExport();
    });

    expect(recordBackup).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('下载失败');
  });
});
