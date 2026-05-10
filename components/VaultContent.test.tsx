import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VaultContent } from './VaultContent';
import { TRANSLATIONS } from '../constants';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'e',
  title: 'T',
  content: 'B',
  createdAt: 1,
  tags: [],
  isLocked: false,
  ...overrides,
});

const baseProps = {
  isVaultOpen: false,
  onUnsealRequest: vi.fn(),
  loading: false,
  theme: 'dark' as const,
  language: 'zh' as const,
  t,
  searchQuery: '',
  paginatedEntries: [] as DiaryEntry[],
  filteredEntries: [] as DiaryEntry[],
  hasMore: false,
  onLoadMore: vi.fn(),
  groupingMode: 'none' as const,
  groupedEntries: {} as Record<string, DiaryEntry[]>,
  groupKeys: [] as string[],
  isListView: false,
  onSelectEntry: vi.fn(),
  showFilterHub: false,
  setShowFilterHub: vi.fn(),
  customIdentity: 'GUEST',
  currentUser: null as string | null,
};

describe('VaultContent', () => {
  it('sealed wrapper announces itself as a button to assistive tech', () => {
    render(<VaultContent {...baseProps} isVaultOpen={false} />);
    const button = screen.getByRole('button', { name: t.clickToUnlock || '点击解锁' });
    expect(button).toBeTruthy();
  });

  it('open wrapper does NOT advertise itself as a button', () => {
    render(<VaultContent {...baseProps} isVaultOpen paginatedEntries={[baseEntry()]} />);
    expect(screen.queryByRole('button', { name: t.clickToUnlock || '点击解锁' })).toBeNull();
  });

  it('clicking the sealed wrapper triggers onUnsealRequest', () => {
    const onUnsealRequest = vi.fn();
    render(<VaultContent {...baseProps} onUnsealRequest={onUnsealRequest} />);
    fireEvent.click(screen.getByRole('button', { name: t.clickToUnlock || '点击解锁' }));
    expect(onUnsealRequest).toHaveBeenCalled();
  });

  it('Enter or Space keypress on the sealed wrapper triggers onUnsealRequest', () => {
    const onUnsealRequest = vi.fn();
    render(<VaultContent {...baseProps} onUnsealRequest={onUnsealRequest} />);
    const button = screen.getByRole('button', { name: t.clickToUnlock || '点击解锁' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onUnsealRequest).toHaveBeenCalledTimes(2);
  });

  it('renders the loading spinner when loading is true', () => {
    const { container } = render(<VaultContent {...baseProps} loading isVaultOpen />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders a "load more" button only when hasMore is true and grouping is "none"', () => {
    const { rerender } = render(<VaultContent {...baseProps} isVaultOpen hasMore />);
    expect(screen.queryByText(/LOAD MORE RECORDS|加载更多记录/)).toBeTruthy();
    rerender(<VaultContent {...baseProps} isVaultOpen hasMore={false} />);
    expect(screen.queryByText(/LOAD MORE RECORDS|加载更多记录/)).toBeNull();
  });
});
