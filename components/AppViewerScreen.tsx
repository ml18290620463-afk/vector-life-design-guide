import type { FC } from 'react';
import { Suspense } from 'react';
import type { DiaryEntry, Language, Theme } from '../types';
import { Viewer } from './appLazyComponents';
import { ScreenLoader } from './ScreenLoader';

type AppViewerScreenProps = {
  active: boolean;
  currentUser: string | null;
  entry: DiaryEntry | null;
  language: Language;
  masterPassword: string | null;
  onBack: () => void;
  onDeleteEntry: (id: string, retainDerivedKnowledge?: boolean) => void | Promise<void>;
  onGoHome: () => void;
  theme: Theme;
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
}) => {
  if (!active || !entry) {
    return null;
  }

  const deleteEntryAndReturn = async (id: string) => {
    const retainDerivedKnowledge = window.confirm(
      language === 'zh'
        ? '是否保留这段经历形成的模式和原则？\n\n选择“确定”保留，选择“取消”同步删除。'
        : 'Keep the patterns and principles formed from this experience?\n\nChoose OK to keep them, or Cancel to delete them together.',
    );
    await onDeleteEntry(id, retainDerivedKnowledge);
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
        onDelete={deleteEntryAndReturn}
      />
    </Suspense>
  );
};
