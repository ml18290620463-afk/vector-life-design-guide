import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardFooter } from './DashboardFooter';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

describe('DashboardFooter', () => {
  it('renders the localised quote and sub-quote', () => {
    render(<DashboardFooter theme="dark" t={t} isSailingHome={false} onGoHome={vi.fn()} />);
    expect(screen.getByText(t.quote)).toBeTruthy();
    expect(screen.getByText(t.quoteSub)).toBeTruthy();
  });

  it('exposes the boat as a real <button> with an aria-label', () => {
    render(<DashboardFooter theme="dark" t={t} isSailingHome={false} onGoHome={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('aria-label')).toBeTruthy();
  });

  it('clicking the boat button calls onGoHome', () => {
    const onGoHome = vi.fn();
    render(<DashboardFooter theme="dark" t={t} isSailingHome={false} onGoHome={onGoHome} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onGoHome).toHaveBeenCalled();
  });

  it('isSailingHome=true applies the sail-away animation classes', () => {
    render(<DashboardFooter theme="dark" t={t} isSailingHome onGoHome={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('translate-x-[200px]');
    expect(button.className).toContain('opacity-0');
  });

  it('switches palette between dark and light themes', () => {
    const { container, rerender } = render(
      <DashboardFooter theme="dark" t={t} isSailingHome={false} onGoHome={vi.fn()} />,
    );
    const wrapperDark = container.firstChild as HTMLElement;
    expect(wrapperDark.className).toContain('bg-black/40');
    rerender(<DashboardFooter theme="light" t={t} isSailingHome={false} onGoHome={vi.fn()} />);
    const wrapperLight = container.firstChild as HTMLElement;
    expect(wrapperLight.className).toContain('bg-white/60');
  });
});
