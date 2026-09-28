import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardExport } from './useDashboardExport';
import type { DiaryEntry } from '../types';
import * as fileDownload from '../services/fileDownload';
import { exportVaultBackup } from '../services/vaultBackup';

vi.mock('../services/vaultBackup', () => ({ exportVaultBackup: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const t = {
  exportFilename: 'star-map',
  notesFilename: 'notes',
  notesHeader: 'Notes',
} as unknown as Parameters<typeof useDashboardExport>[0]['t'];

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e1',
  title: 't',
  content: 'body',
  createdAt: Date.UTC(2025, 0, 1),
  tags: [],
  isLocked: false,
  ...overrides,
});

describe('useDashboardExport', () => {
  it('handleExport downloads the complete v2 backup before recording success', async () => {
    vi.mocked(exportVaultBackup).mockResolvedValue({
      schemaVersion: 2,
      version: '1.1.0',
    } as Awaited<ReturnType<typeof exportVaultBackup>>);
    const recordBackup = vi.fn();
    const downloadSpy = vi
      .spyOn(fileDownload, 'downloadTextFile')
      .mockImplementation(() => Promise.resolve());
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [baseEntry()],
        filteredEntries: [],
        currentUser: null,
        t,
        recordBackup,
      }),
    );
    await act(async () => {
      await result.current.handleExport();
    });
    expect(downloadSpy).toHaveBeenCalled();
    const [content] = downloadSpy.mock.calls[0];
    expect(JSON.parse(content).version).toBe('1.1.0');
    expect(JSON.parse(content).schemaVersion).toBe(2);
    expect(recordBackup).toHaveBeenCalledTimes(1);
  });

  it('does not record success when the download fails', async () => {
    vi.mocked(exportVaultBackup).mockResolvedValue({ schemaVersion: 2 } as Awaited<
      ReturnType<typeof exportVaultBackup>
    >);
    vi.spyOn(fileDownload, 'downloadTextFile').mockRejectedValue(new Error('下载失败'));
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const recordBackup = vi.fn();
    const { result } = renderHook(() =>
      useDashboardExport({ entries: [], filteredEntries: [], currentUser: null, t, recordBackup }),
    );
    await act(async () => {
      await result.current.handleExport();
    });
    expect(recordBackup).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('下载失败');
  });

  it('handleDownloadNotes triggers downloadTextFile for the active subset', () => {
    const downloadSpy = vi
      .spyOn(fileDownload, 'downloadTextFile')
      .mockImplementation(() => Promise.resolve());
    const entry = baseEntry({ id: 'one', title: 'Title', content: 'Body' });
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [entry],
        filteredEntries: [entry],
        currentUser: 'me',
        t,
        recordBackup: vi.fn(),
      }),
    );
    act(() => result.current.handleDownloadNotes('all'));
    expect(downloadSpy).toHaveBeenCalled();
    const [, filename] = downloadSpy.mock.calls[0];
    expect(filename).toMatch(/\.txt$/i);
  });

  it('exportTarget + isExportDropdownOpen are controlled local state', () => {
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [],
        filteredEntries: [],
        currentUser: null,
        t,
        recordBackup: vi.fn(),
      }),
    );
    expect(result.current.exportTarget).toBe('all');
    expect(result.current.isExportDropdownOpen).toBe(false);
    act(() => result.current.setExportTarget('archived'));
    act(() => result.current.setIsExportDropdownOpen(true));
    expect(result.current.exportTarget).toBe('archived');
    expect(result.current.isExportDropdownOpen).toBe(true);
  });
});
