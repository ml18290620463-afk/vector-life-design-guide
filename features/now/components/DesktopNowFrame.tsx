import type { FC } from 'react';
import type { ActionItem, DiaryEntry, Language, Principle, Theme } from '../../../types';
import type { NowRoute } from '../types/now';
import { NowFlow } from '../nowLazyComponents';
import type { AvatarLaunchContext } from '../../avatar/types';
import { AppPageFrame } from '../../../components/AppPageFrame';
import type { MobileMainTab } from '../../mobile/types';

type DesktopNowFrameProps = {
  language: Language;
  nowRoute: NowRoute;
  onExit: () => void;
  onPersistRecord: (
    payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>,
  ) => Promise<DiaryEntry>;
  onRelatedEntriesResolved: (entryId: string, relatedEntryIds: string[]) => void;
  onRecordComplete: () => void;
  onRouteChange: (route: NowRoute) => void;
  pastEntries: DiaryEntry[];
  principles: Principle[];
  actions: ActionItem[];
  onActionResultRecorded: (actionId: string, resultEntryId: string) => Promise<void> | void;
  onUpdatePrinciple: (principle: Principle) => Promise<void> | void;
  theme: Theme;
  avatarLaunchContext?: AvatarLaunchContext;
  onSelectEntry?: (entryId: string) => void;
  onNavigate: (tab: MobileMainTab) => void;
};

export const DesktopNowFrame: FC<DesktopNowFrameProps> = ({
  language,
  nowRoute,
  onExit,
  onPersistRecord,
  onRelatedEntriesResolved,
  onRecordComplete,
  onRouteChange,
  pastEntries,
  principles,
  actions,
  onActionResultRecorded,
  onUpdatePrinciple,
  theme,
  avatarLaunchContext,
  onSelectEntry,
  onNavigate,
}) => (
  <AppPageFrame
    variant={nowRoute === 'avatar-chat' ? 'avatar' : 'now'}
    activeTab={nowRoute === 'avatar-chat' ? 'avatar' : 'now'}
    language={language}
    onNavigate={onNavigate}
  >
    <NowFlow
      onNavigateModule={onNavigate}
      route={nowRoute}
      theme={theme}
      language={language}
      pastEntries={pastEntries}
      principles={principles}
      actions={actions}
      onRouteChange={onRouteChange}
      onExit={onExit}
      onPersistRecord={onPersistRecord}
      onRelatedEntriesResolved={onRelatedEntriesResolved}
      onRecordComplete={onRecordComplete}
      onActionResultRecorded={onActionResultRecorded}
      onUpdatePrinciple={onUpdatePrinciple}
      avatarLaunchContext={avatarLaunchContext}
      onSelectEntry={onSelectEntry}
    />
  </AppPageFrame>
);
