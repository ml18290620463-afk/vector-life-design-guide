import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MasterLockUnlockForm } from './MasterLockUnlockForm';
import type { TranslationDictionary } from '../i18n/translations';

const t = {
  enterMasterPassword: 'Enter master password',
  scanningBiometrics: 'Scanning biometrics',
  identityVerified: 'Identity verified',
  masterLock: 'Master Lock',
  forgotPassword: 'Forgot password?',
  passwordMismatch: 'Wrong password',
  tooManyAttempts: 'Too many attempts',
} as unknown as TranslationDictionary;

const baseProps = {
  theme: 'dark' as const,
  t,
  language: 'en' as const,
  password: '',
  onPasswordChange: vi.fn(),
  showUnlockPassword: false,
  onToggleShowPassword: vi.fn(),
  onSubmit: vi.fn(),
  isDecrypting: false,
  isScanning: false,
  isSuccess: false,
  isRitualActive: false,
  error: false,
  biometricError: null,
  lockout: { isLocked: false, secondsRemaining: 0 },
  onForgotPassword: vi.fn(),
};

describe('MasterLockUnlockForm', () => {
  it('renders the labelled password input + toggle + forgot affordance', () => {
    render(<MasterLockUnlockForm {...baseProps} />);
    expect(screen.getByLabelText('Enter master password')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show password' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).not.toBeNull();
  });

  it('routes input changes through onPasswordChange', () => {
    const onPasswordChange = vi.fn();
    render(<MasterLockUnlockForm {...baseProps} onPasswordChange={onPasswordChange} />);
    fireEvent.change(screen.getByLabelText('Enter master password'), { target: { value: 'abcd' } });
    expect(onPasswordChange).toHaveBeenCalledWith('abcd');
  });

  it('fires onSubmit only when Enter is pressed on a non-empty, non-locked field', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <MasterLockUnlockForm {...baseProps} password="hello" onSubmit={onSubmit} />,
    );
    fireEvent.keyDown(screen.getByLabelText('Enter master password'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    onSubmit.mockClear();
    rerender(<MasterLockUnlockForm {...baseProps} password="abc" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByLabelText('Enter master password'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    onSubmit.mockClear();
    rerender(
      <MasterLockUnlockForm
        {...baseProps}
        password="hello"
        lockout={{ isLocked: true, secondsRemaining: 10 }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('Enter master password'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the lockout badge with seconds when locked', () => {
    render(
      <MasterLockUnlockForm {...baseProps} lockout={{ isLocked: true, secondsRemaining: 17 }} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Too many attempts (17s)');
  });

  it('shows biometricError text in the badge when present', () => {
    render(<MasterLockUnlockForm {...baseProps} error biometricError="Sensor unreachable" />);
    expect(screen.getByRole('alert').textContent).toContain('Sensor unreachable');
  });

  it('flips the toggle aria state when showUnlockPassword changes', () => {
    const { rerender } = render(<MasterLockUnlockForm {...baseProps} showUnlockPassword={false} />);
    expect(screen.getByRole('button', { name: 'Show password' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    rerender(<MasterLockUnlockForm {...baseProps} showUnlockPassword />);
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('disables both inputs while a ritual / scan / success / lockout is in flight', () => {
    const { rerender } = render(<MasterLockUnlockForm {...baseProps} isRitualActive />);
    expect((screen.getByLabelText('Enter master password') as HTMLInputElement).disabled).toBe(
      true,
    );

    rerender(
      <MasterLockUnlockForm {...baseProps} lockout={{ isLocked: true, secondsRemaining: 5 }} />,
    );
    expect((screen.getByLabelText('Enter master password') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('routes the forgot-password click to onForgotPassword', () => {
    const onForgotPassword = vi.fn();
    render(<MasterLockUnlockForm {...baseProps} onForgotPassword={onForgotPassword} />);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });
});
