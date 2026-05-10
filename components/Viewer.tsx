import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { CustomPersona, DiaryEntry, Language, Theme, Container } from '../types';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString } from '../services/browserStorage';
import { downloadTextFile } from '../services/fileDownload';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { useViewerStars } from '../hooks/useViewerStars';
import { ViewerSealedPanel } from './ViewerSealedPanel';
import { ViewerReadingPanel } from './ViewerReadingPanel';
import { useViewerAccess } from '../hooks/useViewerAccess';
import { useMorningStarPipeline } from '../hooks/useMorningStarPipeline';
import { useMemoryStore } from '../hooks/useMemoryStore';
import { useMemoirMemoryHarvest } from '../hooks/useMemoirMemoryHarvest';
import { TRANSLATIONS } from '../constants';
import { ViewerStarfield } from './ViewerStarfield';
import { buildViewerMarkdownComponents } from './viewerMarkdown';
import { ShareCardModal } from './ShareCardModal';

interface ViewerProps {
  language: Language;
  theme: Theme;
  entry: DiaryEntry;
  currentUser: string | null;
  masterPassword: string | null;
  guidingStars: string[];
  /** Phase 4 §5.1.A — user-created custom 启明星. Optional: when
   *  absent (legacy callers), Morning Star uses the generic fallback
   *  for any unknown persona name. */
  customPersonas?: CustomPersona[];
  onBack: () => void;
  onGoHome?: () => void;
  onUpdateEntry: (updatedEntry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  containers: Container[];
}

// Markdown components and TypewriterText were moved to dedicated modules
// (`./viewerMarkdown` and `./TypewriterText`) so this file stays focused on
// the viewer's stateful workflow rather than rendering primitives.

export const Viewer: React.FC<ViewerProps> = ({
  language,
  theme,
  entry,
  currentUser,
  masterPassword,
  guidingStars,
  customPersonas,
  onBack,
  onGoHome,
  onUpdateEntry,
  onDelete,
  onArchive,
  onRestore,
  containers,
}) => {
  const t = TRANSLATIONS[language];
  const [now, setNow] = useState(Date.now());
  const isTimeLocked = entry.unlockAt ? now < entry.unlockAt : false;
  const { scheduleTimeout, clearScheduledTimeouts } = useTimeoutManager();
  const displayIdentity = useMemo(
    () => getStoredString(AppStorageKeys.customIdentity)?.slice(0, 15) || 'GUEST_01',
    [],
  );
  const { fixedStars, twinklingStars, rippleStars, decodedStars } = useViewerStars(entry.id);

  const [showPackingMenu, setShowPackingMenu] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showConfirmHome, setShowConfirmHome] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const handleMoveToContainer = (containerId: string | undefined) => {
    onUpdateEntry({ ...entry, containerId });
    setShowPackingMenu(false);
  };

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    scheduleTimeout(() => setIsShaking(false), 500);
  }, [scheduleTimeout]);

  const access = useViewerAccess({
    entry,
    masterPassword,
    isTimeLocked,
    t,
    onShake: triggerShake,
  });
  const {
    viewState,
    decrypted,
    decryptedContent,
    decryptionPassword,
    setDecryptionPassword,
    decryptionError,
    biometricAvailable,
    isScanning,
    biometricError,
    lockout,
    handleOpenLetter,
    handleBiometricAuth,
  } = access;
  const { lockoutUntil } = lockout;

  // Phase 4 §5.1.A — build the `name → systemPrompt` lookup table once
  // per render so it's stable across the pipeline's deps. Memoised on
  // the customPersonas reference (parent already stable across
  // renders thanks to `useCustomPersonas`).
  const customPersonaPrompts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const persona of customPersonas ?? []) {
      map[persona.name] = persona.systemPrompt;
    }
    return map;
  }, [customPersonas]);

  // Phase 4 §5.1.B — Memoir long-term memory recall.
  //
  // For every Memoir-kind persona present in `customPersonas`, look
  // up the top-N relevant memories (recency × keyword query) and key
  // them by the Memoir's name so the Morning Star prompt builder
  // can append the recall block to that persona's section.
  //
  // Why call `recallForMemoir` per-persona inside a `useMemo` instead
  // of per-render: the recall ranker is pure and reads the live
  // memory ref, so the only cost is the O(M·log M) sort per Memoir.
  // For typical M ≤ 200 memories per Memoir × ≤ 5 Memoirs = trivial.
  //
  // The `entry.title + entry.content` snippet is used as the recall
  // query so the recall is biased toward memories that overlap with
  // the current journal entry's themes — same intuition as the
  // entry-aware suggestions in the Persona Builder discussion.
  const { recallForMemoir, addMemory } = useMemoryStore();

  // Phase 4 Week 3.5 — Memoir memory harvest hook. Closes the
  // 心象 long-term memory loop: every successful Morning Star round
  // that included a Memoir persona triggers a background extractor
  // call → the surviving candidates land in `useMemoryStore` and
  // become recall context on the NEXT round.
  //
  // The hook owns its own AbortController so navigating away from
  // the entry mid-harvest cancels cleanly. Errors are silenced
  // by the underlying service (extraction is a background
  // enrichment, not a user-visible step).
  const { triggerHarvest, cancelInFlight: cancelHarvest } = useMemoirMemoryHarvest({
    customPersonas: customPersonas ?? [],
    addMemory,
  });

  // Cancel any in-flight harvest when the user navigates away.
  useEffect(
    () => () => {
      cancelHarvest();
    },
    [cancelHarvest],
  );

  // Stable handler the pipeline calls after a successful round.
  // Wrapping in a useCallback keeps the pipeline's deps from
  // churning every render.
  const handleAnalysisHarvest = useCallback(
    (input: {
      reflection: string;
      rawResponse: string;
      participatingPersonas: readonly string[];
    }) => {
      // The Morning Star result is wrapped in a JSON envelope —
      // unwrap to the markdown body before slicing per Memoir.
      let markdown = input.rawResponse;
      try {
        const parsed = JSON.parse(input.rawResponse);
        if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
          markdown = parsed.content;
        }
      } catch {
        // raw is not JSON — fall back to using it as-is.
      }
      void triggerHarvest({
        reflection: input.reflection,
        responseMarkdown: markdown,
        participatingPersonas: input.participatingPersonas,
        sourceRef: `entry-${entry.id}`,
      });
    },
    [entry.id, triggerHarvest],
  );
  const memoirRecallByPersona = useMemo(() => {
    const map: Record<string, ReadonlyArray<{ body: string }>> = {};
    const query = `${entry.title ?? ''} ${decryptedContent || entry.content || ''}`.slice(0, 400);
    for (const persona of customPersonas ?? []) {
      if (persona.kind !== 'memoir') continue;
      const recall = recallForMemoir(persona.id, query);
      if (recall.length > 0) map[persona.name] = recall;
    }
    return map;
  }, [customPersonas, entry.title, entry.content, decryptedContent, recallForMemoir]);

  const morningStar = useMorningStarPipeline({
    entry,
    guidingStars,
    decryptedContent,
    language,
    onUpdateEntry,
    customPersonaPrompts,
    memoirRecallByPersona,
    onAnalysisHarvest: handleAnalysisHarvest,
  });
  const {
    personas: morningStarPersonas,
    setPersonas: setMorningStarPersonas,
    reflectionText,
    setReflectionText,
    loading: morningStarLoading,
    error: morningStarError,
    streamingPreview: morningStarStreamingPreview,
    parsedAnalysis,
    readingStep,
    setReadingStep,
    analyze: handleMorningStarAnalysis,
    deleteAnalysis: handleDeleteAnalysis,
  } = morningStar;

  // Destruction State
  const [burnMode, setBurnMode] = useState<'idle' | 'confirm' | 'igniting' | 'burning' | 'ashed'>(
    'idle',
  );

  // Archival/Restore State
  const [archiveState, setArchiveState] = useState<'idle' | 'scanning' | 'uploading' | 'completed'>(
    'idle',
  );

  useEffect(() => {
    if (!isTimeLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTimeLocked]);

  const getTimeLeft = () => {
    if (!entry.unlockAt) return null;
    const diff = entry.unlockAt - now;
    if (diff <= 0) return null;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    return { d, h, m, s };
  };

  const timeLeft = getTimeLeft();

  // Reset Viewer-local non-access state when navigating into a different
  // entry. (`useViewerAccess` and `useMorningStarPipeline` reset their own
  // slices.) `burnMode` and `archiveState` are exclusive to Viewer so we
  // mirror them here — anything else has already been pulled into a hook.
  useEffect(() => {
    clearScheduledTimeouts();
    setBurnMode('idle');
    setArchiveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  // (Decryption error auto-clear, handleOpenLetter and handleBiometricAuth
  //  live in useViewerAccess now.)
  // (Morning Star analyze / delete live in useMorningStarPipeline.)

  // --- BURN LOGIC ---
  const initBurn = () => setBurnMode('confirm');
  const cancelBurn = () => setBurnMode('idle');
  const executeBurn = () => {
    setBurnMode('igniting');
    scheduleTimeout(() => setBurnMode('burning'), 800);
    scheduleTimeout(() => {
      setBurnMode('ashed');
      scheduleTimeout(() => onDelete(entry.id), 1000);
    }, 3000);
  };

  // --- ARCHIVE LOGIC ---
  const executeArchiveOrRestore = async () => {
    if (archiveState !== 'idle') return;

    setArchiveState('scanning');

    setArchiveState('uploading');

    // The DeepArchiveAnimation takes 3 seconds
    scheduleTimeout(() => {
      setArchiveState('completed');
      scheduleTimeout(() => {
        if (entry.isArchived) {
          onRestore(entry.id);
        } else {
          // Save the entry when archiving
          const updatedEntry = {
            ...entry,
            isArchived: true,
          };
          onUpdateEntry(updatedEntry);
          onArchive(entry.id);
        }
      }, 800);
    }, 3000); // Wait for the 3s animation
  };

  const handleDownload = () => {
    downloadTextFile(decryptedContent, `${entry.title}.txt`);
  };

  const getContainerStyles = () => {
    if (burnMode === 'igniting' || burnMode === 'burning') {
      return 'brightness-150 contrast-125 sepia-100 hue-rotate-[-50deg]';
    }
    if (burnMode === 'ashed') {
      return 'grayscale brightness-0 opacity-0 scale-90 blur-md';
    }
    if (archiveState !== 'idle') {
      switch (archiveState) {
        case 'scanning':
          return 'relative after:absolute after:inset-0 after:bg-green-500/10 after:z-10';
        case 'uploading':
          return 'opacity-50 scale-95 blur-[1px] hue-rotate-[50deg] translate-y-[-20px] transition-all duration-[2000ms]';
        case 'completed':
          return 'opacity-0 scale-0 transition-all duration-500';
        default:
          return '';
      }
    }
    return '';
  };

  return (
    <div
      className={`relative min-h-screen overflow-hidden flex flex-col items-center transition-colors duration-1000 ${theme === 'light' ? 'bg-vector-fog-light' : 'bg-vector-onyx'}`}
    >
      <ViewerStarfield theme={theme} fixedStars={fixedStars} twinklingStars={twinklingStars} />

      <AnimatePresence>
        {viewState !== 'reading' && (
          <ViewerSealedPanel
            theme={theme}
            t={t}
            entry={entry}
            displayIdentity={displayIdentity}
            viewState={viewState}
            decryptionPassword={decryptionPassword}
            setDecryptionPassword={setDecryptionPassword}
            decryptionError={decryptionError}
            biometricError={biometricError}
            isScanning={isScanning}
            lockoutUntil={lockoutUntil}
            isTimeLocked={isTimeLocked}
            timeLeft={timeLeft}
            rippleStars={rippleStars}
            onOpenLetter={() => void handleOpenLetter()}
            onBack={onBack}
          />
        )}
      </AnimatePresence>

      {/* 
         === STATE 2: READING CONTENT (The "Letter" Unfolded) === 
         【核心安全点 3：物理隔离渲染】
         敏感内容容器仅在 viewState === 'reading' 时存在于 DOM 中。
         这从根本上杜绝了通过 CSS (如 display: block) 绕过验证的可能性。
      */}
      <AnimatePresence>
        {viewState === 'reading' && (
          <ViewerReadingPanel
            theme={theme}
            t={t}
            entry={entry}
            decrypted={decrypted}
            decryptedContent={decryptedContent}
            decodedStars={decodedStars}
            burnMode={burnMode}
            archiveState={archiveState}
            showConfirmHome={showConfirmHome}
            showPackingMenu={showPackingMenu}
            containers={containers}
            onTogglePackingMenu={() => setShowPackingMenu(!showPackingMenu)}
            onMoveToContainer={handleMoveToContainer}
            onArchiveOrRestore={executeArchiveOrRestore}
            onDownload={handleDownload}
            guidingStars={guidingStars}
            readingStep={readingStep}
            setReadingStep={setReadingStep}
            reflectionText={reflectionText}
            setReflectionText={setReflectionText}
            morningStarPersonas={morningStarPersonas}
            setMorningStarPersonas={setMorningStarPersonas}
            morningStarLoading={morningStarLoading}
            morningStarError={morningStarError}
            morningStarStreamingPreview={morningStarStreamingPreview}
            parsedAnalysis={parsedAnalysis}
            onAnalyze={handleMorningStarAnalysis}
            onDeleteAnalysis={handleDeleteAnalysis}
            onBack={onBack}
            onRequestBurn={initBurn}
            onCancelBurn={cancelBurn}
            onExecuteBurn={executeBurn}
            onShareCard={decrypted ? () => setShareCardOpen(true) : undefined}
            markdownComponents={buildViewerMarkdownComponents(theme)}
          />
        )}
      </AnimatePresence>

      <ShareCardModal
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        theme={theme}
        t={t}
        entry={{ ...entry, content: decryptedContent || entry.content }}
        displayIdentity={displayIdentity}
      />

      {/* Keyframes (Simplified) */}
      <style>{`
        /* scan-down removed for performance */
      `}</style>
    </div>
  );
};
