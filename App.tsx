import React, { Suspense, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppState, type DiaryEntry } from './types';
import { useReadableEntries } from './hooks/useReadableEntries';
import { useDiaryData } from './hooks/useDiaryData';
import { useAppBilling } from './hooks/useAppBilling';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppMotionConfig } from './components/AppMotionConfig';
import { ScreenLoader } from './components/ScreenLoader';
import { AppOverlayLayer } from './components/AppOverlayLayer';
import { AppCommandPaletteLayer } from './components/AppCommandPaletteLayer';
import { AppEntryGateScreens } from './components/AppEntryGateScreens';
import { AppViewerScreen } from './components/AppViewerScreen';
import { AppMainModuleScreens } from './components/AppMainModuleScreens';
import { SpaceTimeBackground } from './components/appLazyComponents';
import { isMobileExperience, removeObsoletePreviewQuery } from './lib/previewMode';
import { getMobileMainTab } from './features/mobile/mobileRoutes';
import { useAppEntryRouting } from './hooks/useAppEntryRouting';
import { useAppMainNavigation } from './hooks/useAppMainNavigation';
import { useCommandPaletteToggle } from './hooks/useCommandPaletteToggle';
import { useDeviceIdentity } from './hooks/useDeviceIdentity';
import { useEntrySurfaceActions } from './hooks/useEntrySurfaceActions';
import { useAppBootEffects } from './hooks/useAppBootEffects';
import { useVaultAuthActions } from './hooks/useVaultAuthActions';
import { getHomePrinciples } from './lib/homePrinciples';
import {
  shouldShowGlobalBackground,
  shouldShowLoadingOverlay,
  shouldUseMobileShell,
} from './lib/appShellRules';
import { DEFAULT_AVATAR_CONTEXT } from './features/avatar/types';

const App: React.FC = () => {
  useEffect(removeObsoletePreviewQuery, []);

  // Subscribe via `useShallow` so changes to unrelated store fields (e.g.
  // a child component flipping `selectedEntry`) do not trigger an App
  // re-render. Without this, the Zustand default reference-equality check
  // re-renders the entire tree on every `set()` call.
  const {
    appState,
    setAppState,
    language,
    setLanguage,
    theme,
    setTheme,
    currentUser,
    userId,
    masterPassword,
    isUnlocked,
    selectedEntry,
    setCurrentUser,
    setMasterPassword,
    setIsUnlocked,
    setSelectedEntry,
    avatarLaunchContext,
    setAvatarLaunchContext,
  } = useAppStore(
    useShallow((state) => ({
      appState: state.appState,
      setAppState: state.setAppState,
      language: state.language,
      setLanguage: state.setLanguage,
      theme: state.theme,
      setTheme: state.setTheme,
      currentUser: state.currentUser,
      userId: state.userId,
      masterPassword: state.masterPassword,
      isUnlocked: state.isUnlocked,
      selectedEntry: state.selectedEntry,
      setCurrentUser: state.setCurrentUser,
      setMasterPassword: state.setMasterPassword,
      setIsUnlocked: state.setIsUnlocked,
      setSelectedEntry: state.setSelectedEntry,
      avatarLaunchContext: state.avatarLaunchContext,
      setAvatarLaunchContext: state.setAvatarLaunchContext,
    })),
  );

  useAppBootEffects({ language, setCurrentUser });

  const { paletteOpen, setPaletteOpen } = useCommandPaletteToggle();

  // Data Layer Hook
  const {
    entries: storedEntries,
    principles,
    patternPrincipleLinks,
    addEntry,
    updateEntryRelatedIds,
    deleteEntry,
    deleteEntries,
    addPrinciple,
    deletePrinciple,
    addPatternPrincipleLink,
    updatePatternPrincipleLink,
    removePatternPrincipleLink,
    updatePrinciple,
    revisePrinciple,
    actions,
    addAction,
    updateAction,
    recordActionResult,
    wipeData,
    passwordHash,
    passwordSalt,
    savePasswordHash,
    savePasswordSalt,
    clearPasswordHash,
    guidingStars,
    saveGuidingStars,
    selectedStars,
    saveSelectedStars,
    loading,
    loadError,
  } = useDiaryData(userId, language);

  const { entries, error: entryReadError } = useReadableEntries(
    storedEntries,
    isUnlocked,
    masterPassword,
  );

  const { enterPendingOrPastMain, nowRoute, setNowRoute } = useAppEntryRouting({
    isUnlocked,
    loading,
    passwordHash,
    setAppState,
    setIsUnlocked,
  });
  const {
    handleExitNow,
    handleMainModuleNavigate,
    handleMobileTabChange,
    handleNowRecordComplete,
    handleNowRouteChange,
    handleOpenArchive,
    handleOpenNow,
  } = useAppMainNavigation({ setAppState, setNowRoute });

  // Phase 5 (5.1 + 5.2) — license + Stripe Checkout composite hook.
  const billing = useAppBilling();

  const { ensureIdentity } = useDeviceIdentity(masterPassword);

  const {
    handleClearPassword,
    handleOnboardingComplete,
    handleRecoveryPasswordReset,
    handleReturningUserUnlock,
    handleSetPassword,
    handleStartFromCover,
    handleWipeData,
  } = useVaultAuthActions({
    clearPasswordHash,
    ensureIdentity,
    enterPendingOrPastMain,
    passwordHash,
    saveGuidingStars,
    savePasswordHash,
    savePasswordSalt,
    saveSelectedStars,
    setAppState,
    setIsUnlocked,
    setMasterPassword,
    wipeData,
  });

  const homePrinciples = getHomePrinciples(principles);

  const {
    handleBackToPast,
    handlePersistNowRecord,
    handleSelectEntry: selectStoredEntry,
  } = useEntrySurfaceActions({
    addEntry,
    handleMobileTabChange,
    setAppState,
    setSelectedEntry,
  });

  const handleSelectEntry = (entry: DiaryEntry) => {
    const stored = storedEntries.find((item) => item.id === entry.id);
    if (stored) selectStoredEntry(stored);
  };

  const mobileMainTab = getMobileMainTab(appState);
  const navigateMainModule = (tab: Parameters<typeof handleMainModuleNavigate>[0]) => {
    if (tab === 'avatar') setAvatarLaunchContext(DEFAULT_AVATAR_CONTEXT);
    handleMainModuleNavigate(tab);
  };
  const navigateMobileTabWithAvatarContext = (tab: Parameters<typeof handleMobileTabChange>[0]) => {
    if (tab === 'avatar') setAvatarLaunchContext(DEFAULT_AVATAR_CONTEXT);
    handleMobileTabChange(tab);
  };
  const changeNowRoute = (route: Parameters<typeof handleNowRouteChange>[0]) => {
    if (route === 'avatar-chat') setAvatarLaunchContext({ mode: 'capture', source: 'now' });
    handleNowRouteChange(route);
  };
  const useMobileShell = shouldUseMobileShell(isMobileExperience(), mobileMainTab);
  const showGlobalBackground = shouldShowGlobalBackground(appState);
  const showLoadingOverlay = shouldShowLoadingOverlay(loading, appState);

  if (loadError || entryReadError)
    return (
      <main className="min-h-screen grid place-content-center gap-4 p-6" role="alert">
        <h1>暂时无法打开资料库</h1>
        <p>{loadError || entryReadError}</p>
        <button type="button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </main>
    );

  return (
    <ErrorBoundary>
      <AppMotionConfig>
        <div
          className={`vector-app-shell min-h-screen font-sans relative ${
            theme === 'light' ? 'vector-app-shell--light' : ''
          }`}
        >
          {showGlobalBackground && (
            <Suspense fallback={null}>
              <SpaceTimeBackground theme={theme} />
            </Suspense>
          )}

          <AppCommandPaletteLayer
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            theme={theme}
            language={language}
            appState={appState}
            entries={entries}
            onNavigateMainModule={handleMainModuleNavigate}
            onReplayIntro={() => setAppState(AppState.COVER)}
            onSelectEntry={handleSelectEntry}
            onSetTheme={setTheme}
            onSetLanguage={setLanguage}
            onLockVault={passwordHash ? () => setIsUnlocked(false) : undefined}
            onWipeData={passwordHash ? handleWipeData : undefined}
          />

          {showLoadingOverlay && <ScreenLoader language={language} />}

          <AppEntryGateScreens
            appState={appState}
            homePrinciples={homePrinciples}
            language={language}
            loading={loading}
            onCancelToCover={() => setAppState(AppState.COVER)}
            onMigrate={undefined}
            onOnboardingComplete={handleOnboardingComplete}
            onRecoveryPasswordReset={handleRecoveryPasswordReset}
            onReturningUserUnlock={handleReturningUserUnlock}
            onSetLanguage={setLanguage}
            onStartFromCover={handleStartFromCover}
            passwordHash={passwordHash}
            passwordSalt={passwordSalt}
            theme={theme}
          />

          <AppViewerScreen
            active={appState === AppState.VIEWER}
            currentUser={currentUser}
            entry={selectedEntry}
            language={language}
            masterPassword={masterPassword}
            onBack={handleBackToPast}
            onDeleteEntry={deleteEntry}
            onGoHome={() => setAppState(AppState.COVER)}
            theme={theme}
          />

          <AppMainModuleScreens
            addPrinciple={addPrinciple}
            appState={appState}
            deletePrinciple={deletePrinciple}
            deleteEntries={deleteEntries}
            entries={entries}
            language={language}
            mobileMainTab={mobileMainTab}
            nowRoute={nowRoute}
            onExitNow={handleExitNow}
            onMainModuleNavigate={navigateMainModule}
            onMobileTabChange={navigateMobileTabWithAvatarContext}
            onNowRecordComplete={handleNowRecordComplete}
            onNowRouteChange={changeNowRoute}
            onPersistNowRecord={handlePersistNowRecord}
            onRelatedEntriesResolved={updateEntryRelatedIds}
            actions={actions}
            onAddAction={addAction}
            onUpdateAction={updateAction}
            onActionResultRecorded={recordActionResult}
            patternPrincipleLinks={patternPrincipleLinks}
            onAddPatternPrincipleLink={addPatternPrincipleLink}
            onUpdatePatternPrincipleLink={updatePatternPrincipleLink}
            onRemovePatternPrincipleLink={removePatternPrincipleLink}
            onSelectEntry={handleSelectEntry}
            principles={principles}
            guidingStars={selectedStars}
            theme={theme}
            updatePrinciple={updatePrinciple}
            revisePrinciple={revisePrinciple}
            useMobileShell={useMobileShell}
            avatarLaunchContext={avatarLaunchContext ?? DEFAULT_AVATAR_CONTEXT}
          />

          <AppOverlayLayer
            billingCheckoutReturn={billing.checkoutReturn}
            language={language}
            onClosePricing={() => billing.setShowPricing(false)}
            pricingInstallId={billing.license.installId}
            pricingOpen={billing.showPricing}
            theme={theme}
          />
        </div>
      </AppMotionConfig>
    </ErrorBoundary>
  );
};

export default App;
