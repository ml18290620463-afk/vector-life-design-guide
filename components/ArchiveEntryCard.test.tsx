import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArchiveEntryCard } from './ArchiveEntryCard';
import { TRANSLATIONS } from '../constants';
import type { DiaryEntry } from '../types';

const t = TRANSLATIONS.zh;

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'abcd1234',
  title: 'Sample Entry',
  content: 'Body',
  createdAt: Date.UTC(2025, 5, 15),
  tags: ['alpha', 'beta'],
  isLocked: false,
  ...overrides,
});

describe('ArchiveEntryCard', () => {
  it('grid view renders title + archive id + tag list', () => {
    render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry()}
        index={1}
        isListView={false}
        delayIndex={0}
        now={Date.now()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Sample Entry')).toBeTruthy();
    expect(screen.getByText('AR-25-ABCD')).toBeTruthy();
    expect(screen.getByText(/#alpha/)).toBeTruthy();
  });

  it('list view shows the bracketed date + ordinal index', () => {
    render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry()}
        index={3}
        isListView
        delayIndex={2}
        now={Date.now()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText(/2025/)).toBeTruthy();
  });

  it('time-locked entries show the lock badge instead of the verified badge', () => {
    const future = Date.now() + 1_000_000;
    render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry({ unlockAt: future })}
        index={1}
        isListView
        delayIndex={0}
        now={Date.now()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(t.encryptedRecord || 'RESTRICTED')).toBeTruthy();
    expect(screen.queryByText(t.safeRecord || 'VERIFIED')).toBeNull();
  });

  it('clicking a non-locked card calls onSelect with the entry', () => {
    const onSelect = vi.fn();
    const entry = baseEntry();
    render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={entry}
        index={1}
        isListView={false}
        delayIndex={0}
        now={Date.now()}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Sample Entry'));
    expect(onSelect).toHaveBeenCalledWith(entry);
  });

  it('clicking a time-locked card does NOT call onSelect (visually disabled)', () => {
    const onSelect = vi.fn();
    const future = Date.now() + 1_000_000;
    render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry({ unlockAt: future })}
        index={1}
        isListView={false}
        delayIndex={0}
        now={Date.now()}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Sample Entry'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the paperclip when entry.attachment is present (grid view)', () => {
    const { container, rerender } = render(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry()}
        index={1}
        isListView={false}
        delayIndex={0}
        now={Date.now()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('.lucide-paperclip')).toBeNull();
    rerender(
      <ArchiveEntryCard
        theme="dark"
        t={t}
        entry={baseEntry({
          attachment: { type: 'image', name: 'p.png', data: 'data:', mimeType: 'image/png' },
        })}
        index={1}
        isListView={false}
        delayIndex={0}
        now={Date.now()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('.lucide-paperclip')).not.toBeNull();
  });
});
