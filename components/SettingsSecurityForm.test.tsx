import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsSecurityForm } from './SettingsSecurityForm';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  passwordHash: null as string | null,
  oldPassword: '',
  setOldPassword: vi.fn(),
  newPassword: '',
  setNewPassword: vi.fn(),
  confirmPassword: '',
  setConfirmPassword: vi.fn(),
  securityError: null as string | null,
  securitySuccess: null as string | null,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe('SettingsSecurityForm', () => {
  it('omits the "old password" field when there is no existing hash (first-set)', () => {
    render(<SettingsSecurityForm {...baseProps} passwordHash={null} />);
    expect(screen.queryByLabelText(t.oldPassword)).toBeNull();
  });

  it('shows the "old password" field when changing an existing password', () => {
    render(<SettingsSecurityForm {...baseProps} passwordHash="h" />);
    expect(screen.getByLabelText(t.oldPassword)).toBeTruthy();
  });

  it('typing into the new + confirm fields routes through their setters', () => {
    const setNew = vi.fn();
    const setConfirm = vi.fn();
    render(
      <SettingsSecurityForm
        {...baseProps}
        setNewPassword={setNew}
        setConfirmPassword={setConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText(t.newPassword), { target: { value: 'A1!aaaaa' } });
    fireEvent.change(screen.getByLabelText(t.confirmPassword), { target: { value: 'A1!aaaaa' } });
    expect(setNew).toHaveBeenCalledWith('A1!aaaaa');
    expect(setConfirm).toHaveBeenCalledWith('A1!aaaaa');
  });

  it('renders securityError as role="alert" and securitySuccess as role="status"', () => {
    const { rerender } = render(<SettingsSecurityForm {...baseProps} securityError="WEAK" />);
    expect(screen.getByRole('alert').textContent).toContain('WEAK');
    rerender(<SettingsSecurityForm {...baseProps} securitySuccess="SAVED" />);
    expect(screen.getByRole('status').textContent).toContain('SAVED');
  });

  it('Cancel button (top + bottom) routes onCancel; Save/Update routes onSubmit', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(<SettingsSecurityForm {...baseProps} onCancel={onCancel} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(t.cancel));
    fireEvent.click(screen.getByText(t.cancel));
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText(t.save));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows "Update" copy on the submit button when changing an existing password', () => {
    render(<SettingsSecurityForm {...baseProps} passwordHash="h" />);
    expect(screen.getByText(t.update)).toBeTruthy();
    expect(screen.queryByText(t.save)).toBeNull();
  });
});
