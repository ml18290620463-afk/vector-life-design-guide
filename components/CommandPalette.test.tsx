import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { AppState } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

const baseT: TranslationDictionary = {
  commandPaletteTitle: 'Palette',
  commandPaletteSearch: 'Search',
  commandPaletteEmpty: 'No matches.',
  commandPaletteNavigation: 'Nav',
  commandPaletteAppearance: 'Look',
  commandPaletteRecent: 'Recent',
  commandPaletteLanguage: 'Lang',
  commandPaletteDanger: 'Danger',
  toggleTheme: 'Toggle theme',
  switchLanguage: 'Switch language',
  lockVault: 'Lock vault',
  replayIntro: 'Replay intro',
  dashboard: 'Back to dashboard',
  wipeData: 'Wipe data',
  cancel: 'Back',
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  theme: 'dark' as const,
  language: 'en' as const,
  appState: AppState.DASHBOARD,
  t: baseT,
  entries: [],
  onNavigateMainModule: vi.fn(),
  onBackToDashboard: vi.fn(),
  onReplayIntro: vi.fn(),
  onSelectEntry: vi.fn(),
  onSetTheme: vi.fn(),
  onSetLanguage: vi.fn(),
};

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(<CommandPalette {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the palette when open is true with the provided placeholder', () => {
    render(<CommandPalette {...baseProps} />);
    expect(screen.getByTestId('command-palette')).not.toBeNull();
    expect(screen.getByPlaceholderText('Search')).not.toBeNull();
  });

  it('hides the "back to dashboard" command when already on dashboard', () => {
    render(<CommandPalette {...baseProps} appState={AppState.DASHBOARD} />);
    expect(screen.queryByText('Back to dashboard')).toBeNull();
    expect(screen.queryByText('Open Now')).not.toBeNull();
  });

  it('triggers main-module navigation and closes the palette when the command is selected', () => {
    vi.useFakeTimers();
    const onNavigateMainModule = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        {...baseProps}
        onNavigateMainModule={onNavigateMainModule}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText('Open Now'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // requestAnimationFrame defers the action; flush it.
    vi.runAllTimers();
    vi.useRealTimers();
    expect(onNavigateMainModule).toHaveBeenCalledWith('now');
  });

  it('renders recent entries (capped at 8)', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      title: `Entry ${i}`,
      content: '',
      createdAt: i,
      tags: [],
      isLocked: false,
    }));
    render(<CommandPalette {...baseProps} entries={entries} />);
    // 8 visible + the rest filtered out by the cap.
    expect(screen.queryByText('Entry 0')).not.toBeNull();
    expect(screen.queryByText('Entry 7')).not.toBeNull();
    expect(screen.queryByText('Entry 8')).toBeNull();
  });

  it('shows the lock vault + wipe data commands only when the optional handlers are present', () => {
    const { rerender } = render(<CommandPalette {...baseProps} />);
    expect(screen.queryByText('Lock vault')).toBeNull();
    expect(screen.queryByText('Wipe data')).toBeNull();
    rerender(<CommandPalette {...baseProps} onLockVault={vi.fn()} onWipeData={vi.fn()} />);
    expect(screen.queryByText('Lock vault')).not.toBeNull();
    expect(screen.queryByText('Wipe data')).not.toBeNull();
  });

  it('navigates into the language sub-page when "switch language" is selected', () => {
    render(<CommandPalette {...baseProps} />);
    fireEvent.click(screen.getByText(/switch language/i));
    // Now we're on the language page — see at least 2 of the 7 language labels.
    expect(screen.queryByText(/简体中文/)).not.toBeNull();
    expect(screen.queryByText(/English ✓/)).not.toBeNull();
  });

  it('falls back to English defaults when translation keys are missing', () => {
    render(<CommandPalette {...baseProps} t={{} as TranslationDictionary} />);
    expect(screen.getByPlaceholderText(/Search commands or entries/i)).not.toBeNull();
  });
});
