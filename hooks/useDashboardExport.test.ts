import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDashboardExport } from './useDashboardExport';
import type { DiaryEntry } from '../types';
import * as fileDownload from '../services/fileDownload';

afterEach(() => {
  vi.restoreAllMocks();
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
  it('dynamicVersion encodes year-count.totalEntries.archivedEntries', () => {
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [
          baseEntry({ id: 'a', createdAt: Date.UTC(2024, 0, 1) }),
          baseEntry({ id: 'b', createdAt: Date.UTC(2025, 0, 1) }),
          baseEntry({ id: 'c', createdAt: Date.UTC(2025, 6, 1), isArchived: true }),
        ],
        filteredEntries: [],
        currentUser: 'me',
        t,
        recordBackup: vi.fn(),
      }),
    );
    expect(result.current.dynamicVersion).toBe('v2.3.1');
  });

  it('dynamicVersion floors yearCount at 1 even for an empty entry list', () => {
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [],
        filteredEntries: [],
        currentUser: null,
        t,
        recordBackup: vi.fn(),
      }),
    );
    expect(result.current.dynamicVersion).toBe('v1.0.0');
  });

  it('handleExport triggers downloadTextFile + recordBackup', () => {
    const recordBackup = vi.fn();
    const downloadSpy = vi.spyOn(fileDownload, 'downloadTextFile').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useDashboardExport({
        entries: [baseEntry()],
        filteredEntries: [],
        currentUser: null,
        t,
        recordBackup,
      }),
    );
    act(() => result.current.handleExport());
    expect(downloadSpy).toHaveBeenCalled();
    expect(recordBackup).toHaveBeenCalledTimes(1);
  });

  it('handleDownloadNotes triggers downloadTextFile for the active subset', () => {
    const downloadSpy = vi.spyOn(fileDownload, 'downloadTextFile').mockImplementation(() => {});
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
