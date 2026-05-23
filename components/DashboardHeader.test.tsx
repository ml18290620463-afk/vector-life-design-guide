import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRANSLATIONS } from '../constants';

const mockProps = {
  language: 'zh' as const,
  theme: 'dark' as const,
  dynamicVersion: 'v1.0.0',
  isFullscreen: false,
  onOpenArchive: vi.fn(),
  toggleFullScreen: vi.fn(),
};

const t = TRANSLATIONS['zh'];

describe('DashboardHeader', () => {
  afterEach(cleanup);

  it('renders title correctly', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.getByText(t.appTitle)).toBeDefined();
  });

  it('does not render the header new entry button', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.queryByTestId('dashboard-new-entry')).toBeNull();
  });

  it('triggers onOpenArchive when archive button clicked', () => {
    render(<DashboardHeader {...mockProps} />);
    const btn = screen.getByText(t.archive);
    fireEvent.click(btn);
    expect(mockProps.onOpenArchive).toHaveBeenCalled();
  });

  it('does not render the settings boat in the header', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.queryByTestId('dashboard-settings-boat')).toBeNull();
  });
});
