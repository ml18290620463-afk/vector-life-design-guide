import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import { describe, it, expect, vi, afterEach } from 'vitest';

const mockProps = {
  theme: 'dark' as const,
  language: 'zh' as const,
  showFilterHub: false,
  isVaultOpen: true,
  onToggleVault: vi.fn(),
  selectedTag: null,
  setSelectedTag: vi.fn(),
  selectedCategory: 'all',
  setSelectedCategory: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  groupingMode: 'none' as const,
  setGroupingMode: vi.fn(),
  isEditingStars: false,
  entriesCount: 0,
};

describe('FilterBar', () => {
  afterEach(cleanup);

  it('renders correctly', () => {
    render(<FilterBar {...mockProps} />);
    // Check for "归航方式" which is part of grouping label
    expect(screen.getByText(/归航方式/i)).toBeDefined();
  });

  it('calls setGroupingMode when a mode button is clicked', () => {
    render(<FilterBar {...mockProps} />);
    const yearBtn = screen.getAllByText('年')[0];
    fireEvent.click(yearBtn);
    expect(mockProps.setGroupingMode).toHaveBeenCalledWith('year');
  });

  it('shows reset button when filtered', () => {
    render(<FilterBar {...mockProps} selectedTag="test" />);
    expect(screen.getAllByText(/RESET/i)).toBeDefined();
  });

  it('calls reset handlers when reset is clicked', () => {
    render(<FilterBar {...mockProps} selectedTag="test" />);
    fireEvent.click(screen.getAllByText(/RESET/i)[0]);
    expect(mockProps.setSelectedTag).toHaveBeenCalledWith(null);
    expect(mockProps.setSelectedCategory).toHaveBeenCalledWith('all');
    expect(mockProps.setSearchQuery).toHaveBeenCalledWith('');
  });
});
