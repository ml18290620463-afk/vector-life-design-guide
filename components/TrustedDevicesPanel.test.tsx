import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrustedDevicesPanel } from './TrustedDevicesPanel';
import { TRANSLATIONS } from '../constants';
import type { TrustedDevice } from '../services/trustedDevices';

const t = TRANSLATIONS.zh;

const sample = (overrides: Partial<TrustedDevice> = {}): TrustedDevice => ({
  publicKey: overrides.publicKey ?? 'pk-AAA',
  fingerprint: overrides.fingerprint ?? 'AAAA-BBBB-CCCC-DDDD',
  label: overrides.label ?? '我的旧 iPhone',
  trustedAt: overrides.trustedAt ?? Date.UTC(2026, 4, 1),
});

describe('TrustedDevicesPanel', () => {
  afterEach(() => cleanup());

  it('renders the loading state when loading=true', () => {
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[]}
        loading
        onRevoke={vi.fn()}
        onRelabel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('trusted-devices-loading')).toBeDefined();
  });

  it('renders the empty state when there are no trusted devices', () => {
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[]}
        onRevoke={vi.fn()}
        onRelabel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('trusted-devices-empty')).toBeDefined();
  });

  it('renders one row per trust entry with fingerprint + label + date', () => {
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[
          sample(),
          sample({ publicKey: 'pk-BBB', fingerprint: 'EEEE-FFFF-GGGG-HHHH', label: '新 MacBook' }),
        ]}
        onRevoke={vi.fn()}
        onRelabel={vi.fn()}
      />,
    );
    const rows = screen.getAllByTestId(/^trusted-devices-row-/);
    expect(rows).toHaveLength(2);
    expect(screen.getByText('AAAA-BBBB-CCCC-DDDD')).toBeDefined();
    expect(screen.getByText('我的旧 iPhone')).toBeDefined();
  });

  it('edit pencil → input → save calls onRelabel', () => {
    const onRelabel = vi.fn();
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[sample()]}
        onRevoke={vi.fn()}
        onRelabel={onRelabel}
      />,
    );
    fireEvent.click(screen.getByTestId('trusted-devices-edit-AAAA-BBBB-CCCC-DDDD'));
    const input = screen.getByTestId(
      'trusted-devices-edit-input-AAAA-BBBB-CCCC-DDDD',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '新名字' } });
    fireEvent.click(screen.getByTestId('trusted-devices-save-AAAA-BBBB-CCCC-DDDD'));
    expect(onRelabel).toHaveBeenCalledWith('pk-AAA', '新名字');
  });

  it('revoke first click arms; second click within 5s fires onRevoke', async () => {
    const onRevoke = vi.fn();
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[sample()]}
        onRevoke={onRevoke}
        onRelabel={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('trusted-devices-revoke-AAAA-BBBB-CCCC-DDDD');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(t.trustedDevicesRevokeConfirm as string)).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('trusted-devices-revoke-AAAA-BBBB-CCCC-DDDD'));
    expect(onRevoke).toHaveBeenCalledWith('pk-AAA');
  });

  it('clicking the close button fires onClose', () => {
    const onClose = vi.fn();
    render(
      <TrustedDevicesPanel
        open
        onClose={onClose}
        theme="dark"
        t={t}
        trusted={[]}
        onRevoke={vi.fn()}
        onRelabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText((t.close as string) ?? 'Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders italic placeholder when entry.label is empty', () => {
    render(
      <TrustedDevicesPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        trusted={[sample({ label: '' })]}
        onRevoke={vi.fn()}
        onRelabel={vi.fn()}
      />,
    );
    expect(screen.getByText(t.trustedDevicesNoLabel as string)).toBeDefined();
  });
});
