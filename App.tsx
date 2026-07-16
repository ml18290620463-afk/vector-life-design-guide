import React, { Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppState } from './types';
import { useDiaryData } from './hooks/useDiaryData';
import { useAppBilling } from './hooks/useAppBilling';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppMotionConfig } from './components/AppMotionConfig';
import { ScreenLoader } from './components/ScreenLoader';
import { AppOverlayLayer } from './components/AppOverlayLayer';
import { AppCommandPaletteLayer } from './components/AppCommandPaletteLayer';
import { AppEntryGateScreens } from './components/AppEntryGateScreens';
import { AppDashboardScreen } from './components/AppDashboardScreen';
import { AppViewerScreen } from './components/AppViewerScreen';
import { AppMainModuleScreens } from './components/AppMainModuleScreens';
import type { DashboardProps } from './components/dashboardProps';
import { SpaceTimeBackground } from './components/appLazyComponents';
import { isMobileExperience } from './lib/previewMode';
import { getPreviewScreen } from './lib/appEntryRoutes';
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

const App: React.FC = () => {
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
    })),
  );

  useAppBootEffects({ language, setCurrentUser });

  const { paletteOpen, setPaletteOpen } = useCommandPaletteToggle();

  // Data Layer Hook
  const {
    entries,
    principles,
    addEntry,
    updateEntry,
    bulkUpdateEntries,
    deleteEntry,
    archiveEntry,
    unarchiveEntry,
    addPrinciple,
    deletePrinciple,
    updatePrinciple,
    importBackup,
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
    containers,
    addContainer,
    deleteContainer,
    loading,
    isScanning,
    scanProgress,
    triggerScan,
    lastScanSummary,
    syncStatus,
  } = useDiaryData(userId, language);

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
    handleBackToDashboard,
    handleCreateMaterialEntry,
    handlePersistNowRecord,
    handleSelectEntry,
  } = useEntrySurfaceActions({
    addEntry,
    handleMobileTabChange,
    setAppState,
    setSelectedEntry,
  });

  const mobileMainTab = getMobileMainTab(appState);
  const useMobileShell = shouldUseMobileShell(isMobileExperience(), mobileMainTab);
  const showGlobalBackground = shouldShowGlobalBackground(appState);
  const showLoadingOverlay = shouldShowLoadingOverlay(loading, appState);
  const dashboardProps = {
    entries,
    currentUser,
    isGuest: userId === 'guest',
    language,
    onSetLanguage: setLanguage,
    theme,
    onSetTheme: setTheme,
    onSelectEntry: handleSelectEntry,
    onUpdateEntry: updateEntry,
    onBulkUpdateEntries: bulkUpdateEntries,
    onReplayIntro: () => setAppState(AppState.COVER),
    onWipeData: handleWipeData,
    onCreateMaterialEntry: handleCreateMaterialEntry,
    isUnlocked,
    passwordHash,
    passwordSalt,
    onSetPassword: handleSetPassword,
    onClearPassword: handleClearPassword,
    onImportBackup: importBackup,
    guidingStars,
    onSaveGuidingStars: saveGuidingStars,
    selectedStars,
    onSaveSelectedStars: saveSelectedStars,
    ...billing.licensePropsForDashboard,
    containers,
    onAddContainer: addContainer,
    onDeleteContainer: deleteContainer,
    isScanning,
    scanProgress,
    onTriggerScan: triggerScan,
    lastScanSummary,
    syncStatus,
    loading,
    startInSettings: getPreviewScreen() === 'settings',
  } satisfies DashboardProps;

  return (
    <ErrorBoundary>
      <AppMotionConfig>
        <div
          className={`vector-app-shell min-h-screen font-sans relative transition-colors duration-1000 ${theme === 'light' ? 'bg-[#f6f8fb] text-[#1a202c] selection:bg-cyan-600/20 selection:text-cyan-900' : 'bg-[var(--background)] text-[color:var(--foreground)] selection:bg-[color-mix(in_srgb,var(--color-tech-cyan-energy)_38%,transparent)] selection:text-[var(--foreground)]'}`}
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
            onBackToDashboard={handleBackToDashboard}
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

          <AppDashboardScreen
            active={appState === AppState.DASHBOARD}
            dashboardProps={dashboardProps}
          />

          <AppViewerScreen
            active={appState === AppState.VIEWER}
            containers={containers}
            currentUser={currentUser}
            entry={selectedEntry}
            language={language}
            masterPassword={masterPassword}
            onArchiveEntry={archiveEntry}
            onBack={handleBackToDashboard}
            onDeleteEntry={deleteEntry}
            onGoHome={() => setAppState(AppState.COVER)}
            onRestoreEntry={unarchiveEntry}
            onSelectEntry={setSelectedEntry}
            onUpdateEntry={updateEntry}
            theme={theme}
          />

          <AppMainModuleScreens
            addContainer={addContainer}
            addPrinciple={addPrinciple}
            appState={appState}
            containers={containers}
            deleteContainer={deleteContainer}
            deletePrinciple={deletePrinciple}
            entries={entries}
            language={language}
            mobileMainTab={mobileMainTab}
            nowRoute={nowRoute}
            onExitNow={handleExitNow}
            onMainModuleNavigate={handleMainModuleNavigate}
            onMobileTabChange={handleMobileTabChange}
            onNowRecordComplete={handleNowRecordComplete}
            onNowRouteChange={handleNowRouteChange}
            onPersistNowRecord={handlePersistNowRecord}
            onSelectEntry={handleSelectEntry}
            principles={principles}
            theme={theme}
            updateEntry={updateEntry}
            updatePrinciple={updatePrinciple}
            useMobileShell={useMobileShell}
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
