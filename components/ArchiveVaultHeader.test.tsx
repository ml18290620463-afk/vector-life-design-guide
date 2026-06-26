import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArchiveVaultHeader } from './ArchiveVaultHeader';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

const baseProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  onBack: vi.fn(),
};

describe('ArchiveVaultHeader', () => {
  it('renders the localised title + status', () => {
    render(<ArchiveVaultHeader {...baseProps} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('过去 · 记忆之舟');
    expect(screen.getByText('让经验可以被找回')).toBeTruthy();
  });

  it('does not render the old view tabs or language label', () => {
    render(<ArchiveVaultHeader {...baseProps} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText(t.bioVault)).toBeNull();
    expect(screen.queryByText(t.principles)).toBeNull();
    expect(screen.queryByText('ZH')).toBeNull();
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<ArchiveVaultHeader {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText(t.backToConsole));
    expect(onBack).toHaveBeenCalled();
  });
});
