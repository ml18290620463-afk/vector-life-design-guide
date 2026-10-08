import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsBackupSection } from './SettingsBackupSection';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  onExport: vi.fn(),
  importInputRef: undefined as React.RefObject<HTMLInputElement | null> | undefined,
  onImportBackup: undefined as ((e: React.ChangeEvent<HTMLInputElement>) => void) | undefined,
  importStatus: null as { kind: 'success' | 'error'; message: string } | null,
};

describe('SettingsBackupSection', () => {
  it('clicking the complete backup button calls onExport', () => {
    const onExport = vi.fn();
    render(<SettingsBackupSection {...baseProps} onExport={onExport} />);
    fireEvent.click(screen.getByText(t.btnExportStarMap));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('does not render the restore affordance when onImportBackup is undefined', () => {
    render(<SettingsBackupSection {...baseProps} />);
    expect(screen.queryByText(t.btnImportStarMap ?? 'Restore backup')).toBeNull();
  });

  it('renders the restore affordance when onImportBackup is provided', () => {
    const importInputRef = createRef<HTMLInputElement | null>();
    render(
      <SettingsBackupSection
        {...baseProps}
        importInputRef={importInputRef}
        onImportBackup={vi.fn()}
      />,
    );
    expect(screen.getByText(t.btnImportStarMap ?? 'Restore backup')).toBeTruthy();
  });

  it('surfaces the restore status inside the restore section', () => {
    render(
      <SettingsBackupSection
        {...baseProps}
        importInputRef={createRef<HTMLInputElement | null>()}
        onImportBackup={vi.fn()}
        importStatus={{ kind: 'success', message: 'Imported 5 entries' }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Imported 5 entries');
  });
});
