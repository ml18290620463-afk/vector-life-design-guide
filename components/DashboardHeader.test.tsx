import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRANSLATIONS } from '../constants';

const mockProps = {
  language: 'zh' as const,
  theme: 'dark' as const,
  dynamicVersion: 'v1.0.0',
  isFullscreen: false,
  onNewEntry: vi.fn(),
  onOpenArchive: vi.fn(),
  toggleFullScreen: vi.fn(),
  setShowSettings: vi.fn(),
  showConfirmHome: false,
  setShowConfirmHome: vi.fn(),
  lastClickTime: Date.now(),
  setLastClickTime: vi.fn(),
  onReplayIntro: vi.fn(),
};

const t = TRANSLATIONS['zh'];

describe('DashboardHeader', () => {
  afterEach(cleanup);

  it('renders title correctly', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.getByText(t.appTitle)).toBeDefined();
  });

  it('triggers onNewEntry when "New" button clicked', () => {
    render(<DashboardHeader {...mockProps} />);
    const btn = screen.getByText(t.newEntry);
    fireEvent.click(btn);
    expect(mockProps.onNewEntry).toHaveBeenCalled();
  });

  it('triggers onOpenArchive when archive button clicked', () => {
    render(<DashboardHeader {...mockProps} />);
    const btn = screen.getByText(t.archive);
    fireEvent.click(btn);
    expect(mockProps.onOpenArchive).toHaveBeenCalled();
  });

  it('triggers setShowSettings when settings button clicked', () => {
    render(<DashboardHeader {...mockProps} />);
    const btn = screen.getByTitle(t.settingsTitle);
    fireEvent.click(btn);
    expect(mockProps.setShowSettings).toHaveBeenCalledWith(true);
  });
});
