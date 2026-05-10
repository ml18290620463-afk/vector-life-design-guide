import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MasterLockRecoveryForm } from './MasterLockRecoveryForm';
import type { TranslationDictionary } from '../i18n/translations';
import type { RecoveryFlowState } from '../hooks/useRecoveryFlow';

const t = {
  resetPassword: 'Reset Password',
  inputRecoveryKey: 'Input Recovery Key',
  recoveryKeyTitle: 'Recovery Key',
  newPassword: 'New Password',
  confirmPassword: 'Confirm Password',
  confirmAction: 'Confirm',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
} as unknown as TranslationDictionary;

const buildRecovery = (overrides: Partial<RecoveryFlowState> = {}): RecoveryFlowState => ({
  isRecoveryMode: true,
  recoveryInput: '',
  newPassword: '',
  confirmNewPassword: '',
  resetError: null,
  showKey: false,
  showNewPassword: false,
  setIsRecoveryMode: vi.fn(),
  setRecoveryInput: vi.fn(),
  setNewPassword: vi.fn(),
  setConfirmNewPassword: vi.fn(),
  toggleShowKey: vi.fn(),
  toggleShowNewPassword: vi.fn(),
  submitRecovery: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('MasterLockRecoveryForm', () => {
  it('renders the three labelled inputs and the submit affordance', () => {
    render(<MasterLockRecoveryForm theme="dark" t={t} recovery={buildRecovery()} />);
    expect(screen.getByLabelText('Recovery Key')).not.toBeNull();
    expect(screen.getByLabelText('New Password')).not.toBeNull();
    expect(screen.getByLabelText('Confirm Password')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeNull();
  });

  it('routes input changes to the recovery setters', () => {
    const recovery = buildRecovery();
    render(<MasterLockRecoveryForm theme="dark" t={t} recovery={recovery} />);
    fireEvent.change(screen.getByLabelText('Recovery Key'), { target: { value: 'KEY' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'P@ss1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'P@ss1' } });
    expect(recovery.setRecoveryInput).toHaveBeenCalledWith('KEY');
    expect(recovery.setNewPassword).toHaveBeenCalledWith('P@ss1');
    expect(recovery.setConfirmNewPassword).toHaveBeenCalledWith('P@ss1');
  });

  it('reflects showKey by switching the recovery input type', () => {
    const { rerender } = render(
      <MasterLockRecoveryForm theme="dark" t={t} recovery={buildRecovery({ showKey: false })} />,
    );
    expect((screen.getByLabelText('Recovery Key') as HTMLInputElement).type).toBe('password');
    rerender(
      <MasterLockRecoveryForm theme="dark" t={t} recovery={buildRecovery({ showKey: true })} />,
    );
    expect((screen.getByLabelText('Recovery Key') as HTMLInputElement).type).toBe('text');
  });

  it('toggles password visibility on both new + confirm via the same handler', () => {
    const recovery = buildRecovery();
    render(<MasterLockRecoveryForm theme="dark" t={t} recovery={recovery} />);
    const toggles = screen.getAllByRole('button', { name: /Show password|Hide password/ });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    expect(recovery.toggleShowNewPassword).toHaveBeenCalledTimes(2);
  });

  it('renders the error banner with role="alert" only when resetError is set', () => {
    const { rerender } = render(
      <MasterLockRecoveryForm theme="dark" t={t} recovery={buildRecovery()} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <MasterLockRecoveryForm
        theme="dark"
        t={t}
        recovery={buildRecovery({ resetError: 'Bad key' })}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Bad key');
  });

  it('submits via the bound recovery.submitRecovery callback', () => {
    const recovery = buildRecovery();
    render(<MasterLockRecoveryForm theme="dark" t={t} recovery={recovery} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(recovery.submitRecovery).toHaveBeenCalledTimes(1);
  });
});
