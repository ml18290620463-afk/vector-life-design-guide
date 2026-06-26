import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
/* eslint-disable max-lines */
import { MotionConfig } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { AppState, DiaryEntry, Language, Theme } from './types';
import { useDiaryData } from './hooks/useDiaryData';
import { useCustomPersonas } from './hooks/useCustomPersonas';
import { useMemoryStore } from './hooks/useMemoryStore';
import { useLetterStore } from './hooks/useLetterStore';
import { generateSecureId } from './services/idGenerator';
import { MigrationImportWizard } from './components/MigrationImportWizard';
import { TrustedDevicesPanel } from './components/TrustedDevicesPanel';
import { useTrustedDevices } from './hooks/useTrustedDevices';
import { AppMemoirPanels } from './components/AppMemoirPanels';
import { PricingPage } from './components/PricingPage';
import { useAppBilling } from './hooks/useAppBilling';
import {
  ensureDeviceKeypair,
  loadPublicIdentity,
  regenerateDeviceKeypair,
  unlockSecretKey,
  type DevicePublicIdentity,
} from './services/deviceKeypair';
import { cascadeDeleteMemoir } from './services/memoirCascade';
import { useMotionPreference } from './hooks/useMotionPreference';
import { TRANSLATIONS } from './constants';
import { SecurityService } from './services/securityService';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { PostEngraveDestination } from './components/Editor';
import { getPreviewMode, isMobileExperience, pushAppPath, replaceAppPath } from './lib/previewMode';
import {
  getMobileMainTab,
  getMobileTabFromPath,
  navigateMobileTab,
} from './features/mobile/mobileRoutes';
import type { MobileMainTab } from './features/mobile/types';

// Phase 4.5 §D — code-split everything that is NOT visible on the
// initial Cover screen. Lazy-loading Dashboard / Onboarding /
// Onboarding / CommandPalette trims the entry chunk by ~120 kB
// gzip and brings mobile FCP from 3.6 s → ~1.5 s on slow 4G.
//
// CoverScreen is also lazy — its imports (lucide icons, motion,
// DecryptionText) are surprisingly heavy for the first surface.
// The Suspense fallback is the same `<ScreenLoader>` that bridges
// every other lazy boundary, so the FCP element is the spinner
// instead of the cover headline. LCP improves because the spinner
// paints without waiting for the heavy bundle.
//
// SpaceTimeBackground is lazy too — purely decorative, not on the
// LCP path. Loading it after the cover renders shaves another
// ~10 kB off the entry chunk and lets the canvas / motion keyframes
// paint on the next idle frame instead of competing with the
// headline text for the LCP slot.
const CoverScreen = lazy(() =>
  import('./components/CoverScreen').then((module) => ({ default: module.CoverScreen })),
);
const SpaceTimeBackground = lazy(() =>
  import('./components/SpaceTimeBackground').then((module) => ({
    default: module.SpaceTimeBackground,
  })),
);
const Dashboard = lazy(() =>
  import('./components/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const Onboarding = lazy(() =>
  import('./components/Onboarding').then((module) => ({ default: module.Onboarding })),
);
const MasterLock = lazy(() =>
  import('./components/MasterLock').then((module) => ({ default: module.MasterLock })),
);
const CommandPalette = lazy(() =>
  import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })),
);
const Viewer = lazy(() =>
  import('./components/Viewer').then((module) => ({ default: module.Viewer })),
);
const Editor = lazy(() =>
  import('./components/Editor').then((module) => ({ default: module.Editor })),
);
const ArchiveVault = lazy(() =>
  import('./components/ArchiveVault').then((module) => ({ default: module.ArchiveVault })),
);
const NowFlow = lazy(() =>
  import('./features/now/NowFlow').then((module) => ({ default: module.NowFlow })),
);
const PastRepository = lazy(() =>
  import('./features/mobile/PastRepository').then((module) => ({ default: module.PastRepository })),
);
const FuturePlaceholder = lazy(() =>
  import('./features/mobile/FuturePlaceholder').then((module) => ({
    default: module.FuturePlaceholder,
  })),
);
const MobileShell = lazy(() =>
  import('./features/mobile/MobileShell').then((module) => ({ default: module.MobileShell })),
);

const ScreenLoader: React.FC<{ language: Language }> = ({ language }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-mono text-cyan-500 text-xs tracking-widest animate-pulse uppercase">
        {TRANSLATIONS[language].restoringLink}
      </div>
    </div>
  </div>
);

const getPreviewScreen = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.get('preview')) return null;
  const screen = params.get('screen');
  return screen === 'dashboard' ||
    screen === 'future' ||
    screen === 'editor' ||
    screen === 'now' ||
    screen === 'onboarding' ||
    screen === 'settings' ||
    screen === 'archive' ||
    screen === 'past'
    ? screen
    : null;
};

const getNowRouteFromPath = (): 'now' | 'tags' | 'avatar-chat' | null => {
  if (typeof window === 'undefined') return null;
  if (window.location.pathname === '/avatar') return 'avatar-chat';
  if (window.location.pathname === '/now/tags') return 'tags';
  if (window.location.pathname === '/now/avatar-chat') return 'avatar-chat';
  if (window.location.pathname === '/now') return 'now';
  return null;
};

const pushNowPath = (route: 'now' | 'tags' | 'avatar-chat') => {
  if (typeof window === 'undefined') return;
  const path =
    route === 'avatar-chat' && isMobileExperience()
      ? '/avatar'
      : route === 'now'
        ? '/now'
        : `/now/${route}`;
  pushAppPath(path, { nowRoute: route });
};

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

  // Update currentUser when language changes
  useEffect(() => {
    setCurrentUser(TRANSLATIONS[language].localUser);
  }, [language, setCurrentUser]);

  useEffect(() => {
    const mode = getPreviewMode();
    document.documentElement.classList.toggle('vector-force-mobile', mode === 'mobile');
    document.documentElement.classList.toggle('vector-force-web', mode === 'web');

    return () => {
      document.documentElement.classList.remove('vector-force-mobile', 'vector-force-web');
    };
  }, []);

  useEffect(() => {
    const screen = getPreviewScreen();
    if (!screen) return;
    if (screen === 'onboarding') {
      setIsUnlocked(false);
      setAppState(AppState.ONBOARDING);
      return;
    }
    setIsUnlocked(true);
    if (screen === 'now') {
      setNowRoute('now');
      replaceAppPath('/now', { nowRoute: 'now' });
      setAppState(AppState.NOW);
      return;
    }
    if (screen === 'editor') {
      setAppState(AppState.DASHBOARD);
      setAppState(AppState.EDITOR);
      return;
    }
    if (screen === 'archive' || screen === 'past') {
      if (isMobileExperience()) {
        replaceAppPath('/past');
        setAppState(AppState.PAST);
      } else {
        setAppState(AppState.DASHBOARD);
        setAppState(AppState.ARCHIVE);
      }
      return;
    }
    if (screen === 'future') {
      if (isMobileExperience()) {
        replaceAppPath('/future');
        setAppState(AppState.FUTURE);
      } else {
        setAppState(AppState.DASHBOARD);
      }
      return;
    }
    if (screen === 'settings') {
      setAppState(AppState.DASHBOARD);
      return;
    }
    setAppState(AppState.DASHBOARD);
  }, [setAppState, setIsUnlocked]);

  // Phase 4.5 §C — auto-enable Argon2id on first mount post-rollout.
  // Idempotent (one-shot migration marker inside the service); safe
  // to run unconditionally. Logged for ops visibility — flips to a
  // noop on every subsequent boot.
  useEffect(() => {
    const flipped = SecurityService.applyArgon2idDefaults();
    if (flipped) {
      console.info('Argon2id defaults applied (Phase 4.5 §C rollout).');
    }
  }, []);

  // W3.1 — global command palette toggle. Bound to ⌘K / Ctrl+K
  // unconditionally so the shortcut works from every screen (cover,
  // editor, viewer, etc.). The handler stops propagation so it never
  // double-fires when a child surface also wires the same key.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [nowRoute, setNowRoute] = useState<'now' | 'tags' | 'avatar-chat'>(
    () => getNowRouteFromPath() ?? 'now',
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const mobileTab = getMobileTabFromPath();
    if (mobileTab) {
      setIsUnlocked(true);
      if (mobileTab === 'past') {
        setAppState(AppState.PAST);
        return;
      }
      if (mobileTab === 'future') {
        setAppState(AppState.FUTURE);
        return;
      }
      if (mobileTab === 'avatar') {
        setNowRoute('avatar-chat');
        setAppState(AppState.NOW_AVATAR_CHAT);
        return;
      }
    }

    const route = getNowRouteFromPath();
    if (!route) return;
    setIsUnlocked(true);
    setNowRoute(route);
    setAppState(
      route === 'tags'
        ? AppState.NOW_TAGS
        : route === 'avatar-chat'
          ? AppState.NOW_AVATAR_CHAT
          : AppState.NOW,
    );
  }, [setAppState, setIsUnlocked]);

  useEffect(() => {
    const onPopState = () => {
      const mobileTab = getMobileTabFromPath();
      if (mobileTab) {
        setIsUnlocked(true);
        if (mobileTab === 'past') {
          setAppState(AppState.PAST);
          return;
        }
        if (mobileTab === 'future') {
          setAppState(AppState.FUTURE);
          return;
        }
        if (mobileTab === 'avatar') {
          setNowRoute('avatar-chat');
          setAppState(AppState.NOW_AVATAR_CHAT);
          return;
        }
      }

      const route = getNowRouteFromPath();
      if (!route) {
        if (isMobileExperience()) {
          setAppState(AppState.NOW);
          return;
        }
        setAppState(AppState.DASHBOARD);
        return;
      }
      setNowRoute(route);
      setAppState(
        route === 'tags'
          ? AppState.NOW_TAGS
          : route === 'avatar-chat'
            ? AppState.NOW_AVATAR_CHAT
            : AppState.NOW,
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setAppState, setIsUnlocked]);

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

  // Phase 4 §5.1.A — custom guiding stars (Persona Builder).
  // Lives in a separate hook (under the 600-line ceiling rule) so
  // useDiaryData stays focused on its core diary surface.
  const {
    customPersonas,
    addPersona: addCustomPersona,
    deletePersona: deleteCustomPersona,
    replacePersonas: replaceCustomPersonas,
  } = useCustomPersonas();

  // Phase 4 §5.1.B — Memoir long-term memories. Same architectural
  // posture as `useCustomPersonas`. The store is mounted at the App
  // root so:
  //   - the dashboard export pipeline can bundle memories into the
  //     v3 backup payload, and
  //   - the v3 backup importer can restore them via `replaceMemories`.
  // Viewer-side recall is done in `Viewer` itself (which mounts its
  // own copy of the hook — both copies read the same IDB blob).
  const {
    memories,
    replaceMemories,
    clearForMemoir: clearMemoirMemories,
    updateMemory: updateMemoryById,
    deleteMemory: softDeleteMemory,
    hardDeleteMemory: hardDeleteMemoryById,
    restoreMemory: restoreMemoryById,
    listRecycleBin: listMemoryRecycleBin,
  } = useMemoryStore();

  // Phase 4.5 §E — Letter store mounted here so the cross-device
  // migration wizard can call `replaceLetters` (and a future
  // backup-export integration can include the pending letter
  // queue alongside memories). Dashboard mounts its own copy of
  // the hook for the sweep flow; both copies read the same IDB.
  const {
    letters: pendingLetters,
    replaceLetters,
    clearForMemoir: clearMemoirLetters,
    cancel: cancelLetter,
  } = useLetterStore();

  // Phase 5 (5.1 + 5.2) — license + Stripe Checkout composite hook.
  const billing = useAppBilling();

  // Phase 4 §4.b-3 — device public identity (publicKey + fingerprint).
  // Loaded from IDB on mount so the cover screen / Settings can show
  // it even when the vault is locked. Refreshed after every keypair
  // operation (`ensureDeviceKeypair` on unlock, `regenerateDeviceKeypair`
  // from Settings).
  const [deviceIdentity, setDeviceIdentity] = useState<DevicePublicIdentity | null>(null);
  // prettier-ignore
  useEffect(() => { void loadPublicIdentity().then(setDeviceIdentity).catch(() => undefined); }, []);

  // Derived Principles for Cover Screen
  const homePrinciples = [
    ...principles.filter((p) => p.showOnHome).map((p) => ({ ...p, sortDate: p.createdAt })),
  ].sort((a, b) => b.sortDate - a.sortDate); // Smart Sorting: Most recent first

  // --- Handlers ---

  const handleStartFromCover = () => {
    setAppState(passwordHash ? AppState.LOGIN : AppState.ONBOARDING);
  };

  const handleOnboardingComplete = async (
    password: string,
    directory: string[],
    selection: string[],
  ) => {
    const saltArray = window.crypto.getRandomValues(new Uint8Array(32));
    const salt = btoa(String.fromCharCode(...saltArray));
    SecurityService.wipeSensitive(saltArray);

    const hash = await SecurityService.hashPassword(password, salt);

    await savePasswordSalt(salt);
    await savePasswordHash(hash);
    await saveGuidingStars(directory);
    await saveSelectedStars(selection);

    setMasterPassword(password);
    setIsUnlocked(true);

    if (isMobileExperience()) {
      setNowRoute('now');
      replaceAppPath('/now', { nowRoute: 'now' });
      setAppState(AppState.NOW);
    } else {
      setAppState(AppState.ARCHIVE);
    }

    // prettier-ignore
    void ensureDeviceKeypair(password).then(setDeviceIdentity).catch((err) => console.warn('App: ensureDeviceKeypair failed', err));
  };

  const handleReturningUserUnlock = (password: string) => {
    setMasterPassword(password);
    setIsUnlocked(true);
    if (isMobileExperience()) {
      setNowRoute('now');
      replaceAppPath('/now', { nowRoute: 'now' });
      setAppState(AppState.NOW);
    } else {
      setAppState(AppState.DASHBOARD);
      setAppState(AppState.ARCHIVE);
    }
    // prettier-ignore
    void ensureDeviceKeypair(password).then(setDeviceIdentity).catch((err) => console.warn('App: ensureDeviceKeypair failed', err));
  };

  const handleRecoveryPasswordReset = async (password: string) => {
    await handleSetPassword(password);
    if (isMobileExperience()) {
      setNowRoute('now');
      replaceAppPath('/now', { nowRoute: 'now' });
      setAppState(AppState.NOW);
    } else {
      setAppState(AppState.DASHBOARD);
      setAppState(AppState.ARCHIVE);
    }
    // prettier-ignore
    void ensureDeviceKeypair(password).then(setDeviceIdentity).catch((err) => console.warn('App: ensureDeviceKeypair failed after recovery reset', err));
  };

  const handleSetPassword = async (password: string) => {
    const saltArray = window.crypto.getRandomValues(new Uint8Array(32));
    const salt = btoa(String.fromCharCode(...saltArray));
    SecurityService.wipeSensitive(saltArray);
    const hash = await SecurityService.hashPassword(password, salt);
    await savePasswordSalt(salt);
    await savePasswordHash(hash);
    setMasterPassword(password);
    setIsUnlocked(true);
  };

  const handleClearPassword = async () => {
    await clearPasswordHash();
    setMasterPassword(null);
    setIsUnlocked(false);
  };

  const handleWipeData = () => {
    setMasterPassword(null);
    setIsUnlocked(false);
    setAppState(AppState.COVER);
    wipeData().catch(console.error);
  };

  // Phase 4.5 §E — cross-device migration wizard state. The wizard
  // is opened from EITHER:
  //   - CoverScreen "Migrate from another device" CTA (vault still
  //     locked / no master password yet — first-run on a new
  //     device).
  //   - Settings on an unlocked vault (re-import after deleting
  //     something accidentally).
  // The handlers below close over the App-level data layer hooks
  // so the same wizard instance can serve both entry points.
  const [showMigrationImport, setShowMigrationImport] = useState(false);
  // Phase 4 §4.b-3 follow-up (K1) — Trusted devices audit panel.
  // Mounted at App level so the panel is reachable from Settings
  // (the only entry point for v1) and so its `useTrustedDevices`
  // hook stays singleton-ish (the migration wizard mutates the
  // same store via `trustPublicKey`; both readers see the same
  // IDB blob).
  const [showTrustedDevices, setShowTrustedDevices] = useState(false);
  const trustedDevices = useTrustedDevices();
  // Refresh the list when the panel opens so new entries added by
  // the migration wizard since the last open are visible.
  useEffect(() => {
    if (showTrustedDevices) void trustedDevices.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrustedDevices]);

  // L1 — Memoirs picker → panels.
  const [memoirIdForMemories, setMemoirIdForMemories] = useState<string | null>(null);
  const [memoirIdForLetters, setMemoirIdForLetters] = useState<string | null>(null);
  const findMemoir = (id: string | null) =>
    id ? (customPersonas.find((p) => p.id === id && p.kind === 'memoir') ?? null) : null;
  const memoirForMemories = findMemoir(memoirIdForMemories);
  const memoirForLetters = findMemoir(memoirIdForLetters);

  // F4 — pre-seed for the next Editor mount; cleared on save/back.
  const [editorSeed, setEditorSeed] = useState<{
    title?: string;
    content?: string;
    tags?: string;
    reflectionDepth?: 'release' | 'sort' | 'clarity';
  } | null>(null);
  const [postEngraveDestination, setPostEngraveDestination] =
    useState<PostEngraveDestination | null>(null);

  const handleMigrationApplyCredentialSnapshot = useCallback(
    async (hash: string, salt: string) => {
      // Persist credentials from the migration package, then force the
      // user back through MasterLock so they re-type the password (we
      // intentionally don't auto-unlock — typing it on the new device
      // cements muscle memory).
      await savePasswordSalt(salt);
      await savePasswordHash(hash);
      setMasterPassword(null);
      setIsUnlocked(false);
    },
    // setMasterPassword / setIsUnlocked are stable React setters — no
    // need to list them; lint disable is local to keep noise contained.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savePasswordHash, savePasswordSalt],
  );

  const handleMigrationComplete = useCallback(() => {
    // After import, route to cover. If the package carried credentials,
    // tapping "Start" next will route through MasterLock to unlock.
    // setAppState is a stable React setter; lint disable kept local.
    setAppState(AppState.COVER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 4 §4.b-3 — Settings → "Regenerate device keys". Only callable
  // when masterPassword is in memory (vault unlocked); the Settings
  // CTA is gated behind the unlock state.
  const handleRegenerateDeviceKeys = useCallback(async () => {
    if (!masterPassword) return;
    try {
      const next = await regenerateDeviceKeypair(masterPassword);
      setDeviceIdentity(next);
    } catch (err) {
      console.warn('App: regenerateDeviceKeypair failed', err);
    }
  }, [masterPassword]);

  // Phase 4 §4.b-3 — on-demand signing material fetcher passed to the
  // migration export modal. Returns null when there's no
  // master-password-in-memory or no keypair, both of which fall back
  // to "unsigned" packages.
  const handleUnlockSigningKey = useCallback(async () => {
    if (!masterPassword || !deviceIdentity) return null;
    const secret = await unlockSecretKey(masterPassword);
    if (!secret) return null;
    return { secretKey: secret, publicKey: deviceIdentity.publicKey };
  }, [masterPassword, deviceIdentity]);

  // Phase 4.5 follow-ups (F4) — open the entry composer pre-seeded
  // from a Proactive Recall card. The seed is written to App state
  // and consumed once when the Editor mounts; both `handleSaveEntry`
  // and `handleBackToDashboard` clear it so it doesn't leak into a
  // future "+ New entry" flow.
  const handleOpenComposerWithSeed = useCallback(
    (seed: {
      title?: string;
      content?: string;
      tags?: string;
      reflectionDepth?: 'release' | 'sort' | 'clarity';
    }) => {
      setEditorSeed(seed);
      setAppState(AppState.EDITOR);
    },
    // setEditorSeed / setAppState are stable React setters; lint
    // disable kept local to mirror the other useCallback handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleMobileTabChange = useCallback(
    (tab: MobileMainTab) => {
      navigateMobileTab(tab, { replace: true });
      if (tab === 'past') {
        setAppState(AppState.PAST);
        return;
      }
      if (tab === 'future') {
        setAppState(AppState.FUTURE);
        return;
      }
      if (tab === 'avatar') {
        setNowRoute('avatar-chat');
        setAppState(AppState.NOW_AVATAR_CHAT);
        return;
      }
      setNowRoute('now');
      setAppState(AppState.NOW);
    },
    [setAppState],
  );

  const handleOpenNow = useCallback(
    (route: 'now' | 'tags' | 'avatar-chat' = 'now') => {
      if (isMobileExperience() && route === 'avatar-chat') {
        handleMobileTabChange('avatar');
        return;
      }
      setNowRoute(route);
      pushNowPath(route);
      setAppState(
        route === 'tags'
          ? AppState.NOW_TAGS
          : route === 'avatar-chat'
            ? AppState.NOW_AVATAR_CHAT
            : AppState.NOW,
      );
    },
    [handleMobileTabChange, setAppState],
  );

  const handleExitNow = useCallback(() => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/now')) {
      replaceAppPath('/', {});
    }
    setNowRoute('now');
    setAppState(AppState.DASHBOARD);
  }, [handleMobileTabChange, setAppState]);

  // Phase 4.5 follow-ups (F2) — cascade-delete a Memoir, its memories,
  // and its pending letters in one shot. Wraps `cascadeDeleteMemoir`
  // (the pure orchestrator) with the three live store callbacks so
  // `MemoryManagementPanel` only needs to know which memoir id to
  // nuke. Errors are swallowed locally — the orchestrator surfaces
  // them on the returned outcome; future sprints can route them into
  // a toast.
  const handleCascadeDeleteMemoir = useCallback(
    async (memoirId: string) => {
      const outcome = await cascadeDeleteMemoir({
        memoirId,
        clearMemories: clearMemoirMemories,
        clearLetters: clearMemoirLetters,
        deletePersona: deleteCustomPersona,
      });
      if (outcome.errors.length > 0) {
        console.warn('App: cascadeDeleteMemoir partial failures', outcome.errors);
      }
    },
    [clearMemoirMemories, clearMemoirLetters, deleteCustomPersona],
  );

  const handleSelectEntry = (entry: DiaryEntry) => {
    if (entry.unlockAt && entry.unlockAt > Date.now()) return;
    setPostEngraveDestination(null);
    setSelectedEntry(entry);
    setAppState(AppState.VIEWER);
  };

  const handleSaveEntry = async (
    data: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>,
    destination: PostEngraveDestination = 'release',
  ) => {
    const newEntry = await addEntry(data);
    if (destination === 'release') {
      setPostEngraveDestination(null);
      setAppState(AppState.DASHBOARD);
    } else {
      setPostEngraveDestination(destination);
      setSelectedEntry(newEntry);
      setAppState(AppState.VIEWER);
    }
    // Phase 4.5 follow-ups (F4) — drop the seed once consumed so a
    // future + New Entry click starts blank.
    setEditorSeed(null);
  };

  const handleBackToDashboard = () => {
    if (isMobileExperience()) {
      handleMobileTabChange('past');
    } else {
      setAppState(AppState.DASHBOARD);
    }
    setSelectedEntry(null);
    setPostEngraveDestination(null);
    setEditorSeed(null);
  };

  const mobileMainTab = getMobileMainTab(appState);
  const useMobileShell = isMobileExperience() && mobileMainTab !== null;

  const showGlobalBackground = [
    AppState.DASHBOARD,
    AppState.VIEWER,
    AppState.EDITOR,
    AppState.ARCHIVE,
  ].includes(appState);

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

          {/* CommandPalette is lazy-loaded since it only renders on
              ⌘K. Suspense fallback is null because the palette is
              hidden by default — the user wouldn't see a loader. */}
          {paletteOpen && (
            <Suspense fallback={null}>
              <CommandPalette
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                theme={theme}
                language={language}
                appState={appState}
                t={TRANSLATIONS[language]}
                entries={entries}
                onNewEntry={() => handleOpenNow()}
                onOpenArchive={() =>
                  isMobileExperience()
                    ? handleMobileTabChange('past')
                    : setAppState(AppState.ARCHIVE)
                }
                onBackToDashboard={handleBackToDashboard}
                onReplayIntro={() => setAppState(AppState.COVER)}
                onSelectEntry={handleSelectEntry}
                onSetTheme={(t: Theme) => setTheme(t)}
                onSetLanguage={(lang: Language) => setLanguage(lang)}
                onLockVault={passwordHash ? () => setIsUnlocked(false) : undefined}
                onWipeData={passwordHash ? handleWipeData : undefined}
              />
            </Suspense>
          )}

          {loading &&
            appState !== AppState.COVER &&
            appState !== AppState.ONBOARDING &&
            appState !== AppState.LOGIN && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="font-mono text-cyan-500 text-xs tracking-widest animate-pulse uppercase">
                    {TRANSLATIONS[language].restoringLink}
                  </div>
                </div>
              </div>
            )}

          {appState === AppState.COVER && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <CoverScreen
                onStart={handleStartFromCover}
                language={language}
                principles={homePrinciples}
                theme={theme}
                onMigrate={() => setShowMigrationImport(true)}
              />
            </Suspense>
          )}

          {appState === AppState.ONBOARDING && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <Onboarding
                language={language}
                onSetLanguage={(lang: Language) => setLanguage(lang)}
                theme={theme}
                onComplete={handleOnboardingComplete}
                onCancel={() => setAppState(AppState.COVER)}
              />
            </Suspense>
          )}

          {appState === AppState.LOGIN && passwordHash && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <MasterLock
                language={language}
                onSetLanguage={(lang: Language) => setLanguage(lang)}
                theme={theme}
                passwordHash={passwordHash}
                passwordSalt={passwordSalt}
                onUnlock={handleReturningUserUnlock}
                onResetPassword={handleRecoveryPasswordReset}
                onCancel={() => setAppState(AppState.COVER)}
              />
            </Suspense>
          )}

          {appState === AppState.DASHBOARD && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <Dashboard
                entries={entries}
                currentUser={currentUser}
                isGuest={userId === 'guest'}
                language={language}
                onSetLanguage={(lang: Language) => setLanguage(lang)}
                theme={theme}
                onSetTheme={(t: Theme) => setTheme(t)}
                onSelectEntry={handleSelectEntry}
                onUpdateEntry={updateEntry}
                onBulkUpdateEntries={bulkUpdateEntries}
                onNewEntry={() => handleOpenNow()}
                onOpenArchive={() =>
                  isMobileExperience()
                    ? handleMobileTabChange('past')
                    : setAppState(AppState.ARCHIVE)
                }
                onReplayIntro={() => setAppState(AppState.COVER)}
                onWipeData={handleWipeData}
                onCreateMaterialEntry={(material, isArchived) => {
                  addEntry({
                    title: material.name,
                    content: `[Attachment: ${material.name}]`,
                    tags: ['upload', 'material', material.type],
                    attachment: material,
                    isArchived,
                  });
                }}
                isUnlocked={isUnlocked}
                passwordHash={passwordHash}
                passwordSalt={passwordSalt}
                onSetPassword={handleSetPassword}
                onClearPassword={handleClearPassword}
                onImportBackup={importBackup}
                guidingStars={guidingStars}
                onSaveGuidingStars={saveGuidingStars}
                selectedStars={selectedStars}
                onSaveSelectedStars={saveSelectedStars}
                customPersonas={customPersonas}
                onAddCustomPersona={addCustomPersona}
                onReplaceCustomPersonas={replaceCustomPersonas}
                memories={memories}
                onReplaceMemories={replaceMemories}
                pendingLetters={pendingLetters}
                onReplaceLetters={replaceLetters}
                onOpenMigrationImport={() => setShowMigrationImport(true)}
                deviceFingerprint={deviceIdentity?.fingerprint ?? null}
                onRegenerateDeviceKeys={handleRegenerateDeviceKeys}
                onUnlockSigningKey={handleUnlockSigningKey}
                onOpenTrustedDevices={() => setShowTrustedDevices(true)}
                onOpenMemoirMemories={(id) => setMemoirIdForMemories(id)}
                onOpenMemoirLetters={(id) => setMemoirIdForLetters(id)}
                onOpenComposerWithSeed={handleOpenComposerWithSeed}
                {...billing.licensePropsForDashboard}
                onMintEntry={async (payload) => {
                  // Phase 4.5 §A — pre-mint the id outside the
                  // useDiaryData reducer so the letter-delivery
                  // sweep can record `PendingLetter.replyEntryId`
                  // atomically. `addEntry` honours `data.id` when
                  // present (W4.5 widening) and falls back to a
                  // mint when not.
                  const id = generateSecureId();
                  await addEntry({ ...payload, id });
                  return id;
                }}
                containers={containers}
                onAddContainer={addContainer}
                onDeleteContainer={deleteContainer}
                isScanning={isScanning}
                scanProgress={scanProgress}
                onTriggerScan={triggerScan}
                lastScanSummary={lastScanSummary}
                syncStatus={syncStatus}
                loading={loading}
                startInSettings={getPreviewScreen() === 'settings'}
              />
            </Suspense>
          )}

          {appState === AppState.VIEWER && selectedEntry && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <Viewer
                language={language}
                theme={theme}
                entry={selectedEntry}
                currentUser={currentUser}
                masterPassword={masterPassword}
                guidingStars={selectedStars}
                customPersonas={customPersonas}
                postEngraveDestination={postEngraveDestination}
                onBack={handleBackToDashboard}
                onGoHome={() => setAppState(AppState.COVER)}
                onUpdateEntry={(entry) => {
                  updateEntry(entry);
                  setSelectedEntry(entry);
                }}
                onDelete={(id) => {
                  deleteEntry(id);
                  handleBackToDashboard();
                }}
                onArchive={(id) => {
                  archiveEntry(id);
                  handleBackToDashboard();
                }}
                onRestore={(id) => {
                  unarchiveEntry(id);
                  handleBackToDashboard();
                }}
                containers={containers}
              />
            </Suspense>
          )}

          {useMobileShell && mobileMainTab && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <MobileShell activeTab={mobileMainTab} onTabChange={handleMobileTabChange}>
                {appState === AppState.PAST && (
                  <PastRepository
                    language={language}
                    theme={theme}
                    entries={entries}
                    principles={principles}
                    onAddPrinciple={addPrinciple}
                    onDeletePrinciple={deletePrinciple}
                    onUpdatePrinciple={updatePrinciple}
                    onSelectEntry={handleSelectEntry}
                    containers={containers}
                  />
                )}
                {appState === AppState.FUTURE && <FuturePlaceholder language={language} />}
                {[AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT].includes(appState) && (
                  <NowFlow
                    route={nowRoute}
                    theme={theme}
                    language={language}
                    mobileShell
                    onRouteChange={(route) => {
                      setNowRoute(route);
                      if (route === 'avatar-chat') {
                        navigateMobileTab('avatar', { replace: true });
                        setAppState(AppState.NOW_AVATAR_CHAT);
                        return;
                      }
                      pushNowPath(route);
                      setAppState(route === 'tags' ? AppState.NOW_TAGS : AppState.NOW);
                    }}
                    onExit={handleExitNow}
                    onPersistRecord={async (payload) => {
                      const id = generateSecureId();
                      await addEntry({ ...payload, id });
                      return id;
                    }}
                  />
                )}
              </MobileShell>
            </Suspense>
          )}

          {!useMobileShell &&
            [AppState.NOW, AppState.NOW_TAGS, AppState.NOW_AVATAR_CHAT].includes(appState) && (
              <Suspense fallback={<ScreenLoader language={language} />}>
                <NowFlow
                  route={nowRoute}
                  theme={theme}
                  language={language}
                  onRouteChange={(route) => {
                    setNowRoute(route);
                    pushNowPath(route);
                    setAppState(
                      route === 'tags'
                        ? AppState.NOW_TAGS
                        : route === 'avatar-chat'
                          ? AppState.NOW_AVATAR_CHAT
                          : AppState.NOW,
                    );
                  }}
                  onExit={handleExitNow}
                  onPersistRecord={async (payload) => {
                    const id = generateSecureId();
                    await addEntry({ ...payload, id });
                    return id;
                  }}
                />
              </Suspense>
            )}

          {appState === AppState.EDITOR && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <Editor
                language={language}
                theme={theme}
                masterPassword={masterPassword}
                onSave={handleSaveEntry}
                onCancel={handleBackToDashboard}
                onGoHome={() => setAppState(AppState.COVER)}
                existingTitles={entries.map((e) => e.title)}
                seed={
                  editorSeed ??
                  (getPreviewScreen() === 'editor' ? { reflectionDepth: 'sort' } : null)
                }
              />
            </Suspense>
          )}

          {!useMobileShell && appState === AppState.ARCHIVE && (
            <Suspense fallback={<ScreenLoader language={language} />}>
              <ArchiveVault
                language={language}
                theme={theme}
                entries={entries}
                principles={principles}
                onAddPrinciple={addPrinciple}
                onDeletePrinciple={deletePrinciple}
                onUpdatePrinciple={updatePrinciple}
                onBack={handleBackToDashboard}
                onGoHome={() => setAppState(AppState.COVER)}
                onRecordMoment={() => {
                  setEditorSeed(null);
                  handleOpenNow();
                }}
                onSelectEntry={handleSelectEntry}
                containers={containers}
                onAddContainer={addContainer}
                onDeleteContainer={deleteContainer}
              />
            </Suspense>
          )}

          {/* Phase 4.5 §E — cross-device migration wizard.
              Mounted at App level so it's reachable from BOTH the
              cover screen (vault still locked, first-run on new
              device) AND from Settings (already-unlocked re-import).
              The wizard hook owns its phase state — closing the
              modal resets it. */}
          <MigrationImportWizard
            open={showMigrationImport}
            onClose={() => setShowMigrationImport(false)}
            theme={theme}
            t={TRANSLATIONS[language]}
            onReplaceEntries={async (importedEntries, mode) => {
              await importBackup(importedEntries, mode === 'replace' ? 'replace' : 'merge');
            }}
            onReplaceCustomPersonas={replaceCustomPersonas}
            onReplaceMemories={replaceMemories}
            onReplaceLetters={replaceLetters}
            onApplyCredentialSnapshot={handleMigrationApplyCredentialSnapshot}
            onComplete={handleMigrationComplete}
          />

          {/* Phase 4 §4.b-3 follow-up (K1) — Trusted devices audit. */}
          <TrustedDevicesPanel
            open={showTrustedDevices}
            onClose={() => setShowTrustedDevices(false)}
            theme={theme}
            t={TRANSLATIONS[language]}
            trusted={trustedDevices.trusted}
            loading={trustedDevices.loading}
            onRevoke={trustedDevices.revoke}
            onRelabel={trustedDevices.relabel}
          />

          {/* prettier-ignore */}
          <AppMemoirPanels theme={theme} t={TRANSLATIONS[language]} memoirForMemories={memoirForMemories} memoirForLetters={memoirForLetters} memories={memories} recycleBinFor={listMemoryRecycleBin} pendingLetters={pendingLetters} entries={entries} onClearMemoryFor={clearMemoirMemories} onCascadeDeleteMemoir={async (id) => { await handleCascadeDeleteMemoir(id); setMemoirIdForMemories(null); }} onCloseMemories={() => setMemoirIdForMemories(null)} onCloseLetters={() => setMemoirIdForLetters(null)} onUpdateMemory={updateMemoryById} onSoftDeleteMemory={softDeleteMemory} onHardDeleteMemory={hardDeleteMemoryById} onRestoreMemory={restoreMemoryById} onCancelLetter={cancelLetter} onOpenLetterReply={(target) => { setMemoirIdForLetters(null); setSelectedEntry(target); setAppState(AppState.VIEWER); }} />

          {/* Phase 5.2 — pricing page (USD) + checkout-return URL handler. */}
          {/* prettier-ignore */}
          {billing.showPricing && (
            <PricingPage
              theme={theme}
              t={TRANSLATIONS[language]}
              installId={billing.license.installId}
              onClose={() => billing.setShowPricing(false)}
            />
          )}
          {void billing.checkoutReturn}
        </div>
      </AppMotionConfig>
    </ErrorBoundary>
  );
};

/**
 * Bridges the OS-level `prefers-reduced-motion` setting into every
 * `motion/react` consumer. Setting `transition={{ duration: 0 }}` collapses
 * spring/ease transitions to instant; `reducedMotion="user"` also short-
 * circuits the variants pipeline.
 */
const AppMotionConfig: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reduce = useMotionPreference();
  return (
    <MotionConfig
      reducedMotion={reduce ? 'always' : 'user'}
      transition={reduce ? { duration: 0 } : undefined}
    >
      {children}
    </MotionConfig>
  );
};

export default App;
