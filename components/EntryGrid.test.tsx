import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntryGrid } from './EntryGrid';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DiaryEntry } from '../types';

const mockEntries: DiaryEntry[] = [
  {
    id: '1',
    title: 'Test 1',
    content: 'C1',
    tags: ['tag'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLocked: false,
  },
];

const mockProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  searchQuery: '',
  filteredEntries: mockEntries,
  groupingMode: 'none' as const,
  groupedEntries: { ALL: mockEntries },
  groupKeys: ['ALL'],
  isListView: true,
  onSelectEntry: vi.fn(),
  showFilterHub: false,
  setShowFilterHub: vi.fn(),
  disableVirtualization: true,
};

describe('EntryGrid', () => {
  afterEach(cleanup);

  beforeEach(() => {
    // Mock getBoundingClientRect for parentRef in JSDOM
    class MockResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 1024,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1024,
    });
  });

  it('renders entries in list view', () => {
    render(<EntryGrid {...mockProps} />);
    expect(screen.getByText('Test 1')).toBeDefined();
  });

  it('triggers onSelectEntry when clicked', () => {
    render(<EntryGrid {...mockProps} />);
    fireEvent.click(screen.getByText('Test 1'));
    expect(mockProps.onSelectEntry).toHaveBeenCalledWith(mockEntries[0]);
  });

  it('renders card view when isListView is false', () => {
    render(<EntryGrid {...mockProps} isListView={false} />);
    expect(screen.getByText('Test 1')).toBeDefined();
    expect(screen.getByText('#tag')).toBeDefined();
  });

  it('renders empty state when no entries', () => {
    render(<EntryGrid {...mockProps} filteredEntries={[]} />);
    expect(screen.getByText(/过往皆为判断的注脚/i)).toBeDefined();
  });

  // Phase 4 §4.a-1 — sample reflections (first-day activation hook)
  describe('sample reflection badges', () => {
    const sampleEntry: DiaryEntry = {
      id: 'sample-daily-zh',
      title: '示例反思',
      content: 'sample body',
      tags: ['示例'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLocked: false,
      isSample: true,
    };

    it('renders the 示例 badge in list view when entry.isSample is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[sampleEntry]}
          groupedEntries={{ ALL: [sampleEntry] }}
          isListView
        />,
      );
      expect(screen.getByTestId('sample-badge')).toBeDefined();
      expect(screen.getByTestId('sample-badge').textContent).toBe('示例');
    });

    it('renders the 示例 badge in grid view when entry.isSample is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[sampleEntry]}
          groupedEntries={{ ALL: [sampleEntry] }}
          isListView={false}
        />,
      );
      expect(screen.getByTestId('sample-badge-grid')).toBeDefined();
    });

    it('does NOT render the badge for entries without isSample flag', () => {
      render(<EntryGrid {...mockProps} />);
      expect(screen.queryByTestId('sample-badge')).toBeNull();
      expect(screen.queryByTestId('sample-badge-grid')).toBeNull();
    });

    it('badge carries an aria-label for assistive tech', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[sampleEntry]}
          groupedEntries={{ ALL: [sampleEntry] }}
        />,
      );
      const badge = screen.getByTestId('sample-badge');
      expect(badge.getAttribute('aria-label')).toContain('示例');
    });
  });

  /* ---------------------------------------------------------- */
  /*  Phase 4.5 §A — letter-reply envelope badge                */
  /* ---------------------------------------------------------- */
  describe('letter-reply badge (Phase 4.5)', () => {
    const letterEntry = {
      id: 'entry-letter-1',
      title: '来自「奶奶」的回信',
      content: 'memoir reply body',
      tags: ['letter-reply'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLocked: false,
      isLetterReply: true,
      letterId: 'letter-1',
    };

    it('renders the envelope badge in list view when entry.isLetterReply is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[letterEntry]}
          groupedEntries={{ ALL: [letterEntry] }}
          isListView
        />,
      );
      expect(screen.getByTestId('letter-reply-badge')).toBeDefined();
    });

    it('renders the envelope badge in grid view when entry.isLetterReply is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[letterEntry]}
          groupedEntries={{ ALL: [letterEntry] }}
          isListView={false}
        />,
      );
      expect(screen.getByTestId('letter-reply-badge-grid')).toBeDefined();
    });

    it('does NOT render the badge for ordinary entries', () => {
      render(<EntryGrid {...mockProps} />);
      expect(screen.queryByTestId('letter-reply-badge')).toBeNull();
      expect(screen.queryByTestId('letter-reply-badge-grid')).toBeNull();
    });
  });

  /* ---------------------------------------------------------- */
  /*  Phase 4.5 §B — round-table badge                          */
  /* ---------------------------------------------------------- */
  describe('echo-chamber badge (Phase 4.5 §B)', () => {
    const echoEntry = {
      id: 'entry-echo-1',
      title: '圆桌 · 我现在该不该辞职',
      content: '我现在该不该辞职?',
      tags: ['echo-chamber'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLocked: false,
      isEchoChamber: true,
      echoChamberQuery: '我现在该不该辞职?',
    };

    it('renders the round badge in list view when entry.isEchoChamber is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[echoEntry]}
          groupedEntries={{ ALL: [echoEntry] }}
          isListView
        />,
      );
      expect(screen.getByTestId('echo-chamber-badge')).toBeDefined();
    });

    it('renders the round badge in grid view when entry.isEchoChamber is true', () => {
      render(
        <EntryGrid
          {...mockProps}
          filteredEntries={[echoEntry]}
          groupedEntries={{ ALL: [echoEntry] }}
          isListView={false}
        />,
      );
      expect(screen.getByTestId('echo-chamber-badge-grid')).toBeDefined();
    });

    it('does NOT render the badge for ordinary entries', () => {
      render(<EntryGrid {...mockProps} />);
      expect(screen.queryByTestId('echo-chamber-badge')).toBeNull();
      expect(screen.queryByTestId('echo-chamber-badge-grid')).toBeNull();
    });
  });
});
