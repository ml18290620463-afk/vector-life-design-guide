import type { FC } from 'react';
import { Suspense } from 'react';
import type { ActionItem, Container, DiaryEntry, Language, Principle, Theme } from '../types';
import { AppState } from '../types';
import type { MobileMainTab } from '../features/mobile/types';
import type { NowRoute } from '../features/now/types/now';
import { isNowSurfaceState, isPastSurfaceState } from '../lib/appShellRules';
import {
  FuturePlaceholder,
  MobileShell,
  PastRepository,
} from '../features/mobile/mobileLazyComponents';
import { NowFlow } from '../features/now/nowLazyComponents';
import { DesktopNowFrame } from '../features/now/components/DesktopNowFrame';
import { ScreenLoader } from './ScreenLoader';
import type { AvatarLaunchContext } from '../features/avatar/types';

type AppMainModuleScreensProps = {
  addContainer: (name: string) => void;
  actions: ActionItem[];
  onAddAction: (action: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ActionItem>;
  onUpdateAction: (action: ActionItem) => Promise<void> | void;
  onActionResultRecorded: (actionId: string, resultEntryId: string) => Promise<void> | void;
  addPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
  ) => void;
  appState: AppState;
  containers: Container[];
  deleteContainer: (id: string) => void;
  deletePrinciple: (id: string) => void;
  entries: DiaryEntry[];
  language: Language;
  mobileMainTab: MobileMainTab | null;
  nowRoute: NowRoute;
  onExitNow: () => void;
  onMainModuleNavigate: (tab: MobileMainTab) => void;
  onMobileTabChange: (tab: MobileMainTab) => void;
  onNowRecordComplete: () => void;
  onNowRouteChange: (route: NowRoute) => void;
  onPersistNowRecord: (
    payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>,
  ) => Promise<DiaryEntry>;
  onRelatedEntriesResolved: (entryId: string, relatedEntryIds: string[]) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  principles: Principle[];
  theme: Theme;
  updateEntry: (entry: DiaryEntry) => void;
  updatePrinciple: (principle: Principle) => void;
  useMobileShell: boolean;
  avatarLaunchContext: AvatarLaunchContext;
  onOpenAvatar: (context: AvatarLaunchContext) => void;
};

export const AppMainModuleScreens: FC<AppMainModuleScreensProps> = ({
  addContainer,
  actions,
  addPrinciple,
  appState,
  containers,
  deleteContainer,
  deletePrinciple,
  entries,
  language,
  mobileMainTab,
  nowRoute,
  onExitNow,
  onMainModuleNavigate,
  onMobileTabChange,
  onNowRecordComplete,
  onNowRouteChange,
  onAddAction,
  onUpdateAction,
  onActionResultRecorded,
  onPersistNowRecord,
  onRelatedEntriesResolved,
  onSelectEntry,
  principles,
  theme,
  updateEntry,
  updatePrinciple,
  useMobileShell,
  avatarLaunchContext,
  onOpenAvatar,
}) => (
  <>
    {useMobileShell && mobileMainTab && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <MobileShell activeTab={mobileMainTab} language={language} onTabChange={onMobileTabChange}>
          {isPastSurfaceState(appState) && (
            <PastRepository
              language={language}
              theme={theme}
              entries={entries}
              principles={principles}
              onAddPrinciple={addPrinciple}
              onDeletePrinciple={deletePrinciple}
              onUpdateEntry={updateEntry}
              onUpdatePrinciple={updatePrinciple}
              onSelectEntry={onSelectEntry}
              containers={containers}
              onAddContainer={addContainer}
              onDeleteContainer={deleteContainer}
              onOpenAvatar={onOpenAvatar}
            />
          )}
          {appState === AppState.FUTURE && (
            <FuturePlaceholder
              language={language}
              entries={entries}
              principles={principles}
              actions={actions}
              onAddAction={onAddAction}
              onUpdateAction={onUpdateAction}
              onOpenPast={() => onMobileTabChange('past')}
              onOpenNow={() => onMobileTabChange('now')}
              onOpenAvatar={onOpenAvatar}
              onSelectEntry={onSelectEntry}
            />
          )}
          {isNowSurfaceState(appState) && (
            <NowFlow
              route={nowRoute}
              theme={theme}
              language={language}
              mobileShell
              pastEntries={entries}
              principles={principles}
              actions={actions}
              onRouteChange={onNowRouteChange}
              onExit={onExitNow}
              onPersistRecord={onPersistNowRecord}
              onRelatedEntriesResolved={onRelatedEntriesResolved}
              onRecordComplete={onNowRecordComplete}
              onActionResultRecorded={onActionResultRecorded}
              avatarLaunchContext={avatarLaunchContext}
              onSelectEntry={(entryId) => {
                const entry = entries.find((item) => item.id === entryId);
                if (entry) onSelectEntry(entry);
              }}
            />
          )}
        </MobileShell>
      </Suspense>
    )}

    {!useMobileShell && isPastSurfaceState(appState) && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <div className="desktop-main-module-frame">
          <PastRepository
            language={language}
            theme={theme}
            entries={entries}
            principles={principles}
            onAddPrinciple={addPrinciple}
            onDeletePrinciple={deletePrinciple}
            onUpdateEntry={updateEntry}
            onUpdatePrinciple={updatePrinciple}
            onSelectEntry={onSelectEntry}
            containers={containers}
            onAddContainer={addContainer}
            onDeleteContainer={deleteContainer}
            onOpenAvatar={onOpenAvatar}
          />
        </div>
      </Suspense>
    )}

    {!useMobileShell && isNowSurfaceState(appState) && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <DesktopNowFrame
          nowRoute={nowRoute}
          theme={theme}
          language={language}
          pastEntries={entries}
          principles={principles}
          actions={actions}
          onRouteChange={onNowRouteChange}
          onExit={onExitNow}
          onPersistRecord={onPersistNowRecord}
          onRelatedEntriesResolved={onRelatedEntriesResolved}
          onRecordComplete={onNowRecordComplete}
          onActionResultRecorded={onActionResultRecorded}
          avatarLaunchContext={avatarLaunchContext}
          onSelectEntry={(entryId) => {
            const entry = entries.find((item) => item.id === entryId);
            if (entry) onSelectEntry(entry);
          }}
        />
      </Suspense>
    )}

    {!useMobileShell && appState === AppState.FUTURE && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <div className="desktop-main-module-frame">
          <FuturePlaceholder
            language={language}
            entries={entries}
            principles={principles}
            actions={actions}
            onAddAction={onAddAction}
            onUpdateAction={onUpdateAction}
            onBack={() => onMainModuleNavigate('past')}
            onOpenPast={() => onMainModuleNavigate('past')}
            onOpenNow={() => onMainModuleNavigate('now')}
            onOpenAvatar={onOpenAvatar}
            onSelectEntry={onSelectEntry}
          />
        </div>
      </Suspense>
    )}
  </>
);
