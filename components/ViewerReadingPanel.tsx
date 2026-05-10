import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, AlertTriangle, Key } from 'lucide-react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { DiaryEntry, Theme, Container } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { DecryptionText } from './DecryptionText';
import { ViewerAttachmentPanel } from './ViewerAttachmentPanel';
import { ViewerActionFooter } from './ViewerActionFooter';
import { MorningStarPanel } from './MorningStarPanel';
import type { ParsedMorningStarAnalysis } from '../hooks/useMorningStarPipeline';

interface DecodedStar {
  top: string;
  right: string;
  duration: number;
  delay: number;
}

export type BurnMode = 'idle' | 'confirm' | 'igniting' | 'burning' | 'ashed';
export type ArchiveState = 'idle' | 'scanning' | 'uploading' | 'completed';
export type ReadingStep = 'reading' | 'reflecting' | 'evaluation';

interface ViewerReadingPanelProps {
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  decrypted: boolean;
  decryptedContent: string;
  decodedStars: readonly DecodedStar[];
  burnMode: BurnMode;
  archiveState: ArchiveState;
  showConfirmHome: boolean;
  showPackingMenu: boolean;
  containers: Container[];
  onTogglePackingMenu: () => void;
  onMoveToContainer: (containerId: string | undefined) => void;
  onArchiveOrRestore: () => void | Promise<void>;
  onDownload: () => void;
  /** Phase 3 §3.h — open the share-card preview / export modal.
   *  Optional so existing tests / call sites compile unchanged. */
  onShareCard?: () => void;
  // Morning Star
  guidingStars: string[];
  readingStep: ReadingStep;
  setReadingStep: (step: ReadingStep) => void;
  reflectionText: string;
  setReflectionText: (value: string) => void;
  morningStarPersonas: string[];
  setMorningStarPersonas: (personas: string[]) => void;
  morningStarLoading: boolean;
  morningStarError: string | null;
  /** W2.4 — incremental SSE preview text. Empty when streaming is off. */
  morningStarStreamingPreview?: string;
  parsedAnalysis: ParsedMorningStarAnalysis | null;
  onAnalyze: () => void | Promise<void>;
  onDeleteAnalysis: () => void;
  // Burn / nav
  onBack: () => void;
  /** Footer "burn" button — moves into the confirmation overlay. */
  onRequestBurn: () => void;
  /** Confirmation overlay "cancel" — bail out without deleting. */
  onCancelBurn: () => void;
  /** Confirmation overlay "confirm" — actually perform the burn. */
  onExecuteBurn: () => void;
  // Markdown rendering
  markdownComponents: Components;
}

const computeContainerStyles = (burnMode: BurnMode, archiveState: ArchiveState): string => {
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

/**
 * The decrypted "letter open" view: header / metadata / Markdown body /
 * attachment / Morning Star / action footer / burn confirmation overlay.
 *
 * Pure stateless — every interaction goes back to the parent's hooks
 * (`useViewerAccess`, `useMorningStarPipeline`) so the panel can be
 * mounted/unmounted by `AnimatePresence` without losing workflow state.
 */
export const ViewerReadingPanel: React.FC<ViewerReadingPanelProps> = ({
  theme,
  t,
  entry,
  decrypted,
  decryptedContent,
  decodedStars,
  burnMode,
  archiveState,
  showConfirmHome,
  showPackingMenu,
  containers,
  onTogglePackingMenu,
  onMoveToContainer,
  onArchiveOrRestore,
  onDownload,
  guidingStars,
  readingStep,
  setReadingStep,
  reflectionText,
  setReflectionText,
  morningStarPersonas,
  setMorningStarPersonas,
  morningStarLoading,
  morningStarError,
  morningStarStreamingPreview,
  parsedAnalysis,
  onAnalyze,
  onDeleteAnalysis,
  onBack,
  onRequestBurn,
  onCancelBurn,
  onExecuteBurn,
  onShareCard,
  markdownComponents,
}) => (
  <motion.div
    initial={{
      opacity: 0,
      y: 40,
      scale: 0.8,
      skewX: -20,
      skewY: 10,
      filter: 'blur(30px) brightness(2)',
    }}
    animate={{
      opacity: 1,
      y: 0,
      scale: 1,
      skewX: 0,
      skewY: 0,
      filter: 'blur(0px) brightness(1)',
    }}
    exit={{
      opacity: 0,
      y: -40,
      scale: 1.1,
      skewX: 20,
      filter: 'blur(20px)',
    }}
    transition={{
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      opacity: { duration: 0.8 },
    }}
    className={`container mx-auto px-4 py-4 md:py-6 max-w-3xl min-h-screen ${computeContainerStyles(burnMode, archiveState)}`}
  >
    {burnMode === 'idle' && archiveState === 'idle' && (
      <div className="mb-8 flex justify-between items-center z-20 relative">
        <CyberButton
          variant="ghost"
          onClick={onBack}
          theme={theme}
          className={theme === 'light' ? 'text-vector-slate-soft hover:bg-vector-cyan-brand/5' : ''}
        >
          <ArrowLeft className="w-4 h-4" /> {t.closeFile}
        </CyberButton>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {showConfirmHome && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest drop-shadow-glow-indigo"
              >
                {t.confirmAction || 'Confirm?'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    )}

    <div
      className={`border p-6 md:p-12 relative overflow-hidden min-h-[500px] transition-all duration-1000 shadow-lg z-10 backdrop-blur-md
              ${theme === 'light' ? 'bg-white/95 border-vector-cyan-brand/10 shadow-slate-200/50' : 'bg-vector-onyx/90 border-cyan-500/20'}
              ${
                burnMode === 'confirm'
                  ? 'border-rose-500 shadow-glow-rose-strong'
                  : burnMode !== 'idle'
                    ? 'border-rose-500 bg-rose-950/20'
                    : archiveState !== 'idle'
                      ? 'border-green-500 bg-green-900/10'
                      : ''
              }
            `}
    >
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none z-30 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 3.5, opacity: 0 }}
            transition={{ duration: 8, repeat: Infinity, delay: i * 2.5, ease: 'linear' }}
            className={`absolute top-0 right-0 w-24 h-24 border rounded-full -translate-y-1/2 translate-x-1/2 ${
              i === 1 && theme === 'dark'
                ? 'border-indigo-500/40 shadow-glow-indigo-strong'
                : theme === 'light'
                  ? 'border-cyan-500/30'
                  : 'border-cyan-400/30 shadow-glow-cyan-400-mid'
            }`}
          />
        ))}

        <div className="absolute inset-y-0 right-0 w-full z-5">
          {decodedStars.map((star, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
              className="absolute w-0.5 h-0.5 bg-white rounded-full bg-slate-100"
              style={{ top: star.top, right: star.right }}
            />
          ))}
        </div>

        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 opacity-40" />
        <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 blur-2xl rounded-full -translate-y-1/3 translate-x-1/3 opacity-30 shadow-glow-indigo-soft" />
      </div>

      <div className="pb-4 mb-6 relative z-10">
        <div
          className={`flex items-center gap-3 mb-8 px-2 border-l-2 ${theme === 'light' ? 'border-slate-300' : 'border-cyan-800'}`}
        >
          <span
            className={`text-[8px] font-mono tracking-[0.4em] uppercase opacity-40 ${theme === 'light' ? 'text-slate-500' : 'text-cyan-600'}`}
          >
            {t.transmissionDecoded}
          </span>
        </div>

        <h1
          className={`text-2xl md:text-4xl font-bold mb-1 tracking-wide uppercase leading-tight font-mono ${theme === 'light' ? 'text-vector-ink-strong' : 'text-white'}`}
        >
          {decrypted ? (
            <DecryptionText text={entry.title} speed={50} />
          ) : (
            <span
              className={`${theme === 'light' ? 'text-vector-slate-soft/20' : 'text-gray-600'} blur-sm select-none`}
            >
              {t.encryptedTitle}
            </span>
          )}
        </h1>

        <div
          className={`flex flex-wrap gap-4 text-[10px] font-mono mt-2 items-center uppercase tracking-wider ${theme === 'light' ? 'text-vector-slate-soft' : 'text-cyan-500/60'}`}
        >
          <span className="flex items-center gap-1">
            <Key className="w-3 h-3" /> {new Date(entry.createdAt).toLocaleString('zh-CN')}
          </span>
          <span className={decrypted ? 'text-green-500 font-bold' : 'text-yellow-500 font-bold'}>
            {decrypted
              ? entry.isArchived
                ? t.statusArchived
                : t.statusUnlocked
              : t.statusDecrypting}
          </span>
        </div>

        {entry.tags && entry.tags.length > 0 && decrypted && (
          <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-left-2 duration-700">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[9px] uppercase px-2 py-0.5 border rounded-sm ${theme === 'light' ? 'border-vector-cyan-brand/10 text-vector-slate-soft bg-vector-cyan-brand/2' : 'border-cyan-900 text-cyan-600 bg-cyan-950/10'}`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10">
        {/* Phase 4.5 follow-ups (F3) — Echo Chamber preface.
            When the user opens an entry that captured a round-table
            session (`entry.isEchoChamber === true`), surface the
            **original question** they asked at the very top so the
            consensus / divergence body has its anchor. The block
            uses a quiet bordered card to read as "context", not
            content. */}
        {entry.isEchoChamber && entry.echoChamberQuery && decrypted && (
          <div
            className={`mb-6 p-4 rounded-md border-l-4 ${theme === 'light' ? 'bg-vector-cyan-brand/5 border-vector-cyan-brand/40 text-vector-slate-soft' : 'bg-cyan-500/5 border-cyan-500/40 text-cyan-200/80'}`}
            data-testid="viewer-echo-preface"
          >
            <p
              className={`text-[10px] uppercase tracking-widest mb-1 font-bold ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-300'}`}
            >
              {(t.echoChamberPrefaceLabel as string) ?? 'Round-table prompt'}
            </p>
            <p className="text-[13px] italic leading-relaxed whitespace-pre-wrap">
              {entry.echoChamberQuery}
            </p>
          </div>
        )}

        {decrypted ? (
          <div className="space-y-6">
            <div
              className={`prose max-w-none ${theme === 'light' ? 'prose-slate' : 'prose-invert'}`}
            >
              <div
                className={`leading-relaxed font-serif text-lg md:text-xl whitespace-pre-wrap selection:bg-cyan-500/30 ${theme === 'light' ? 'text-vector-ink-strong' : 'text-cyan-100/90'}`}
              >
                <Markdown components={markdownComponents}>{decryptedContent}</Markdown>
              </div>
            </div>

            {entry.attachment && (
              <ViewerAttachmentPanel attachment={entry.attachment} theme={theme} />
            )}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-20 select-none">
            <span
              className={`${theme === 'light' ? 'text-vector-slate-soft/20' : 'text-gray-600'} blur-sm select-none text-4xl break-all line-clamp-3`}
            >
              {entry.content}
            </span>
          </div>
        )}
      </div>

      <MorningStarPanel
        theme={theme}
        t={t}
        entry={entry}
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
        onAnalyze={onAnalyze}
        onDeleteAnalysis={onDeleteAnalysis}
        markdownComponents={markdownComponents}
      />

      {decrypted &&
        burnMode === 'idle' &&
        archiveState === 'idle' &&
        (readingStep === 'reading' || readingStep === 'evaluation') && (
          <ViewerActionFooter
            theme={theme}
            t={t}
            entry={entry}
            containers={containers}
            showPackingMenu={showPackingMenu}
            onTogglePackingMenu={onTogglePackingMenu}
            onMoveToContainer={onMoveToContainer}
            onArchiveOrRestore={onArchiveOrRestore}
            onDownload={onDownload}
            onRequestBurn={onRequestBurn}
            onShareCard={onShareCard}
          />
        )}

      <AnimatePresence>
        {burnMode === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-6 ${theme === 'light' ? 'bg-white/95' : 'bg-black/90'}`}
          >
            <div className="text-center space-y-6 max-w-sm">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/40 shadow-glow-rose-soft">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <div className="space-y-2">
                <h3
                  className={`text-xl font-bold uppercase tracking-tighter ${theme === 'light' ? 'text-vector-ink-strong' : 'text-white'}`}
                >
                  {t.confirmDestruction}
                </h3>
                <p className="text-xs font-mono text-rose-500/60">{t.permDelete}</p>
              </div>
              <div className="flex gap-4">
                <CyberButton
                  className="flex-1"
                  variant="ghost"
                  onClick={onCancelBurn}
                  theme={theme}
                >
                  {t.cancel}
                </CyberButton>
                <CyberButton
                  className="flex-1"
                  variant="danger"
                  onClick={onExecuteBurn}
                  theme={theme}
                >
                  {t.confirm}
                </CyberButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-5 bg-cyan-500/5"></div>
    </div>

    <div
      className={`mt-8 flex justify-between items-center text-[8px] font-mono uppercase tracking-[0.3em] ${theme === 'light' ? 'text-vector-slate-soft/40' : 'text-cyan-900'}`}
    >
      <span>VECTOR_TRACE_PROTOCOL_V2.8</span>
      <span>NODE_ID: {entry.id}</span>
      <span>ENCRYPTION: AES-256-GCM</span>
    </div>
  </motion.div>
);
