import type { FC } from 'react';
import { Suspense } from 'react';
import type { Container, DiaryEntry, Language, Principle, Theme } from '../types';
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

type AppMainModuleScreensProps = {
  addContainer: (name: string) => void;
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
  ) => Promise<string>;
  onSelectEntry: (entry: DiaryEntry) => void;
  principles: Principle[];
  theme: Theme;
  updateEntry: (entry: DiaryEntry) => void;
  updatePrinciple: (principle: Principle) => void;
  useMobileShell: boolean;
};

export const AppMainModuleScreens: FC<AppMainModuleScreensProps> = ({
  addContainer,
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
  onPersistNowRecord,
  onSelectEntry,
  principles,
  theme,
  updateEntry,
  updatePrinciple,
  useMobileShell,
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
            />
          )}
          {appState === AppState.FUTURE && (
            <FuturePlaceholder
              language={language}
              entries={entries}
              principles={principles}
              onOpenPast={() => onMobileTabChange('past')}
              onOpenNow={() => onMobileTabChange('now')}
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
              onRouteChange={onNowRouteChange}
              onExit={onExitNow}
              onPersistRecord={onPersistNowRecord}
              onRecordComplete={onNowRecordComplete}
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
          onRouteChange={onNowRouteChange}
          onExit={onExitNow}
          onPersistRecord={onPersistNowRecord}
          onRecordComplete={onNowRecordComplete}
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
            onBack={() => onMainModuleNavigate('past')}
            onOpenPast={() => onMainModuleNavigate('past')}
            onOpenNow={() => onMainModuleNavigate('now')}
          />
        </div>
      </Suspense>
    )}
  </>
);
