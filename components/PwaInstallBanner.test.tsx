import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PwaInstallBanner } from './PwaInstallBanner';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

describe('PwaInstallBanner', () => {
  it('renders nothing when active=false', () => {
    const { container } = render(
      <PwaInstallBanner
        active={false}
        theme="dark"
        t={t}
        onInstall={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the install + dismiss affordances when active=true', () => {
    render(<PwaInstallBanner active theme="dark" t={t} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId('pwa-install-banner')).toBeTruthy();
    expect(screen.getByLabelText(t.pwaInstallAction)).toBeTruthy();
    expect(screen.getByLabelText(t.pwaInstallDismiss)).toBeTruthy();
  });

  it('fires onInstall when the install button is clicked', () => {
    const onInstall = vi.fn();
    render(
      <PwaInstallBanner active theme="dark" t={t} onInstall={onInstall} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(t.pwaInstallAction));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <PwaInstallBanner active theme="dark" t={t} onInstall={vi.fn()} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByLabelText(t.pwaInstallDismiss));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses role="status" + aria-live for a11y announcement', () => {
    render(<PwaInstallBanner active theme="light" t={t} onInstall={vi.fn()} onDismiss={vi.fn()} />);
    const banner = screen.getByTestId('pwa-install-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
  });
});
