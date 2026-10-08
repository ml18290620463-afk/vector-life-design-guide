import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { DiaryEntry, Language, Theme } from '../types';
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
  onDelete: (id: string) => void | Promise<void>;
  onOpenAvatar?: () => void;
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
  onDelete,
  onOpenAvatar,
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

  const [showConfirmHome, setShowConfirmHome] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [shareCardOpen, setShareCardOpen] = useState(false);

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

  useEffect(() => {
    if (!isTimeLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTimeLocked]);

  // Reset Viewer-local non-access state when navigating into a different
  // entry. `burnMode` is exclusive to Viewer so we mirror it here.
  useEffect(() => {
    clearScheduledTimeouts();
    setBurnMode('idle');
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
    return '';
  };

  return (
    <div
      className={`vector-viewer relative min-h-screen overflow-hidden flex flex-col items-center transition-colors duration-1000 ${theme === 'light' ? 'bg-vector-fog-light' : 'bg-vector-onyx'}`}
    >
      <ViewerStarfield theme={theme} fixedStars={fixedStars} twinklingStars={twinklingStars} />

      {/* 
         === STATE 2: READING CONTENT (The "Letter" Unfolded) === 
         【核心安全点 3：物理隔离渲染】
         敏感内容容器仅在 viewState === 'reading' 时存在于 DOM 中。
         这从根本上杜绝了通过 CSS (如 display: block) 绕过验证的可能性。
      */}
      <AnimatePresence>
        {viewState !== 'reading' && (
          <div role="status" className="relative z-10 p-6">
            <p>
              {isTimeLocked
                ? t.notReady || '尚未到开启时间'
                : access.decryptionError || '正在读取…'}
            </p>
            <button type="button" onClick={onBack}>
              返回
            </button>
          </div>
        )}
        {viewState === 'reading' && (
          <ViewerReadingPanel
            theme={theme}
            t={t}
            entry={entry}
            decrypted={decrypted}
            decryptedContent={decryptedContent}
            decodedStars={decodedStars}
            burnMode={burnMode}
            showConfirmHome={showConfirmHome}
            onDownload={handleDownload}
            onBack={onBack}
            onRequestBurn={initBurn}
            onCancelBurn={cancelBurn}
            onExecuteBurn={executeBurn}
            onShareCard={decrypted ? () => setShareCardOpen(true) : undefined}
            onOpenAvatar={onOpenAvatar}
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
