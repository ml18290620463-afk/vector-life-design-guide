import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import {
  ArrowLeft,
  Archive as ArchiveIcon,
  FilePlus,
  Languages,
  LockKeyhole,
  Moon,
  PlayCircle,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { AppState, type DiaryEntry, type Language, type Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

/**
 * W3.1 — global command palette (⌘K / Ctrl+K).
 *
 * Self-contained: takes a fat callback bag and a snapshot of the
 * current app state (entries, theme, language, etc.). Callers are
 * responsible for opening / closing it via the `open` prop — App.tsx
 * owns the keyboard shortcut so the same shortcut can trigger
 * different things from different surfaces in the future (e.g. a
 * scoped "search this archive" palette).
 *
 * Designed to be the single keyboard-first navigation entry for power
 * users:
 *   - ↑↓ to move between commands
 *   - Enter to run
 *   - ⌘K / Ctrl+K (handled by parent) to toggle visibility
 *   - Esc closes (cmdk built-in)
 *
 * The recent-entries section is capped at 8 to keep the list scroll-
 * free at common viewport heights; users searching for older entries
 * type into the input which fuzzy-matches across the entire entries
 * array.
 */
export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  language: Language;
  appState: AppState;
  t: TranslationDictionary;
  entries: DiaryEntry[];
  onNewEntry: () => void;
  onOpenArchive: () => void;
  onBackToDashboard: () => void;
  onReplayIntro: () => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  onSetTheme: (theme: Theme) => void;
  onSetLanguage: (language: Language) => void;
  onLockVault?: () => void;
  onWipeData?: () => void;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  zh: '简体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
};

const RECENT_ENTRIES_CAP = 8;

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  theme,
  language,
  appState,
  t,
  entries,
  onNewEntry,
  onOpenArchive,
  onBackToDashboard,
  onReplayIntro,
  onSelectEntry,
  onSetTheme,
  onSetLanguage,
  onLockVault,
  onWipeData,
}) => {
  const [page, setPage] = useState<'root' | 'language'>('root');
  const [searchValue, setSearchValue] = useState('');

  // Reset palette state every time it opens so the user always sees
  // a clean root view at the top.
  useEffect(() => {
    if (open) {
      setPage('root');
      setSearchValue('');
    }
  }, [open]);

  const recentEntries = useMemo(() => entries.slice(0, RECENT_ENTRIES_CAP), [entries]);

  if (!open) return null;

  const close = () => onOpenChange(false);

  const run = (action: () => void) => {
    close();
    // Defer to the next frame so any focus-restoration cleanup inside
    // cmdk runs before the parent re-renders into a different surface.
    requestAnimationFrame(action);
  };

  const labels = {
    placeholder: t.commandPaletteSearch || 'Search commands or entries…',
    empty: t.commandPaletteEmpty || 'No results.',
    navigation: t.commandPaletteNavigation || 'Navigation',
    appearance: t.commandPaletteAppearance || 'Appearance',
    danger: t.commandPaletteDanger || 'Danger zone',
    recent: t.commandPaletteRecent || 'Recent entries',
    languagePage: t.commandPaletteLanguage || 'Language',
    back: t.cancel || 'Back',
    newEntry: t.newEntry || 'New entry',
    openArchive: t.archive || 'Open archive',
    backToDashboard: t.dashboard || 'Back to dashboard',
    replayIntro: t.replayIntro || 'Replay intro',
    toggleTheme:
      t.toggleTheme || (theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'),
    switchLanguage: t.switchLanguage || 'Switch language…',
    lockVault: t.lockVault || 'Lock the vault',
    wipeData: t.wipeData || 'Wipe all local data',
  };

  return (
    <div
      data-testid="command-palette"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <Command
        label={t.commandPaletteTitle || 'Command palette'}
        loop
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden ${
          theme === 'light'
            ? 'bg-white border-cyan-100 text-slate-700'
            : 'bg-[#0b0b0b] border-cyan-900/40 text-cyan-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b ${theme === 'light' ? 'border-cyan-100/80' : 'border-cyan-900/30'}`}
        >
          {page === 'language' && (
            <button
              type="button"
              aria-label={labels.back}
              onClick={() => setPage('root')}
              className={`p-1 rounded-md ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-cyan-900/20 text-cyan-300'}`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Command.Input
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder={page === 'language' ? labels.languagePage : labels.placeholder}
            className={`flex-1 bg-transparent outline-none text-sm font-mono placeholder:opacity-50 ${theme === 'light' ? 'text-slate-700 placeholder:text-slate-400' : 'text-cyan-100 placeholder:text-cyan-700'}`}
            data-testid="command-palette-input"
          />
          <kbd
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${theme === 'light' ? 'border-slate-200 text-slate-400 bg-slate-50' : 'border-cyan-900/40 text-cyan-700 bg-black/30'}`}
          >
            Esc
          </kbd>
        </div>

        <Command.List
          className={`max-h-80 overflow-y-auto py-2 text-sm ${theme === 'light' ? 'text-slate-700' : 'text-cyan-100/90'}`}
        >
          <Command.Empty
            className={`py-8 text-center text-xs font-mono ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
          >
            {labels.empty}
          </Command.Empty>

          {page === 'root' && (
            <>
              <Command.Group heading={labels.navigation}>
                {appState !== AppState.EDITOR && (
                  <PaletteItem
                    theme={theme}
                    icon={<FilePlus className="w-4 h-4" />}
                    label={labels.newEntry}
                    onSelect={() => run(onNewEntry)}
                  />
                )}
                {appState !== AppState.ARCHIVE && (
                  <PaletteItem
                    theme={theme}
                    icon={<ArchiveIcon className="w-4 h-4" />}
                    label={labels.openArchive}
                    onSelect={() => run(onOpenArchive)}
                  />
                )}
                {appState !== AppState.DASHBOARD && (
                  <PaletteItem
                    theme={theme}
                    icon={<ArrowLeft className="w-4 h-4" />}
                    label={labels.backToDashboard}
                    onSelect={() => run(onBackToDashboard)}
                  />
                )}
                <PaletteItem
                  theme={theme}
                  icon={<PlayCircle className="w-4 h-4" />}
                  label={labels.replayIntro}
                  onSelect={() => run(onReplayIntro)}
                />
              </Command.Group>

              <Command.Group heading={labels.appearance}>
                <PaletteItem
                  theme={theme}
                  icon={
                    theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
                  }
                  label={labels.toggleTheme}
                  onSelect={() => run(() => onSetTheme(theme === 'light' ? 'dark' : 'light'))}
                />
                <PaletteItem
                  theme={theme}
                  icon={<Languages className="w-4 h-4" />}
                  label={`${labels.switchLanguage} (${LANGUAGE_LABELS[language]})`}
                  onSelect={() => {
                    setPage('language');
                    setSearchValue('');
                  }}
                />
              </Command.Group>

              {recentEntries.length > 0 && (
                <Command.Group heading={labels.recent}>
                  {recentEntries.map((entry) => (
                    <PaletteItem
                      key={entry.id}
                      theme={theme}
                      icon={<Zap className="w-4 h-4 opacity-60" />}
                      label={entry.title || `Entry ${entry.id}`}
                      onSelect={() => run(() => onSelectEntry(entry))}
                    />
                  ))}
                </Command.Group>
              )}

              {(onLockVault || onWipeData) && (
                <Command.Group heading={labels.danger}>
                  {onLockVault && (
                    <PaletteItem
                      theme={theme}
                      icon={<LockKeyhole className="w-4 h-4 text-amber-500" />}
                      label={labels.lockVault}
                      onSelect={() => run(onLockVault)}
                    />
                  )}
                  {onWipeData && (
                    <PaletteItem
                      theme={theme}
                      icon={<Trash2 className="w-4 h-4 text-rose-500" />}
                      label={labels.wipeData}
                      onSelect={() => run(onWipeData)}
                      danger
                    />
                  )}
                </Command.Group>
              )}
            </>
          )}

          {page === 'language' && (
            <Command.Group heading={labels.languagePage}>
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                <PaletteItem
                  key={lang}
                  theme={theme}
                  icon={
                    <span
                      className={`text-[11px] font-mono uppercase w-4 ${lang === language ? 'text-cyan-500' : 'opacity-50'}`}
                    >
                      {lang}
                    </span>
                  }
                  label={`${LANGUAGE_LABELS[lang]}${lang === language ? ' ✓' : ''}`}
                  onSelect={() => run(() => onSetLanguage(lang))}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
};

interface PaletteItemProps {
  theme: Theme;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ theme, icon, label, danger, onSelect }) => (
  <Command.Item
    onSelect={onSelect}
    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm rounded-md mx-2 transition-colors data-[selected=true]:${
      theme === 'light' ? 'bg-cyan-50' : 'bg-cyan-900/20'
    } ${danger ? 'text-rose-600' : ''}`}
  >
    {icon}
    <span className="flex-1 truncate">{label}</span>
  </Command.Item>
);
