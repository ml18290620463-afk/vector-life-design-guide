import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatisticsRecoveryRow } from './StatisticsRecoveryRow';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  language: 'zh' as const,
  passwordHash: null,
  onOpen: vi.fn(),
};

describe('StatisticsRecoveryRow', () => {
  it('renders the localised title and an aria-label on the button', () => {
    render(<StatisticsRecoveryRow {...baseProps} />);
    const button = screen.getByRole('button', { name: t.emergencyAnchor });
    expect(button).toBeTruthy();
  });

  it('shows the "no backup" CTA copy when passwordHash is null', () => {
    render(<StatisticsRecoveryRow {...baseProps} passwordHash={null} />);
    expect(screen.getByText('尚未备份')).toBeTruthy();
  });

  it('shows the "click to view" CTA copy when passwordHash is present', () => {
    render(<StatisticsRecoveryRow {...baseProps} passwordHash="hash" />);
    expect(screen.getByText('点击检视')).toBeTruthy();
    expect(screen.getByText(/32位唯一凭证已备案/)).toBeTruthy();
  });

  it('clicking the button calls onOpen', () => {
    const onOpen = vi.fn();
    render(<StatisticsRecoveryRow {...baseProps} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: t.emergencyAnchor }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('switches to English copy when language="en" + passwordHash present', () => {
    render(
      <StatisticsRecoveryRow
        {...baseProps}
        language="en"
        passwordHash="hash"
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByText('Click to View')).toBeTruthy();
    expect(screen.getByText(/32-char logic anchor secured/)).toBeTruthy();
  });

  it('falls back to t.emergencyAnchorDesc when no password is set (English)', () => {
    render(
      <StatisticsRecoveryRow
        {...baseProps}
        language="en"
        passwordHash={null}
        t={TRANSLATIONS.en}
      />,
    );
    expect(screen.getByText('No Backup')).toBeTruthy();
  });
});
