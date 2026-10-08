import type { FC } from 'react';
import { Suspense } from 'react';
import type { AppState, DiaryEntry, Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { CommandPalette } from './appLazyComponents';
import type { MobileMainTab } from '../features/mobile/types';

type AppCommandPaletteLayerProps = {
  appState: AppState;
  entries: DiaryEntry[];
  language: Language;
  onBackToDashboard: () => void;
  onLockVault?: () => void;
  onNavigateMainModule: (tab: MobileMainTab) => void;
  onOpenChange: (open: boolean) => void;
  onReplayIntro: () => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  onSetLanguage: (language: Language) => void;
  onSetTheme: (theme: Theme) => void;
  onWipeData?: () => void;
  open: boolean;
  theme: Theme;
};

export const AppCommandPaletteLayer: FC<AppCommandPaletteLayerProps> = ({
  appState,
  entries,
  language,
  onBackToDashboard,
  onLockVault,
  onNavigateMainModule,
  onOpenChange,
  onReplayIntro,
  onSelectEntry,
  onSetLanguage,
  onSetTheme,
  onWipeData,
  open,
  theme,
}) =>
  open ? (
    <Suspense fallback={null}>
      <CommandPalette
        open={open}
        onOpenChange={onOpenChange}
        theme={theme}
        language={language}
        appState={appState}
        t={TRANSLATIONS[language]}
        entries={entries}
        onNavigateMainModule={onNavigateMainModule}
        onBackToDashboard={onBackToDashboard}
        onReplayIntro={onReplayIntro}
        onSelectEntry={onSelectEntry}
        onSetTheme={onSetTheme}
        onSetLanguage={onSetLanguage}
        onLockVault={onLockVault}
        onWipeData={onWipeData}
      />
    </Suspense>
  ) : null;
