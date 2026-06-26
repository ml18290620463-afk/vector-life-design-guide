import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsBackupSection } from './SettingsBackupSection';
import { TRANSLATIONS } from '../constants';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e',
  title: 'T',
  content: 'B',
  createdAt: Date.UTC(2025, 0, 1),
  tags: [],
  isLocked: false,
  ...overrides,
});

const baseProps = {
  theme: 'dark' as const,
  t,
  onExport: vi.fn(),
  onDownloadNotes: vi.fn(),
  exportTarget: 'all',
  setExportTarget: vi.fn(),
  isExportDropdownOpen: false,
  setIsExportDropdownOpen: vi.fn(),
  dropdownRef: createRef<HTMLDivElement | null>(),
  entries: [
    baseEntry({ id: 'a', title: 'Alpha' }),
    baseEntry({ id: 'b', title: 'Beta', isArchived: true }),
    baseEntry({ id: 'c', title: 'Gamma' }),
  ] as DiaryEntry[],
  importInputRef: undefined as React.RefObject<HTMLInputElement | null> | undefined,
  onImportBackup: undefined as ((e: React.ChangeEvent<HTMLInputElement>) => void) | undefined,
  importStatus: null as { kind: 'success' | 'error'; message: string } | null,
};

describe('SettingsBackupSection', () => {
  it('clicking the export button calls onExport', () => {
    const onExport = vi.fn();
    render(<SettingsBackupSection {...baseProps} onExport={onExport} />);
    fireEvent.click(screen.getByText(t.btnExportStarMap));
    expect(onExport).toHaveBeenCalled();
  });

  it('does not render the import affordance when onImportBackup is undefined', () => {
    render(<SettingsBackupSection {...baseProps} />);
    expect(screen.queryByText(t.btnImportStarMap ?? 'Import JSON')).toBeNull();
  });

  it('renders the import affordance when onImportBackup is provided', () => {
    const importInputRef = createRef<HTMLInputElement | null>();
    render(
      <SettingsBackupSection
        {...baseProps}
        importInputRef={importInputRef}
        onImportBackup={vi.fn()}
      />,
    );
    expect(screen.getByText(t.btnImportStarMap ?? 'Import JSON')).toBeTruthy();
  });

  it('importStatus surfaces a role="status" message in the import block', () => {
    render(
      <SettingsBackupSection
        {...baseProps}
        importInputRef={createRef<HTMLInputElement | null>()}
        onImportBackup={vi.fn()}
        importStatus={{ kind: 'success', message: 'Imported 5 entries' }}
      />,
    );
    expect(screen.getByText(/Imported 5 entries/)).toBeTruthy();
  });

  it('Notes dropdown is hidden by default and shows menu items when open', () => {
    const { rerender } = render(<SettingsBackupSection {...baseProps} />);
    expect(screen.queryByRole('menu')).toBeNull();
    rerender(<SettingsBackupSection {...baseProps} isExportDropdownOpen />);
    const menuItems = screen.getAllByRole('menuitem');
    // "Export all" + 2 non-archived entries (Alpha, Gamma) — Beta is archived.
    expect(menuItems.length).toBe(3);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('clicking a Notes menuitem flows through setExportTarget + onDownloadNotes + closes the dropdown', () => {
    const setExportTarget = vi.fn();
    const setIsExportDropdownOpen = vi.fn();
    const onDownloadNotes = vi.fn();
    render(
      <SettingsBackupSection
        {...baseProps}
        isExportDropdownOpen
        setExportTarget={setExportTarget}
        setIsExportDropdownOpen={setIsExportDropdownOpen}
        onDownloadNotes={onDownloadNotes}
      />,
    );
    fireEvent.click(screen.getByText('Alpha'));
    expect(setExportTarget).toHaveBeenCalledWith('a');
    expect(setIsExportDropdownOpen).toHaveBeenCalledWith(false);
    expect(onDownloadNotes).toHaveBeenCalledWith('a');
  });
});
