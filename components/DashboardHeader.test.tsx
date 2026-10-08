import { render, screen, cleanup } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRANSLATIONS } from '../constants';

const mockProps = {
  language: 'zh' as const,
  theme: 'dark' as const,
  isFullscreen: false,
  toggleFullScreen: vi.fn(),
};

const t = TRANSLATIONS['zh'];

describe('DashboardHeader', () => {
  afterEach(cleanup);

  it('renders title correctly', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.getByText('系统中心')).toBeDefined();
    expect(screen.getByText('v1.1.0')).toBeDefined();
  });

  it('does not render the header new entry button', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.queryByTestId('dashboard-new-entry')).toBeNull();
  });

  it('does not duplicate the Past archive entry in the header', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.queryByTestId('dashboard-open-archive')).toBeNull();
    expect(screen.queryByText(t.archive)).toBeNull();
  });

  it('does not render the settings boat in the header', () => {
    render(<DashboardHeader {...mockProps} />);
    expect(screen.queryByTestId('dashboard-settings-boat')).toBeNull();
  });
});
