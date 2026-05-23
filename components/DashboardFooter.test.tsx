import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardFooter } from './DashboardFooter';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

describe('DashboardFooter', () => {
  it('renders the localised quote and sub-quote', () => {
    render(<DashboardFooter theme="dark" t={t} onOpenSettings={vi.fn()} />);
    expect(screen.getByText(t.quote)).toBeTruthy();
    expect(screen.getByText(t.quoteSub)).toBeTruthy();
  });

  it('exposes the boat as a real <button> with an aria-label', () => {
    render(<DashboardFooter theme="dark" t={t} onOpenSettings={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('aria-label')).toBe(t.settingsTitle);
  });

  it('clicking the footer settings button opens settings', () => {
    const onOpenSettings = vi.fn();
    render(<DashboardFooter theme="dark" t={t} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('dashboard-footer-settings'));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('switches palette between dark and light themes', () => {
    const { container, rerender } = render(
      <DashboardFooter theme="dark" t={t} onOpenSettings={vi.fn()} />,
    );
    const wrapperDark = container.firstChild as HTMLElement;
    expect(wrapperDark.className).toContain('bg-black/40');
    rerender(<DashboardFooter theme="light" t={t} onOpenSettings={vi.fn()} />);
    const wrapperLight = container.firstChild as HTMLElement;
    expect(wrapperLight.className).toContain('bg-white/60');
  });
});
