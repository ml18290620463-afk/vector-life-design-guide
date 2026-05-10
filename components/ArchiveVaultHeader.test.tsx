import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArchiveVaultHeader } from './ArchiveVaultHeader';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  t,
  showFilterHub: false,
  onToggleFilterHub: vi.fn(),
  view: 'vault' as const,
  onSetView: vi.fn(),
  onBack: vi.fn(),
};

describe('ArchiveVaultHeader', () => {
  it('renders the localised title + status', () => {
    render(<ArchiveVaultHeader {...baseProps} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(t.appTitle);
    expect(screen.getByText(t.archiveStatus)).toBeTruthy();
  });

  it('exposes a tablist with two tabs and the active one carries aria-selected', () => {
    render(<ArchiveVaultHeader {...baseProps} view="vault" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
    const vaultTab = screen.getByRole('tab', { name: t.bioVault });
    const principlesTab = screen.getByRole('tab', { name: t.principles });
    expect(vaultTab.getAttribute('aria-selected')).toBe('true');
    expect(principlesTab.getAttribute('aria-selected')).toBe('false');
  });

  it('clicking the principles tab calls onSetView with "principles"', () => {
    const onSetView = vi.fn();
    render(<ArchiveVaultHeader {...baseProps} onSetView={onSetView} />);
    fireEvent.click(screen.getByRole('tab', { name: t.principles }));
    expect(onSetView).toHaveBeenCalledWith('principles');
  });

  it('FilterHub toggle button advertises aria-pressed and calls the toggle', () => {
    const onToggleFilterHub = vi.fn();
    const { rerender } = render(
      <ArchiveVaultHeader {...baseProps} onToggleFilterHub={onToggleFilterHub} />,
    );
    const toggle = screen.getByLabelText(t.filter ?? 'Filter');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggleFilterHub).toHaveBeenCalled();
    rerender(
      <ArchiveVaultHeader {...baseProps} showFilterHub onToggleFilterHub={onToggleFilterHub} />,
    );
    expect(screen.getByLabelText(t.filter ?? 'Filter').getAttribute('aria-pressed')).toBe('true');
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<ArchiveVaultHeader {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByText(t.backToConsole));
    expect(onBack).toHaveBeenCalled();
  });

  it('switches the active tab styling between vault and principles', () => {
    const { rerender } = render(<ArchiveVaultHeader {...baseProps} view="vault" />);
    expect(screen.getByRole('tab', { name: t.bioVault }).getAttribute('aria-selected')).toBe(
      'true',
    );
    rerender(<ArchiveVaultHeader {...baseProps} view="principles" />);
    expect(screen.getByRole('tab', { name: t.principles }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});
