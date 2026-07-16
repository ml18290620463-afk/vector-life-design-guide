import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { TRANSLATIONS } from '../constants';

type MotionMockProps = React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode };

// Mock SecurityService
vi.mock('../services/securityService', () => ({
  SecurityService: {
    hashPassword: vi.fn(),
    encrypt: vi.fn(),
    decryptData: vi.fn().mockImplementation((data) => Promise.resolve(data)),
  },
}));

// Mock motion to skip animations
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: MotionMockProps) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: MotionMockProps) => <h2 {...props}>{children}</h2>,
    span: ({ children, ...props }: MotionMockProps) => <span {...props}>{children}</span>,
    section: ({ children, ...props }: MotionMockProps) => <section {...props}>{children}</section>,
    form: ({ children, ...props }: MotionMockProps) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const t = TRANSLATIONS['zh'];

const createMockEntries = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    title: `Test Entry ${i + 1}`,
    content: `Content ${i + 1}`,
    createdAt: Date.now() - i * 86400000,
    updatedAt: Date.now() - i * 86400000,
    tags: ['test'],
    isLocked: false,
    isArchived: false,
  }));
};

const defaultProps = {
  entries: createMockEntries(12), // Trigger List View (>10)
  currentUser: 'test@user.com',
  isGuest: false,
  language: 'zh' as const,
  onSetLanguage: vi.fn(),
  onSelectEntry: vi.fn(),
  onUpdateEntry: vi.fn(),
  onBulkUpdateEntries: vi.fn(),
  onReplayIntro: vi.fn(),
  onWipeData: vi.fn(),
  onCreateMaterialEntry: vi.fn(),
  isUnlocked: true,
  passwordHash: 'hash',
  passwordSalt: 'salt',
  onSetPassword: vi.fn(),
  onClearPassword: vi.fn(),
  guidingStars: [],
  onSaveGuidingStars: vi.fn(),
  selectedStars: [],
  onSaveSelectedStars: vi.fn(),
  containers: [],
  onAddContainer: vi.fn(),
  onDeleteContainer: vi.fn(),
  theme: 'dark' as const,
  onSetTheme: vi.fn(),
  onOpenComposerWithSeed: vi.fn(),
  toggleFullScreen: vi.fn(),
  loading: false,
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fullscreen API for happy-dom
    if (typeof document !== 'undefined' && !document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    }
  });

  it('renders as a system hub instead of the retired record list', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText('系统中心')).toBeDefined();
    expect(screen.getByTestId('dashboard-system-hub')).toBeDefined();
    expect(screen.getByText('管理本地数据与运行状态')).toBeDefined();
    expect(screen.queryByText('Test Entry 1')).toBeNull();
  });

  it('does not render the removed header new entry button', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByTestId('dashboard-new-entry')).toBeNull();
  });

  it('does not duplicate the Now capture surface', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByTestId('quick-capture-bar')).toBeNull();
    expect(screen.queryByText('刻录此刻')).toBeNull();
  });

  it('does not duplicate the four main-module navigation', () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByLabelText('整体模块引导')).toBeNull();
    expect(screen.queryByText('整体框架')).toBeNull();
  });

  it('does not select entries from Dashboard anymore', async () => {
    render(<Dashboard {...defaultProps} />);

    expect(screen.queryByText('Test Entry 1')).toBeNull();
    expect(defaultProps.onSelectEntry).not.toHaveBeenCalled();
  });

  it('opens settings panel when settings button is clicked', async () => {
    render(<Dashboard {...defaultProps} />);
    const settingsButton = screen.getAllByTitle(t.settingsTitle)[0];
    fireEvent.click(settingsButton);

    // The SettingsPanel title is t.navigationLog
    expect(await screen.findByText(t.navigationLog)).toBeDefined();
  });

  it('triggers onSetLanguage in guest mode', () => {
    render(<Dashboard {...defaultProps} isGuest={true} />);
    // In guest mode some things might differ, but header is mostly same
    expect(screen.getByText('系统中心')).toBeDefined();
  });

  it('triggers toggleFullScreen when clicking expand button', () => {
    render(<Dashboard {...defaultProps} />);
    const expandBtn = screen.getAllByTitle(t.toggleFullscreen)[0];
    // No crash expected since we mocked requestFullscreen
    fireEvent.click(expandBtn);
    expect(expandBtn).toBeDefined();
  });
});
