import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArchiveVaultEntries } from './ArchiveVaultEntries';
import { TRANSLATIONS } from '../constants';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e',
  title: 'T',
  content: 'B',
  createdAt: Date.UTC(2025, 0, 1),
  tags: [],
  isLocked: false,
  ...overrides,
});

const baseProps = {
  theme: 'dark' as const,
  t,
  groupingMode: 'year' as const,
  groupKeys: ['2025', '2024'],
  groupedEntries: {
    '2025': [baseEntry({ id: 'a', title: '2025-A' })],
    '2024': [baseEntry({ id: 'b', title: '2024-B', createdAt: Date.UTC(2024, 0, 1) })],
  },
  now: Date.now(),
  onSelectEntry: vi.fn(),
};

describe('ArchiveVaultEntries', () => {
  it('renders the empty state when groupKeys is empty', () => {
    render(<ArchiveVaultEntries {...baseProps} groupKeys={[]} groupedEntries={{}} />);
    expect(screen.getByText(t.archiveEmpty)).toBeTruthy();
    expect(screen.getByText(t.waitingForData)).toBeTruthy();
  });

  it('renders one collapsed group panel per groupKey, descending', () => {
    render(<ArchiveVaultEntries {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    // First two buttons are the year toggles.
    expect(buttons[0].textContent).toContain('2025');
    expect(buttons[1].textContent).toContain('2024');
  });

  it('clicking a group toggle expands the bucket (aria-expanded flips)', () => {
    render(<ArchiveVaultEntries {...baseProps} />);
    const yearBtn2025 = screen.getAllByRole('button')[0];
    expect(yearBtn2025.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(yearBtn2025);
    expect(yearBtn2025.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('2025-A')).toBeTruthy();
  });

  it('shows the bucket size + dataSamples label on each group header', () => {
    const big = Array.from({ length: 12 }, (_, i) =>
      baseEntry({ id: `e${i}`, title: `Title ${i}` }),
    );
    render(
      <ArchiveVaultEntries {...baseProps} groupKeys={['2025']} groupedEntries={{ '2025': big }} />,
    );
    expect(screen.getByText(`12 ${t.dataSamples}`)).toBeTruthy();
  });

  it('uses list view when a bucket has > 10 entries', () => {
    const big = Array.from({ length: 11 }, (_, i) =>
      baseEntry({ id: `e${i}`, title: `Title ${i}` }),
    );
    render(
      <ArchiveVaultEntries {...baseProps} groupKeys={['2025']} groupedEntries={{ '2025': big }} />,
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    // List view exposes the spine ordinal "01" badge for the first entry.
    expect(screen.getByText('01')).toBeTruthy();
  });

  it('grouping mode label changes between year/month/day', () => {
    const { rerender } = render(<ArchiveVaultEntries {...baseProps} />);
    expect(screen.getAllByText(t.year).length).toBeGreaterThanOrEqual(1);
    rerender(
      <ArchiveVaultEntries
        {...baseProps}
        groupingMode="month"
        groupKeys={['2025-01']}
        groupedEntries={{ '2025-01': [baseEntry({ id: 'x', title: 'M' })] }}
      />,
    );
    expect(screen.getAllByText(t.month).length).toBeGreaterThanOrEqual(1);
  });
});
