import type { FC } from 'react';
import { Suspense } from 'react';
import type { Container, DiaryEntry, Language, Theme } from '../types';
import { Viewer } from './appLazyComponents';
import { ScreenLoader } from './ScreenLoader';

type AppViewerScreenProps = {
  active: boolean;
  containers: Container[];
  currentUser: string | null;
  entry: DiaryEntry | null;
  language: Language;
  masterPassword: string | null;
  onArchiveEntry: (id: string) => void;
  onBack: () => void;
  onDeleteEntry: (id: string) => void;
  onGoHome: () => void;
  onRestoreEntry: (id: string) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  onUpdateEntry: (entry: DiaryEntry) => void;
  theme: Theme;
};

export const AppViewerScreen: FC<AppViewerScreenProps> = ({
  active,
  containers,
  currentUser,
  entry,
  language,
  masterPassword,
  onArchiveEntry,
  onBack,
  onDeleteEntry,
  onGoHome,
  onRestoreEntry,
  onSelectEntry,
  onUpdateEntry,
  theme,
}) => {
  if (!active || !entry) {
    return null;
  }

  const returnAfter = (action: () => void) => {
    action();
    onBack();
  };

  return (
    <Suspense fallback={<ScreenLoader language={language} />}>
      <Viewer
        language={language}
        theme={theme}
        entry={entry}
        currentUser={currentUser}
        masterPassword={masterPassword}
        onBack={onBack}
        onGoHome={onGoHome}
        onUpdateEntry={(updatedEntry) => {
          onUpdateEntry(updatedEntry);
          onSelectEntry(updatedEntry);
        }}
        onDelete={(id) => returnAfter(() => onDeleteEntry(id))}
        onArchive={(id) => returnAfter(() => onArchiveEntry(id))}
        onRestore={(id) => returnAfter(() => onRestoreEntry(id))}
        containers={containers}
      />
    </Suspense>
  );
};
