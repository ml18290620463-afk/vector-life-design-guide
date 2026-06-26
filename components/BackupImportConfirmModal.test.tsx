import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BackupImportConfirmModal } from './BackupImportConfirmModal';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

describe('BackupImportConfirmModal', () => {
  it('renders nothing when pending is null', () => {
    const { container } = render(
      <BackupImportConfirmModal pending={null} theme="dark" t={t} onResolve={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the message body when pending is present', () => {
    render(
      <BackupImportConfirmModal
        pending={{ message: 'Replace 12 entries?' }}
        theme="dark"
        t={t}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/Replace 12 entries\?/)).toBeTruthy();
  });

  it('Cancel button calls onResolve(false)', () => {
    const onResolve = vi.fn();
    render(
      <BackupImportConfirmModal
        pending={{ message: 'Y/N?' }}
        theme="dark"
        t={t}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByText(t.confirmCancel ?? 'Cancel'));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it('Import button calls onResolve(true)', () => {
    const onResolve = vi.fn();
    render(
      <BackupImportConfirmModal
        pending={{ message: 'Y/N?' }}
        theme="dark"
        t={t}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByText(t.confirmImport ?? 'Import'));
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('exposes proper dialog semantics (role + aria-modal + aria-label)', () => {
    render(
      <BackupImportConfirmModal
        pending={{ message: 'Y/N?' }}
        theme="dark"
        t={t}
        onResolve={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe(t.importStarMap ?? 'Restore Backup');
  });
});
