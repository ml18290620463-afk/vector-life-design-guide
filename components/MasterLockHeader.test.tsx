import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MasterLockHeader } from './MasterLockHeader';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  isRecoveryMode: false,
  onBackFromRecovery: vi.fn(),
  onCancel: vi.fn(),
  isConfirmingCancel: false,
  onCancelClick: vi.fn(),
};

describe('MasterLockHeader', () => {
  it('hides the recovery-back link when not in recovery mode', () => {
    render(<MasterLockHeader {...baseProps} isRecoveryMode={false} />);
    expect(screen.queryByText(/返回解锁|BACK/)).toBeNull();
  });

  it('shows the recovery-back link in recovery mode and routes onBackFromRecovery', () => {
    const onBackFromRecovery = vi.fn();
    render(
      <MasterLockHeader {...baseProps} isRecoveryMode onBackFromRecovery={onBackFromRecovery} />,
    );
    fireEvent.click(screen.getByText(/返回解锁/));
    expect(onBackFromRecovery).toHaveBeenCalled();
  });

  it('hides the cancel affordance entirely when onCancel is undefined', () => {
    render(<MasterLockHeader {...baseProps} onCancel={undefined} />);
    expect(screen.queryByLabelText(/返回上一步|Back to Previous Step/)).toBeNull();
  });

  it('renders the cancel button with a title + aria-label when onCancel is provided', () => {
    render(<MasterLockHeader {...baseProps} />);
    const button = screen.getByLabelText('返回上一步');
    expect(button.getAttribute('title')).toBe('返回上一步');
  });

  it('shows the "confirm?" badge with role="alert" when isConfirmingCancel=true', () => {
    render(<MasterLockHeader {...baseProps} isConfirmingCancel />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(t.confirmAction);
  });

  it('clicking the cancel button routes onCancelClick (not onCancel directly)', () => {
    const onCancelClick = vi.fn();
    const onCancel = vi.fn();
    render(<MasterLockHeader {...baseProps} onCancelClick={onCancelClick} onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText('返回上一步'));
    expect(onCancelClick).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
