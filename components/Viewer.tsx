import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { DiaryEntry, Language, Theme, Container } from '../types';
import { AppStorageKeys } from '../services/appSettings';
import { getStoredString } from '../services/browserStorage';
import { downloadTextFile } from '../services/fileDownload';
import { useTimeoutManager } from '../hooks/useTimeoutManager';
import { useViewerStars } from '../hooks/useViewerStars';
import { ViewerReadingPanel } from './ViewerReadingPanel';
import { useViewerAccess } from '../hooks/useViewerAccess';
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
  const { fixedStars, twinklingStars, decodedStars } = useViewerStars(entry.id);

  const [showPackingMenu, setShowPackingMenu] = useState(false);
  const [showConfirmHome, setShowConfirmHome] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const handleMoveToContainer = (containerId: string | undefined) => {
    onUpdateEntry({ ...entry, containerId });
    setShowPackingMenu(false);
  };

  const access = useViewerAccess({
    entry,
    masterPassword,
    isTimeLocked,
    t,
  });
  const { viewState, decrypted, decryptedContent } = access;

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

  // Reset Viewer-local non-access state when navigating into a different
  // entry. `burnMode` and `archiveState` are exclusive to Viewer so we
  // mirror them here.
  useEffect(() => {
    clearScheduledTimeouts();
    setBurnMode('idle');
    setArchiveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  // (Access state lives in useViewerAccess now.)

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
