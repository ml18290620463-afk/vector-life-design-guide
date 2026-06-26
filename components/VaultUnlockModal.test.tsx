import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VaultUnlockModal } from './VaultUnlockModal';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  open: true,
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  vaultPassword: '',
  setVaultPassword: vi.fn(),
  vaultError: false,
  onUnlock: vi.fn(),
  onCancel: vi.fn(),
};

describe('VaultUnlockModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<VaultUnlockModal {...baseProps} open={false} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the dialog with the masterLock label when open', () => {
    render(<VaultUnlockModal {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe(t.masterLock);
  });

  it('typing into the input flows back through setVaultPassword', () => {
    const setVaultPassword = vi.fn();
    const { container } = render(
      <VaultUnlockModal {...baseProps} setVaultPassword={setVaultPassword} />,
    );
    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'pw' } });
    expect(setVaultPassword).toHaveBeenCalledWith('pw');
  });

  it('Enter key on the input triggers onUnlock', () => {
    const onUnlock = vi.fn();
    const { container } = render(<VaultUnlockModal {...baseProps} onUnlock={onUnlock} />);
    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUnlock).toHaveBeenCalled();
  });

  it('Cancel button triggers onCancel and Unlock button triggers onUnlock', () => {
    const onCancel = vi.fn();
    const onUnlock = vi.fn();
    render(<VaultUnlockModal {...baseProps} onCancel={onCancel} onUnlock={onUnlock} />);
    fireEvent.click(screen.getByText(/CANCEL|取消/));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByText(t.open || '解锁'));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('shows the error banner with role="alert" when vaultError is true', () => {
    render(<VaultUnlockModal {...baseProps} vaultError />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(t.passwordMismatch);
  });
});
