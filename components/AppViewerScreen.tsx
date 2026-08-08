import type { FC } from 'react';
import { Suspense } from 'react';
import type { DiaryEntry, Language, Theme } from '../types';
import { Viewer } from './appLazyComponents';
import { ScreenLoader } from './ScreenLoader';
import type { AvatarLaunchContext } from '../features/avatar/types';

type AppViewerScreenProps = {
  active: boolean;
  currentUser: string | null;
  entry: DiaryEntry | null;
  language: Language;
  masterPassword: string | null;
  onBack: () => void;
  onDeleteEntry: (id: string) => void;
  onGoHome: () => void;
  theme: Theme;
  onOpenAvatar?: (context: AvatarLaunchContext) => void;
};

export const AppViewerScreen: FC<AppViewerScreenProps> = ({
  active,
  currentUser,
  entry,
  language,
  masterPassword,
  onBack,
  onDeleteEntry,
  onGoHome,
  theme,
  onOpenAvatar,
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
        onDelete={(id) => returnAfter(() => onDeleteEntry(id))}
        onOpenAvatar={onOpenAvatar ? () => onOpenAvatar({
          mode: 'distill',
          source: 'past-detail',
          entryId: entry.id,
          prompt: `请帮我整理「${entry.title}」`,
        }) : undefined}
      />
    </Suspense>
  );
};
