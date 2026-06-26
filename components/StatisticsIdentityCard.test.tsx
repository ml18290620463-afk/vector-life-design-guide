import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatisticsIdentityCard } from './StatisticsIdentityCard';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  customIdentity: 'AGENT_42',
  setCustomIdentity: vi.fn(),
  dynamicVersion: 'v1.5.2',
  isUnlocked: true,
  onOpenSecuritySetup: vi.fn(),
};

describe('StatisticsIdentityCard', () => {
  it('renders the editable identity input pre-populated', () => {
    render(<StatisticsIdentityCard {...baseProps} />);
    const input = screen.getByLabelText(t.defineYourself) as HTMLInputElement;
    expect(input.value).toBe('AGENT_42');
  });

  it('typing into the input flows back through setCustomIdentity', () => {
    const setCustomIdentity = vi.fn();
    render(<StatisticsIdentityCard {...baseProps} setCustomIdentity={setCustomIdentity} />);
    fireEvent.change(screen.getByLabelText(t.defineYourself), { target: { value: 'NEW_IDENT' } });
    expect(setCustomIdentity).toHaveBeenCalledWith('NEW_IDENT');
  });

  it('renders the dynamic version chip', () => {
    render(<StatisticsIdentityCard {...baseProps} />);
    expect(screen.getByText(/v1\.5\.2/)).toBeTruthy();
  });

  it('shows the unlocked status copy when isUnlocked=true', () => {
    render(<StatisticsIdentityCard {...baseProps} isUnlocked />);
    expect(screen.getByText(t.statusUnlocked)).toBeTruthy();
  });

  it('shows the online status copy when isUnlocked=false', () => {
    render(<StatisticsIdentityCard {...baseProps} isUnlocked={false} />);
    expect(screen.getByText(t.statusOnline)).toBeTruthy();
  });

  it('clicking the security-calibration row routes onOpenSecuritySetup', () => {
    const onOpenSecuritySetup = vi.fn();
    render(<StatisticsIdentityCard {...baseProps} onOpenSecuritySetup={onOpenSecuritySetup} />);
    const calibrationButton = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.securityCalibration));
    expect(calibrationButton).toBeTruthy();
    fireEvent.click(calibrationButton!);
    expect(onOpenSecuritySetup).toHaveBeenCalled();
  });
});
