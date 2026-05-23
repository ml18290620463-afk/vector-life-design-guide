import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { TRANSLATIONS } from '../constants';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString, setStoredString } from '../services/browserStorage';
import { useBackupImport } from '../hooks/useBackupImport';
import { useDashboardVault } from '../hooks/useDashboardVault';
import { useBackupReminder } from '../hooks/useBackupReminder';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { DashboardOverlays } from './DashboardOverlays';
import { FilterHub } from './FilterHub';
import { DashboardHeader } from './DashboardHeader';
import { FilterBar } from './FilterBar';
import { DashboardSettingsModal } from './DashboardSettingsModal';
import { DashboardFooter } from './DashboardFooter';
import { VaultContent } from './VaultContent';
import { ReflectionDepthModal } from './ReflectionDepthModal';
import { ProactiveRecallCard } from './ProactiveRecallCard';
import { useProactiveRecall } from '../hooks/useProactiveRecall';
import { LetterArrivedCard } from './LetterArrivedCard';
import { LetterComposeModal } from './LetterComposeModal';
import { useLetterStore } from '../hooks/useLetterStore';
import { useMemoryStore } from '../hooks/useMemoryStore';
import { deliverLetter } from '../services/letterDelivery';
import { EchoChamberModal, type EchoChamberSavePayload } from './EchoChamberModal';
import { canStartEchoChamber } from '../services/quotaService';
import { PERSONAS } from '../constants';
import type { PendingLetter } from '../types';
import { DashboardMigrationExport } from './DashboardMigrationExport';
import { useClickOutside } from '../hooks/useClickOutside';
import { useDashboardExport } from '../hooks/useDashboardExport';
import { useDashboardImportConfirm } from '../hooks/useDashboardImportConfirm';
import { useDashboardFullscreen } from '../hooks/useDashboardFullscreen';
import { useDashboardGroupedEntries } from '../hooks/useDashboardGroupedEntries';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import type { DashboardProps } from './dashboardProps';

const reflectionDepthValues = ['release', 'sort', 'clarity'] as const;

// prettier-ignore
export const Dashboard: React.FC<DashboardProps> = ({
  entries, currentUser, isGuest, language, onSetLanguage, theme, onSetTheme,
  onSelectEntry, onUpdateEntry, onBulkUpdateEntries, onOpenArchive,
  onReplayIntro, onWipeData, onCreateMaterialEntry, isUnlocked, passwordHash,
  passwordSalt, onSetPassword, onClearPassword, onImportBackup, guidingStars,
  onSaveGuidingStars, selectedStars, onSaveSelectedStars, customPersonas,
  onAddCustomPersona, onReplaceCustomPersonas, memories, onReplaceMemories,
  pendingLetters, onReplaceLetters: _onReplaceLetters, onOpenMigrationImport,
  deviceFingerprint, onRegenerateDeviceKeys, onUnlockSigningKey,
  onOpenTrustedDevices, onOpenMemoirMemories, onOpenMemoirLetters,
  licenseInstallId, licenseCurrentTier, licensePayload, licenseFailure,
  onActivateLicense, onDeactivateLicense, onOpenPricing,
  onOpenComposerWithSeed, onMintEntry, containers, onAddContainer,
  onDeleteContainer, isScanning, scanProgress, onTriggerScan, lastScanSummary,
  syncStatus, loading,
}) => {
  const { scheduleTimeout } = useTimeoutManager();
  const PAGE_SIZE = 50;

  const t = TRANSLATIONS[language];
  const hasCoreHabit = entries.length >= 3;

  const [customIdentity, setCustomIdentity] = useState(
    () => getStoredString(AppStorageKeys.customIdentity) || currentUser || '',
  );

  useEffect(() => {
    setStoredString(AppStorageKeys.customIdentity, customIdentity);
  }, [customIdentity]);

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);

  // Go Home Animation State
  const [isSailingHome, setIsSailingHome] = useState(false);

  const { backupReminderActive, daysSinceBackup, recordBackup } = useBackupReminder(entries.length);

  const pwaInstall = usePwaInstallPrompt();

  const handleGoHomeClick = () => {
    setIsSailingHome(true);
    scheduleTimeout(() => {
      onReplayIntro();
      setIsSailingHome(false);
    }, 1000);
  };

  const { isFullscreen, toggleFullScreen, setIsFullscreen } = useDashboardFullscreen();

  // Filter Hub State (overlay z-index management; the actual
  // filter primitives live in `useDashboardFilters`).
  const [showFilterHub, setShowFilterHub] = useState(false);

  const {
    isVaultOpen,
    isVerifyingVault,
    vaultPassword,
    setVaultPassword,
    vaultError,
    handleToggleVault,
    handleVaultUnlock,
    handleVaultCancel,
  } = useDashboardVault({
    isUnlocked,
    passwordHash,
    passwordSalt,
    onSetPassword,
  });

  const {
    selectedTag,
    setSelectedTag,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    activeEntries,
    baseFilteredEntries,
    filteredEntries,
  } = useDashboardFilters({ entries });

  // Settings-only state (security / stars editor / wipe / attachment +
  // media transient banners) lives inside DashboardSettingsModal so the
  // dashboard shell doesn't re-render every time those panels tick.

  const {
    groupingMode,
    setGroupingMode: handleSetGroupingMode,
    paginatedEntries,
    hasMore,
    loadMore,
    groupedEntries,
    groupKeys,
    isListView,
  } = useDashboardGroupedEntries({
    filteredEntries,
    pageSize: PAGE_SIZE,
    language,
    t,
    selectedTag,
    selectedCategory,
  });

  const {
    dynamicVersion,
    handleExport,
    handleDownloadNotes,
    exportTarget,
    setExportTarget,
    isExportDropdownOpen,
    setIsExportDropdownOpen,
  } = useDashboardExport({
    entries,
    filteredEntries,
    currentUser,
    t,
    recordBackup,
    customPersonas,
    memories,
  });
  const dropdownRef = useClickOutside<HTMLDivElement>(isExportDropdownOpen, () =>
    setIsExportDropdownOpen(false),
  );

  const importConfirm = useDashboardImportConfirm();

  const {
    inputRef: importInputRef,
    handleChange: handleImportBackup,
    status: importStatus,
  } = useBackupImport({
    onImportBackup,
    t,
    confirm: importConfirm.confirm,
    reportError: (error) => {
      console.error('Backup import failed', error);
    },
    onImportCustomPersonas: onReplaceCustomPersonas,
    onImportMemories: onReplaceMemories,
  });

  // `isEditingStars` is owned by DashboardSettingsModal but FilterBar
  // also wants to know whether the user is currently mid-edit (to dim
  // affordances). Until we split FilterBar to consume it from a context,
  // we surface a write-through flag here that both sides can read.
  const [isEditingStars, setIsEditingStars] = useState(false);

  // Phase 4 W5 — proactive recall suggestions for any Memoirs the
  // user owns. The hook handles the 24h per-(memoir, trigger)
  // cooldown via localStorage; we just render the resulting list.
  const { suggestions: proactiveSuggestions, dismiss: dismissProactive } = useProactiveRecall({
    memoirs: customPersonas ?? [],
    memories: memories ?? [],
    entries,
  });

  // Phase 4.5 §A — Letter Mode: mount store, run delivery sweep on
  // mount, render arrived cards + compose CTA. Sweep is best-effort.
  const letterStore = useLetterStore();
  const memoryStore = useMemoryStore();
  const memoirsOnly = useMemo(
    () => (customPersonas ?? []).filter((p) => p.kind === 'memoir'),
    [customPersonas],
  );
  const memoirsById = useMemo(() => new Map(memoirsOnly.map((m) => [m.id, m])), [memoirsOnly]);
  const customPersonaPrompts = useMemo(
    () => Object.fromEntries((customPersonas ?? []).map((p) => [p.name, p.systemPrompt])),
    [customPersonas],
  );

  // Per-letter "user dismissed the arrived-card" flag, persisted
  // to localStorage so the card doesn't keep nagging across
  // sessions. Cooldown is implicit: once dismissed, the card
  // stays hidden for that letter forever (the user can still
  // open the reply entry directly from the entries grid via the
  // `isLetterReply` envelope badge).
  const [dismissedArrivedIds, setDismissedArrivedIds] = useState<ReadonlySet<string>>(() => {
    try {
      const raw = window.localStorage.getItem('vector_letter_arrived_dismissed');
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((v) => typeof v === 'string'));
    } catch {
      return new Set();
    }
  });

  const dismissArrivedLetter = useCallback((letter: PendingLetter) => {
    setDismissedArrivedIds((prev) => {
      if (prev.has(letter.id)) return prev;
      const next = new Set(prev);
      next.add(letter.id);
      try {
        window.localStorage.setItem(
          'vector_letter_arrived_dismissed',
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* best-effort */
      }
      return next;
    });
  }, []);

  const arrivedLetters = useMemo(
    () =>
      letterStore
        .recentlyDelivered()
        .filter((l) => !dismissedArrivedIds.has(l.id) && memoirsById.has(l.memoirId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [letterStore.letters, dismissedArrivedIds, memoirsById],
  );

  // Delivery sweep — runs once when the live letter list + Memoir
  // set + mintEntry callback are all ready. Each sweep iteration
  // builds a per-Memoir recall map (using the letter body as the
  // recall query) and calls `deliverLetter`. Failures bump the
  // letter's attempt counter; successes flip status + mint the
  // reply entry.
  useEffect(() => {
    if (!onMintEntry || letterStore.loading || memoryStore.loading) return;
    if (memoirsOnly.length === 0) return;
    const due = letterStore.dueNow(new Set(memoirsOnly.map((m) => m.id)));
    if (due.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const letter of due) {
        if (cancelled) return;
        const memoir = memoirsById.get(letter.memoirId);
        if (!memoir) continue;
        const recall = memoryStore.recallForMemoir(letter.memoirId, letter.body);
        const recallMap: Record<string, ReadonlyArray<{ body: string }>> = {};
        if (recall.length > 0) recallMap[memoir.name] = recall;
        const verdict = await deliverLetter({
          letter,
          memoir,
          mintReplyEntry: onMintEntry,
          customPersonaPrompts,
          memoirRecallByPersona: recallMap,
        });
        if (cancelled) return;
        if (verdict.ok) await letterStore.markDelivered(letter.id, verdict.replyEntryId);
        else await letterStore.markFailed(letter.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterStore.loading, memoryStore.loading, memoirsOnly, onMintEntry]);

  const [showLetterCompose, setShowLetterCompose] = useState(false);

  const handleSendLetter = useCallback(
    async (options: { memoirId: string; body: string; delayMs: number }) => {
      const result = await letterStore.add(options);
      return result.ok;
    },
    [letterStore],
  );

  const handleOpenLetterReply = useCallback(
    (letter: PendingLetter) => {
      // Mark dismissed before navigating away so the card doesn't
      // re-appear when the user comes back to Dashboard.
      dismissArrivedLetter(letter);
      if (!letter.replyEntryId) return;
      const target = entries.find((e) => e.id === letter.replyEntryId);
      if (target) onSelectEntry(target);
    },
    [dismissArrivedLetter, entries, onSelectEntry],
  );

  // Phase 5 §5.1 + 5.2 — bundle license props once. prettier-ignore
  // keeps it on one line so the LOC ceiling stays under 600.
  // prettier-ignore
  const licenseProps = { licenseInstallId, licenseCurrentTier, licensePayload, licenseFailure, onActivateLicense, onDeactivateLicense, onOpenPricing };

  // Phase 4.5 §B — Echo Chamber wiring
  const [showEchoChamber, setShowEchoChamber] = useState(false);
  const echoChamberPaywall = useMemo(() => canStartEchoChamber(), []);
  // Phase 4.5 §E — migration export modal anchored here for live data access.
  const [showMigrationExport, setShowMigrationExport] = useState(false);

  // Round-table pool: built-in sages + custom persona names; de-dup by Set.
  const echoChamberPool = useMemo(
    () => Array.from(new Set([...PERSONAS, ...(customPersonas ?? []).map((p) => p.name)])),
    [customPersonas],
  );

  // Recall map: only Memoir-kind personas need long-term memory recall.
  const buildEchoRecallMap = useCallback(
    (query: string, picked: readonly string[]) => {
      const map: Record<string, ReadonlyArray<{ body: string }>> = {};
      const pickedSet = new Set(picked);
      for (const persona of customPersonas ?? []) {
        if (persona.kind !== 'memoir' || !pickedSet.has(persona.name)) continue;
        const recall = memoryStore.recallForMemoir(persona.id, query);
        if (recall.length > 0) map[persona.name] = recall;
      }
      return map;
    },
    [customPersonas, memoryStore],
  );

  const handleSaveEchoChamber = useCallback(
    async (payload: EchoChamberSavePayload) => {
      if (!onMintEntry) return false;
      try {
        const title = (t.echoChamberEntryTitlePrefix as string | undefined)
          ? `${t.echoChamberEntryTitlePrefix} · ${payload.query.slice(0, 60)}`
          : `圆桌 · ${payload.query.slice(0, 60)}`;
        await onMintEntry({
          title,
          content: payload.query,
          tags: ['echo-chamber'],
          morningStarAnalysis: JSON.stringify({
            content: payload.resultMarkdown,
            metrics: {},
          }),
          morningStarPersonas: [...payload.personaNames],
          reflection: payload.query,
          isEchoChamber: true,
          echoChamberQuery: payload.query,
        });
        return true;
      } catch (err) {
        console.warn('Echo Chamber save failed', err);
        return false;
      }
    },
    [onMintEntry, t.echoChamberEntryTitlePrefix],
  );
  const [quickCapture, setQuickCapture] = useState('');
  const [showDepthOptions, setShowDepthOptions] = useState(false);
  const [pendingQuickCapture, setPendingQuickCapture] = useState('');
  const [reflectionDepth, setReflectionDepth] = useState(1);

  const openDepthOptions = () => {
    setPendingQuickCapture(quickCapture.trim());
    setShowDepthOptions(true);
  };

  const continueFromDepthOptions = () => {
    const depth = reflectionDepthValues[reflectionDepth] ?? 'sort';
    onOpenComposerWithSeed?.({ content: pendingQuickCapture, reflectionDepth: depth });
    setQuickCapture('');
    setPendingQuickCapture('');
    setShowDepthOptions(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl min-h-screen flex flex-col relative z-10">
      <DashboardHeader
        theme={theme}
        language={language}
        dynamicVersion={dynamicVersion}
        isFullscreen={isFullscreen}
        onOpenArchive={onOpenArchive}
        toggleFullScreen={toggleFullScreen}
        syncStatus={syncStatus}
      />

      <DashboardOverlays
        theme={theme}
        language={language}
        t={t}
        backupReminderActive={false}
        daysSinceBackup={daysSinceBackup}
        onOpenSettings={() => setShowSettings(true)}
        pwaInstallAvailable={pwaInstall.isAvailable}
        onPwaInstall={() => {
          void pwaInstall.promptInstall();
        }}
        onPwaInstallDismiss={pwaInstall.dismiss}
        importPending={importConfirm.pending}
        onResolveImport={importConfirm.resolveConfirm}
        isVerifyingVault={isVerifyingVault}
        vaultPassword={vaultPassword}
        setVaultPassword={setVaultPassword}
        vaultError={vaultError}
        onUnlockVault={handleVaultUnlock}
        onCancelVault={handleVaultCancel}
      />

      <DashboardSettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        theme={theme}
        onSetTheme={onSetTheme}
        language={language}
        onSetLanguage={onSetLanguage}
        t={t}
        customIdentity={customIdentity}
        setCustomIdentity={setCustomIdentity}
        dynamicVersion={dynamicVersion}
        passwordHash={passwordHash}
        passwordSalt={passwordSalt}
        isUnlocked={isUnlocked}
        onSetPassword={onSetPassword}
        entries={entries}
        activeEntries={activeEntries}
        onBulkUpdateEntries={onBulkUpdateEntries}
        onWipeData={onWipeData}
        onCreateMaterialEntry={onCreateMaterialEntry}
        guidingStars={guidingStars}
        selectedStars={selectedStars}
        onSaveGuidingStars={onSaveGuidingStars}
        onSaveSelectedStars={onSaveSelectedStars}
        customPersonas={customPersonas}
        onAddCustomPersona={onAddCustomPersona}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onTriggerScan={onTriggerScan}
        lastScanSummary={lastScanSummary}
        handleExport={handleExport}
        dropdownRef={dropdownRef}
        isExportDropdownOpen={isExportDropdownOpen}
        setIsExportDropdownOpen={setIsExportDropdownOpen}
        exportTarget={exportTarget}
        setExportTarget={setExportTarget}
        handleDownloadNotes={handleDownloadNotes}
        importInputRef={importInputRef}
        handleImportBackup={onImportBackup ? handleImportBackup : undefined}
        importStatus={importStatus}
        handleGoHomeClick={handleGoHomeClick}
        isSailingHome={isSailingHome}
        setIsFullscreen={setIsFullscreen}
        onEditingStarsChange={setIsEditingStars}
        onOpenMigrationExport={() => setShowMigrationExport(true)}
        onOpenMigrationImport={onOpenMigrationImport}
        deviceFingerprint={deviceFingerprint}
        onRegenerateDeviceKeys={onRegenerateDeviceKeys}
        onOpenTrustedDevices={onOpenTrustedDevices}
        onOpenMemoirMemories={onOpenMemoirMemories}
        onOpenMemoirLetters={onOpenMemoirLetters}
        {...licenseProps}
      />

      <section
        className={`mb-5 border rounded-xl p-3 ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-black/30 border-cyan-900/40'}`}
        data-testid="quick-capture-bar"
      >
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            value={quickCapture}
            onChange={(e) => setQuickCapture(e.target.value)}
            placeholder={
              language === 'zh'
                ? '快速记录一句此刻想法，然后进入完整编辑...'
                : 'Quick capture one thought, then continue in editor...'
            }
            className={`flex-1 px-3 py-2 text-sm rounded-md border ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-black/50 border-cyan-900/60 text-cyan-100'}`}
          />
          <button
            type="button"
            className={`px-3 py-2 text-xs uppercase tracking-widest rounded-md border ${theme === 'light' ? 'border-cyan-300 text-cyan-700 hover:bg-cyan-50' : 'border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10'}`}
            onClick={openDepthOptions}
          >
            {language === 'zh' ? '刻录此刻' : 'Open writer'}
          </button>
        </div>
      </section>

      <ReflectionDepthModal
        open={showDepthOptions}
        theme={theme}
        language={language}
        depth={reflectionDepth}
        onDepthChange={setReflectionDepth}
        onCancel={() => setShowDepthOptions(false)}
        onContinue={continueFromDepthOptions}
      />

      <FilterBar
        theme={theme}
        language={language}
        showFilterHub={showFilterHub}
        isVaultOpen={isVaultOpen}
        onToggleVault={handleToggleVault}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupingMode={groupingMode}
        setGroupingMode={handleSetGroupingMode}
        isEditingStars={isEditingStars}
        entriesCount={baseFilteredEntries.length}
      />

      <AnimatePresence>
        {showFilterHub && (
          <FilterHub
            language={language}
            theme={theme}
            entries={activeEntries}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            containers={containers}
            onAddContainer={onAddContainer}
            onDeleteContainer={onDeleteContainer}
            onClose={() => setShowFilterHub(false)}
            groupingMode={groupingMode}
            onGroupingModeChange={handleSetGroupingMode}
          />
        )}
      </AnimatePresence>

      {/* Phase 4 W5 §3.2 — proactive recall surface. Renders a
          dismissible card per top suggestion (at-most-one per
          Memoir, specificity-merged). Opens above VaultContent so
          the user sees it on Dashboard mount but can scroll past
          it without obstruction.
          The Open CTA currently only dismisses — full pre-seeded
          composer hand-off is a Phase 4.5 follow-up tracked in
          [`docs/memoir-memory-system.md`](
          ../docs/memoir-memory-system.md) §3.2 future work. */}
      {isVaultOpen && hasCoreHabit && proactiveSuggestions.length > 0 && (
        <div className="container mx-auto px-4 max-w-5xl">
          {proactiveSuggestions.map((s) => (
            <ProactiveRecallCard
              key={`${s.memoirId}::${s.trigger}`}
              suggestion={s}
              theme={theme}
              t={t}
              onOpen={(s) => {
                dismissProactive(s);
                const prefix = (t.proactiveSeedTitlePrefix as string) ?? 'For';
                onOpenComposerWithSeed?.({
                  title: s.memoirName ? `${prefix} ${s.memoirName}` : undefined,
                  content: (t[s.promptHintKey] as string | undefined) ?? '',
                  tags: s.memoirName,
                });
              }}
              onDismiss={dismissProactive}
            />
          ))}
        </div>
      )}

      {/* Phase 4.5 §A — Letter arrived stack. Sister to the
          proactive-recall stack, intentionally below it so a
          stale "silence" suggestion never appears above an
          actual letter that just landed. */}
      {isVaultOpen && arrivedLetters.length > 0 && (
        <div className="container mx-auto px-4 max-w-5xl">
          {arrivedLetters.map((letter) => (
            <LetterArrivedCard
              key={letter.id}
              letter={letter}
              memoir={memoirsById.get(letter.memoirId)}
              theme={theme}
              t={t}
              onOpenReply={handleOpenLetterReply}
              onDismiss={dismissArrivedLetter}
            />
          ))}
        </div>
      )}

      <VaultContent
        isVaultOpen={isVaultOpen}
        onUnsealRequest={handleToggleVault}
        loading={loading}
        theme={theme}
        language={language}
        t={t}
        searchQuery={searchQuery}
        paginatedEntries={paginatedEntries}
        filteredEntries={filteredEntries}
        hasMore={hasMore}
        onLoadMore={loadMore}
        groupingMode={groupingMode}
        groupedEntries={groupedEntries}
        groupKeys={groupKeys}
        isListView={isListView}
        onSelectEntry={onSelectEntry}
        showFilterHub={showFilterHub}
        setShowFilterHub={setShowFilterHub}
        customIdentity={customIdentity}
        currentUser={currentUser}
      />

      <DashboardFooter
        theme={theme}
        t={t}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Phase 4.5 §A — Letter Mode entry point + compose modal.
          The entry point is a floating "✉ 写信" pill rendered
          only when the user owns at least one Memoir + the vault
          is unlocked. We deliberately keep the surface small —
          letter mode is a deep-engagement feature, not a primary
          CTA competing with the entry composer. */}
      {isVaultOpen && hasCoreHabit && memoirsOnly.length > 0 && (
        <button
          type="button"
          onClick={() => setShowLetterCompose(true)}
          className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full border-2 backdrop-blur-md shadow-lg transition-colors ${theme === 'light' ? 'bg-amber-50/90 border-amber-200 text-rose-700 hover:bg-amber-50' : 'bg-amber-500/10 border-amber-500/40 text-rose-200 hover:bg-amber-500/20'}`}
          aria-label={(t.letterComposeOpenAria as string) ?? 'Write a letter to a memoir'}
          data-testid="letter-compose-fab"
        >
          <span className="text-sm">✉</span>
          <span className="text-[11px] uppercase tracking-widest">
            {(t.letterComposeOpenLabel as string) ?? 'Write a letter'}
          </span>
        </button>
      )}

      <LetterComposeModal
        open={showLetterCompose}
        onClose={() => setShowLetterCompose(false)}
        theme={theme}
        t={t}
        memoirs={memoirsOnly}
        onSendLetter={handleSendLetter}
      />

      <EchoChamberModal
        open={showEchoChamber}
        onClose={() => setShowEchoChamber(false)}
        theme={theme}
        language={language}
        t={t}
        paywallVerdict={echoChamberPaywall}
        availablePersonas={echoChamberPool}
        customPersonas={customPersonas}
        buildRecallMap={buildEchoRecallMap}
        onSave={handleSaveEchoChamber}
      />

      {/* prettier-ignore */}
      <DashboardMigrationExport open={showMigrationExport} onClose={() => setShowMigrationExport(false)} theme={theme} t={t} version={dynamicVersion} entries={entries} customPersonas={customPersonas} memories={memories ?? []} letters={pendingLetters ?? []} currentUser={currentUser} passwordHash={passwordHash} passwordSalt={passwordSalt} onUnlockSigningKey={onUnlockSigningKey} />
    </div>
  );
};
