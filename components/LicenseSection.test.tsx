import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LicenseSection } from './LicenseSection';
import { TRANSLATIONS } from '../constants';
import type { LicensePayload } from '../services/licenseToken';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  installId: 'install-DEADBEEF1234567890DEADBEEF12345678',
  currentTier: 'free' as const,
  payload: null as LicensePayload | null,
  failure: null,
  onActivate: vi.fn(),
  onDeactivate: vi.fn(),
};

const samplePayload = (overrides: Partial<LicensePayload> = {}): LicensePayload => ({
  tier: 'stardust',
  sub: baseProps.installId,
  iat: 1_700_000_000,
  exp: Math.floor(Date.UTC(2030, 0, 1) / 1000),
  kid: 'dev-2026',
  ...overrides,
});

describe('LicenseSection', () => {
  afterEach(() => cleanup());

  it('renders the FREE tier badge when no payload is active', () => {
    render(<LicenseSection {...baseProps} />);
    expect(screen.getByTestId('settings-license-tier').textContent?.toLowerCase()).toContain(
      'free',
    );
    expect(screen.queryByTestId('settings-license-deactivate')).toBeNull();
  });

  it('renders the active tier badge + expires date + Deactivate button when payload is set', () => {
    render(
      <LicenseSection
        {...baseProps}
        currentTier="polaris"
        payload={samplePayload({ tier: 'polaris' })}
      />,
    );
    expect(screen.getByTestId('settings-license-tier').textContent?.toLowerCase()).toContain(
      'polaris',
    );
    expect(screen.getByTestId('settings-license-exp').textContent).toContain('2030');
    expect(screen.getByTestId('settings-license-deactivate')).toBeDefined();
  });

  it('renders the install id verbatim', () => {
    render(<LicenseSection {...baseProps} />);
    expect(screen.getByTestId('settings-license-install-id').textContent).toBe(baseProps.installId);
  });

  it('Activate button is disabled while the input is empty', () => {
    render(<LicenseSection {...baseProps} />);
    const btn = screen.getByTestId('settings-license-activate') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('typing into the input enables the Activate button + clicking calls onActivate', async () => {
    const onActivate = vi.fn().mockResolvedValue(null);
    render(<LicenseSection {...baseProps} onActivate={onActivate} />);
    const input = screen.getByTestId('settings-license-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'vector-license-v1.foo.bar' } });
    const btn = screen.getByTestId('settings-license-activate') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(onActivate).toHaveBeenCalledWith('vector-license-v1.foo.bar');
    });
  });

  it('shows the failure banner when the persisted token failed verification', () => {
    render(<LicenseSection {...baseProps} failure="expired" />);
    expect(screen.getByTestId('settings-license-failure')).toBeDefined();
  });

  it('surfaces an inline error when onActivate returns a failure reason', async () => {
    const onActivate = vi.fn().mockResolvedValue('install-mismatch');
    render(<LicenseSection {...baseProps} onActivate={onActivate} />);
    const input = screen.getByTestId('settings-license-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad-token' } });
    fireEvent.click(screen.getByTestId('settings-license-activate'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-license-failure')).toBeDefined();
    });
  });

  it('Deactivate button calls onDeactivate', () => {
    const onDeactivate = vi.fn();
    render(
      <LicenseSection
        {...baseProps}
        currentTier="stardust"
        payload={samplePayload()}
        onDeactivate={onDeactivate}
      />,
    );
    fireEvent.click(screen.getByTestId('settings-license-deactivate'));
    expect(onDeactivate).toHaveBeenCalled();
  });

  it('renders all five SKUs in the pricing details (USD format)', () => {
    render(<LicenseSection {...baseProps} />);
    const pricingList = screen.getByTestId('settings-license-pricing');
    // Each SKU prints something like "$4.99 USD" — five rows total.
    const usdMatches = pricingList.textContent?.match(/\$\d+\.\d{2} USD/g) ?? [];
    expect(usdMatches.length).toBe(5);
    expect(usdMatches).toContain('$4.99 USD');
    expect(usdMatches).toContain('$199.00 USD');
  });
});
