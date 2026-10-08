import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatisticsLanguageSwitch } from './StatisticsLanguageSwitch';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  language: 'zh' as const,
  onSetLanguage: vi.fn(),
};

describe('StatisticsLanguageSwitch', () => {
  it('starts collapsed; toggle row carries aria-expanded=false', () => {
    render(<StatisticsLanguageSwitch {...baseProps} />);
    const toggle = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.interfaceLanguage));
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
  });

  it('expanding renders all 7 supported languages inside a radiogroup', () => {
    render(<StatisticsLanguageSwitch {...baseProps} />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.interfaceLanguage))!,
    );
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
  });

  it('the active language button carries aria-checked=true', () => {
    render(<StatisticsLanguageSwitch {...baseProps} language="ja" />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.interfaceLanguage))!,
    );
    const ja = screen.getByText('日本語');
    expect(ja.getAttribute('aria-checked')).toBe('true');
    const zh = screen.getByText('中文');
    expect(zh.getAttribute('aria-checked')).toBe('false');
  });

  it('clicking a language button routes onSetLanguage with its id', () => {
    const onSetLanguage = vi.fn();
    render(<StatisticsLanguageSwitch {...baseProps} onSetLanguage={onSetLanguage} />);
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(t.interfaceLanguage))!,
    );
    fireEvent.click(screen.getByText('English'));
    expect(onSetLanguage).toHaveBeenCalledWith('en');
  });

  it('toggling flips aria-expanded back to false (the AnimatePresence exit may keep the panel mounted briefly)', () => {
    render(<StatisticsLanguageSwitch {...baseProps} />);
    const toggle = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes(t.interfaceLanguage))!;
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
