import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PricingPage } from './PricingPage';
import { TRANSLATIONS } from '../constants';
import * as checkoutSvc from '../services/checkoutService';

const t = TRANSLATIONS.zh;

describe('PricingPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders three tier cards (stardust / polaris / owner)', () => {
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={vi.fn()} />);
    expect(screen.getByTestId('pricing-card-stardust')).toBeDefined();
    expect(screen.getByTestId('pricing-card-polaris')).toBeDefined();
    expect(screen.getByTestId('pricing-card-owner')).toBeDefined();
  });

  it('renders monthly USD prices by default', () => {
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={vi.fn()} />);
    const stardust = screen.getByTestId('pricing-card-stardust');
    expect(stardust.textContent).toContain('$4.99 USD');
    const polaris = screen.getByTestId('pricing-card-polaris');
    expect(polaris.textContent).toContain('$9.99 USD');
    const owner = screen.getByTestId('pricing-card-owner');
    expect(owner.textContent).toContain('$199.00 USD');
  });

  it('toggling to annual flips the visible prices for stardust + polaris (owner unchanged)', () => {
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pricing-period-annual'));
    expect(screen.getByTestId('pricing-card-stardust').textContent).toContain('$49.90 USD');
    expect(screen.getByTestId('pricing-card-polaris').textContent).toContain('$99.90 USD');
    expect(screen.getByTestId('pricing-card-owner').textContent).toContain('$199.00 USD');
  });

  it('Subscribe CTAs are disabled until installId hydrates', () => {
    render(<PricingPage theme="dark" t={t} installId={null} onClose={vi.fn()} />);
    const cta = screen.getByTestId('pricing-subscribe-stardust') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it('clicking Subscribe calls startCheckout + redirects on success', async () => {
    const startSpy = vi.spyOn(checkoutSvc, 'startCheckout').mockResolvedValue({
      ok: true,
      url: 'https://checkout.stripe.com/c/pay/cs_AAA',
      sessionId: 'cs_AAA',
    });
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: assignSpy },
    });
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pricing-subscribe-polaris'));
    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledTimes(1);
    });
    expect(startSpy.mock.calls[0][0]).toMatchObject({
      tier: 'polaris',
      period: 'monthly',
      installId: 'install-AAA',
    });
    expect(assignSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_AAA');
  });

  it('startCheckout failure surfaces a localised banner + leaves Subscribe enabled for retry', async () => {
    vi.spyOn(checkoutSvc, 'startCheckout').mockResolvedValue({
      ok: false,
      reason: 'sku-not-configured',
    });
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('pricing-subscribe-stardust'));
    await waitFor(() => {
      expect(screen.getByTestId('pricing-failure')).toBeDefined();
    });
    const cta = screen.getByTestId('pricing-subscribe-stardust') as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it('Close CTA fires onClose', () => {
    const onClose = vi.fn();
    render(<PricingPage theme="dark" t={t} installId="install-AAA" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('pricing-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
