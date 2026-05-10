import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FilterHub } from './FilterHub';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DiaryEntry } from '../types';

const mockEntries: DiaryEntry[] = [
  {
    id: '1',
    title: 'T1',
    content: 'C1',
    tags: ['work'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isLocked: false,
    containerId: 'work',
  },
];

const mockProps = {
  language: 'zh' as const,
  theme: 'dark' as const,
  entries: mockEntries,
  searchQuery: '',
  onSearchChange: vi.fn(),
  selectedTag: null,
  onSelectTag: vi.fn(),
  selectedCategory: 'all',
  onSelectCategory: vi.fn(),
  containers: [{ id: 'work', name: 'Work', createdAt: Date.now() }],
  onAddContainer: vi.fn(),
  onDeleteContainer: vi.fn(),
  onClose: vi.fn(),
  groupingMode: 'none' as const,
  onGroupingModeChange: vi.fn(),
};

describe('FilterHub', () => {
  afterEach(cleanup);

  it('renders correctly', () => {
    render(<FilterHub {...mockProps} />);
    expect(screen.getByPlaceholderText(/搜索/i)).toBeDefined();
  });

  it('calls onSearchChange on input change', () => {
    render(<FilterHub {...mockProps} />);
    const input = screen.getByPlaceholderText(/搜索/i);
    fireEvent.change(input, { target: { value: 'test' } });
    expect(mockProps.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('calls onSelectCategory when category clicked', () => {
    render(<FilterHub {...mockProps} />);
    // Category buttons are in the categories list.
    // They are rendered as 'WORK' due to uppercase styling in some views but literally 'WORK' in others.
    const workBtns = screen.getAllByText(/Work/i);
    fireEvent.click(workBtns[0]);
    expect(mockProps.onSelectCategory).toHaveBeenCalledWith('work');
  });
});
