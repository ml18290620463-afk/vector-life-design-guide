import type { FC } from 'react';
import { Suspense, useCallback, useState } from 'react';
import type {
  ActionItem,
  DiaryEntry,
  Language,
  PatternPrincipleLink,
  PatternPrincipleLinkStatus,
  PatternPrincipleRelation,
  Principle,
  PrincipleApplication,
  Theme,
} from '../types';
import { AppState } from '../types';
import type { MobileMainTab } from '../features/mobile/types';
import type { NowRoute } from '../features/now/types/now';
import { isNowSurfaceState, isPastSurfaceState } from '../lib/appShellRules';
import { FuturePage, MobileShell, PastRepository } from '../features/mobile/mobileLazyComponents';
import { NowFlow } from '../features/now/nowLazyComponents';
import { DesktopNowFrame } from '../features/now/components/DesktopNowFrame';
import { ScreenLoader } from './ScreenLoader';
import { AppPageFrame } from './AppPageFrame';
import type { AvatarLaunchContext } from '../features/avatar/types';
import type { PracticeReflectionContext } from '../types/future';
import type { PrincipleRevisionKind } from '../services/principleRevision';

type AppMainModuleScreensProps = {
  actions: ActionItem[];
  onAddAction: (action: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ActionItem>;
  onUpdateAction: (action: ActionItem) => Promise<void> | void;
  onActionResultRecorded: (actionId: string, resultEntryId: string) => Promise<void> | void;
  patternPrincipleLinks: PatternPrincipleLink[];
  onAddPatternPrincipleLink: (
    patternId: string,
    principleId: string,
    relation?: PatternPrincipleRelation,
    status?: PatternPrincipleLinkStatus,
  ) => void;
  onUpdatePatternPrincipleLink: (link: PatternPrincipleLink) => void;
  onRemovePatternPrincipleLink: (id: string) => void;
  addPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
    application?: PrincipleApplication,
    sourcePatternIds?: string[],
    tags?: string[],
    derivedFromPracticeIds?: string[],
  ) => void;
  appState: AppState;
  deletePrinciple: (id: string) => void;
  deleteEntries: (ids: string[], retainDerivedKnowledge?: boolean) => Promise<void> | void;
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
  guidingStars: string[];
  theme: Theme;
  updatePrinciple: (principle: Principle) => void;
  revisePrinciple: (
    original: Principle,
    text: string,
    revisionKind: PrincipleRevisionKind,
  ) => void | Promise<void>;
  useMobileShell: boolean;
  avatarLaunchContext: AvatarLaunchContext;
};

export const AppMainModuleScreens: FC<AppMainModuleScreensProps> = ({
  actions,
  addPrinciple,
  appState,
  deletePrinciple,
  deleteEntries,
  entries,
  language,
  mobileMainTab,
  nowRoute,
  onExitNow,
  onMainModuleNavigate,
  onMobileTabChange,
  onNowRecordComplete,
  onNowRouteChange,
  onActionResultRecorded,
  patternPrincipleLinks,
  onAddPatternPrincipleLink,
  onUpdatePatternPrincipleLink,
  onRemovePatternPrincipleLink,
  onPersistNowRecord,
  onRelatedEntriesResolved,
  onSelectEntry,
  principles,
  theme,
  updatePrinciple,
  revisePrinciple,
  useMobileShell,
  avatarLaunchContext,
}) => {
  const [futureGoalId, setFutureGoalId] = useState<string>();
  const [pastSection, setPastSection] = useState<'timeline' | 'principle'>('timeline');
  const [pastQuery, setPastQuery] = useState('');
  const rememberPastView = useCallback(
    (view: { section: 'timeline' | 'principle'; query: string }) => {
      setPastSection(view.section);
      setPastQuery(view.query);
    },
    [],
  );
  const [practiceReflectionContext, setPracticeReflectionContext] =
    useState<PracticeReflectionContext | null>(null);
  const openFutureGoal = (goalId: string) => {
    setFutureGoalId(goalId);
    (useMobileShell ? onMobileTabChange : onMainModuleNavigate)('future');
  };
  const openPastReflection = useCallback(
    (context: PracticeReflectionContext) => {
      setPracticeReflectionContext(context);
      setPastSection('principle');
      (useMobileShell ? onMobileTabChange : onMainModuleNavigate)('past');
    },
    [onMainModuleNavigate, onMobileTabChange, useMobileShell],
  );
  const openAvatar = () => {
    (useMobileShell ? onMobileTabChange : onMainModuleNavigate)('avatar');
  };
  return (
    <>
      {useMobileShell && mobileMainTab && (
        <Suspense fallback={<ScreenLoader language={language} />}>
          <MobileShell
            activeTab={mobileMainTab}
            language={language}
            onTabChange={onMobileTabChange}
          >
            {isPastSurfaceState(appState) && (
              <PastRepository
                initialSection={pastSection}
                initialQuery={pastQuery}
                onViewChange={rememberPastView}
                practiceReflectionContext={practiceReflectionContext}
                onPracticeReflectionContextDismiss={() => setPracticeReflectionContext(null)}
                onOpenNow={() => (useMobileShell ? onMobileTabChange : onMainModuleNavigate)('now')}
                onOpenFutureGoal={openFutureGoal}
                language={language}
                theme={theme}
                entries={entries}
                principles={principles}
                actions={actions}
                onAddPrinciple={addPrinciple}
                onDeletePrinciple={deletePrinciple}
                onUpdatePrinciple={updatePrinciple}
                onRevisePrinciple={revisePrinciple}
                onSelectEntry={onSelectEntry}
                onDeleteEntries={deleteEntries}
              />
            )}
            {appState === AppState.FUTURE && (
              <FuturePage
                initialGoalId={futureGoalId}
                entries={entries}
                onSelectEntry={onSelectEntry}
                onNavigateModule={onMobileTabChange}
                onReflectInPast={openPastReflection}
              />
            )}
            {isNowSurfaceState(appState) && (
              <NowFlow
                onNavigateModule={onMobileTabChange}
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
                onUpdatePrinciple={updatePrinciple}
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
          <AppPageFrame activeTab="past" language={language} onNavigate={onMainModuleNavigate}>
            <PastRepository
              initialSection={pastSection}
              initialQuery={pastQuery}
              onViewChange={rememberPastView}
              practiceReflectionContext={practiceReflectionContext}
              onPracticeReflectionContextDismiss={() => setPracticeReflectionContext(null)}
              onOpenNow={() => (useMobileShell ? onMobileTabChange : onMainModuleNavigate)('now')}
              onOpenFutureGoal={openFutureGoal}
              language={language}
              theme={theme}
              entries={entries}
              principles={principles}
              actions={actions}
              onAddPrinciple={addPrinciple}
              onDeletePrinciple={deletePrinciple}
              onUpdatePrinciple={updatePrinciple}
              onRevisePrinciple={revisePrinciple}
              onSelectEntry={onSelectEntry}
              onDeleteEntries={deleteEntries}
            />
          </AppPageFrame>
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
            onUpdatePrinciple={updatePrinciple}
            avatarLaunchContext={avatarLaunchContext}
            onSelectEntry={(entryId) => {
              const entry = entries.find((item) => item.id === entryId);
              if (entry) onSelectEntry(entry);
            }}
            onNavigate={onMainModuleNavigate}
          />
        </Suspense>
      )}

      {!useMobileShell && appState === AppState.FUTURE && (
        <Suspense fallback={<ScreenLoader language={language} />}>
          <AppPageFrame activeTab="future" language={language} onNavigate={onMainModuleNavigate}>
            <FuturePage
              initialGoalId={futureGoalId}
              entries={entries}
              onSelectEntry={onSelectEntry}
              onNavigateModule={onMainModuleNavigate}
              onReflectInPast={openPastReflection}
            />
          </AppPageFrame>
        </Suspense>
      )}
    </>
  );
};
