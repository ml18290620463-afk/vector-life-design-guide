import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatisticsThemeSwitch } from './StatisticsThemeSwitch';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  onSetTheme: vi.fn(),
};

describe('StatisticsThemeSwitch', () => {
  it('renders the toggle row collapsed by default with aria-expanded=false', () => {
    render(<StatisticsThemeSwitch {...baseProps} />);
    const toggle = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.lightShadowMode));
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the toggle expands the panel and reveals the two theme buttons', () => {
    render(<StatisticsThemeSwitch {...baseProps} />);
    const toggle = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.lightShadowMode))!;
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(t.lightMode)).toBeTruthy();
    expect(screen.getByText(t.darkMode)).toBeTruthy();
  });

  it('the active theme button advertises aria-pressed=true', () => {
    render(<StatisticsThemeSwitch {...baseProps} theme="dark" />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.lightShadowMode))!,
    );
    const lightBtn = screen.getByText(t.lightMode).closest('button')!;
    const darkBtn = screen.getByText(t.darkMode).closest('button')!;
    expect(lightBtn.getAttribute('aria-pressed')).toBe('false');
    expect(darkBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the light theme button calls onSetTheme("light")', () => {
    const onSetTheme = vi.fn();
    render(<StatisticsThemeSwitch {...baseProps} onSetTheme={onSetTheme} theme="dark" />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.lightShadowMode))!,
    );
    fireEvent.click(screen.getByText(t.lightMode).closest('button')!);
    expect(onSetTheme).toHaveBeenCalledWith('light');
  });

  it('clicking the dark theme button calls onSetTheme("dark")', () => {
    const onSetTheme = vi.fn();
    render(<StatisticsThemeSwitch {...baseProps} onSetTheme={onSetTheme} theme="light" />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.lightShadowMode))!,
    );
    fireEvent.click(screen.getByText(t.darkMode).closest('button')!);
    expect(onSetTheme).toHaveBeenCalledWith('dark');
  });
});
