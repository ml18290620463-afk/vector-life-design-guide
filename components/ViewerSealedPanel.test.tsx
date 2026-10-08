import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewerSealedPanel } from './ViewerSealedPanel';
import type { DiaryEntry } from '../types';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseEntry: DiaryEntry = {
  id: 'entry-1',
  title: 'Test Entry',
  content: 'cipher',
  createdAt: Date.UTC(2026, 4, 1, 12, 0, 0),
  tags: [],
  isLocked: false,
};

const baseProps = {
  theme: 'dark' as const,
  t,
  entry: baseEntry,
  displayIdentity: 'AGENT_42',
  viewState: 'sealed' as const,
  decryptionPassword: '',
  setDecryptionPassword: vi.fn(),
  decryptionError: null as string | null,
  biometricError: null as string | null,
  isScanning: false,
  lockoutUntil: null as number | null,
  isTimeLocked: false,
  timeLeft: null as { d: number; h: number; m: number; s: number } | null,
  rippleStars: [
    { top: '10%', right: '10%', duration: 3, delay: 0.1 },
    { top: '20%', right: '15%', duration: 4, delay: 0.2 },
  ],
  onOpenLetter: vi.fn(),
  onBack: vi.fn(),
};

describe('ViewerSealedPanel', () => {
  it('renders the password input by default', () => {
    render(<ViewerSealedPanel {...baseProps} />);
    expect(screen.getByLabelText(t.securityCalibration)).toBeTruthy();
  });

  it('typing into the input flows back through setDecryptionPassword', () => {
    const setPwd = vi.fn();
    render(<ViewerSealedPanel {...baseProps} setDecryptionPassword={setPwd} />);
    const input = screen.getByLabelText(t.securityCalibration);
    fireEvent.change(input, { target: { value: 'secret' } });
    expect(setPwd).toHaveBeenCalledWith('secret');
  });

  it('Enter key triggers onOpenLetter', () => {
    const onOpen = vi.fn();
    render(<ViewerSealedPanel {...baseProps} onOpenLetter={onOpen} />);
    fireEvent.keyDown(screen.getByLabelText(t.securityCalibration), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalled();
  });

  it('Back button calls onBack', () => {
    const onBack = vi.fn();
    render(<ViewerSealedPanel {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText(t.abort));
    expect(onBack).toHaveBeenCalled();
  });

  it('hides the password input when the entry is time-locked, shows the countdown', () => {
    render(<ViewerSealedPanel {...baseProps} isTimeLocked timeLeft={{ d: 1, h: 2, m: 3, s: 4 }} />);
    expect(screen.queryByLabelText(t.securityCalibration)).toBeNull();
    // Padded "01" / "02" / "03" / "04" all appear in the countdown.
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('04')).toBeTruthy();
  });

  it('renders an error banner with role="alert" for decryption failures', () => {
    render(<ViewerSealedPanel {...baseProps} decryptionError="bad password" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('bad password');
  });

  it('biometricError takes precedence over decryptionError in the alert', () => {
    render(
      <ViewerSealedPanel
        {...baseProps}
        decryptionError="bad password"
        biometricError="env restricted"
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('env restricted');
  });
});
