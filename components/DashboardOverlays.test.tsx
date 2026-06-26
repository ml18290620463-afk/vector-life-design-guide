import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardOverlays } from './DashboardOverlays';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  backupReminderActive: false,
  daysSinceBackup: null as number | null,
  onOpenSettings: vi.fn(),
  pwaInstallAvailable: false,
  onPwaInstall: vi.fn(),
  onPwaInstallDismiss: vi.fn(),
  importPending: null as { message: string } | null,
  onResolveImport: vi.fn(),
  isVerifyingVault: false,
  vaultPassword: '',
  setVaultPassword: vi.fn(),
  vaultError: false,
  onUnlockVault: vi.fn(),
  onCancelVault: vi.fn(),
};

describe('DashboardOverlays', () => {
  it('renders nothing visible when every overlay is dormant', () => {
    const { container } = render(<DashboardOverlays {...baseProps} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('shows the backup-reminder banner only when active is true', () => {
    const { rerender } = render(<DashboardOverlays {...baseProps} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<DashboardOverlays {...baseProps} backupReminderActive daysSinceBackup={42} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('42');
  });

  it('renders the backup-import confirmation modal when importPending is non-null', () => {
    const onResolveImport = vi.fn();
    render(
      <DashboardOverlays
        {...baseProps}
        importPending={{ message: 'Replace 12 entries?' }}
        onResolveImport={onResolveImport}
      />,
    );
    expect(screen.getByText(/Replace 12 entries\?/)).toBeTruthy();
    fireEvent.click(screen.getByText(t.confirmImport ?? 'Import'));
    expect(onResolveImport).toHaveBeenCalledWith(true);
  });

  it('renders the vault-unlock modal only when isVerifyingVault is true', () => {
    const { rerender, container } = render(<DashboardOverlays {...baseProps} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    rerender(<DashboardOverlays {...baseProps} isVerifyingVault />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
  });

  it('typing into the vault password input flows back through setVaultPassword', () => {
    const setVaultPassword = vi.fn();
    const { container } = render(
      <DashboardOverlays {...baseProps} isVerifyingVault setVaultPassword={setVaultPassword} />,
    );
    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'pw' } });
    expect(setVaultPassword).toHaveBeenCalledWith('pw');
  });

  it('clicking the banner "open settings" link routes onOpenSettings', () => {
    const onOpenSettings = vi.fn();
    render(
      <DashboardOverlays
        {...baseProps}
        backupReminderActive
        daysSinceBackup={5}
        t={{ ...t, backupReminderAction: 'OPEN_SETTINGS' }}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(screen.getByText('OPEN_SETTINGS'));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
