import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BackupReminderBanner } from './BackupReminderBanner';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

describe('BackupReminderBanner', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <BackupReminderBanner
        active={false}
        daysSinceBackup={null}
        theme="dark"
        t={t}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders status banner with role="status" + aria-live="polite" when active', () => {
    render(
      <BackupReminderBanner
        active
        daysSinceBackup={42}
        theme="dark"
        t={t}
        onOpenSettings={vi.fn()}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('substitutes the {days} placeholder when daysSinceBackup is provided', () => {
    render(
      <BackupReminderBanner
        active
        daysSinceBackup={42}
        theme="dark"
        t={t}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('42');
  });

  it('shows the "never exported" copy when daysSinceBackup is null', () => {
    render(
      <BackupReminderBanner
        active
        daysSinceBackup={null}
        theme="dark"
        t={{ ...t, backupReminderNever: 'NEVER_EXPORTED' }}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('NEVER_EXPORTED');
  });

  it('clicking "open settings" call invokes onOpenSettings', () => {
    const onOpenSettings = vi.fn();
    render(
      <BackupReminderBanner
        active
        daysSinceBackup={5}
        theme="dark"
        t={{ ...t, backupReminderAction: 'OPEN_SETTINGS_LABEL' }}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(screen.getByText('OPEN_SETTINGS_LABEL'));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
