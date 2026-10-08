import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Eye, EyeOff, ImageIcon, Tag, X } from 'lucide-react';
import type { DiaryEntry, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';
import { ShareCard, type ShareCardLabels } from './ShareCard';
import { useShareCardOptions } from '../hooks/useShareCardOptions';
import { useShareCardExport, type ShareCardExportStatus } from '../hooks/useShareCardExport';
import { SHARE_CARD_DIMENSIONS } from '../lib/shareCardPalette';

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  t: TranslationDictionary;
  entry: DiaryEntry;
  displayIdentity: string;
}

const buildLabels = (t: TranslationDictionary): ShareCardLabels => ({
  eyebrow: t.shareCardEyebrow ?? 'VECTOR · Reflection card',
  bodyMaskedPlaceholder:
    t.shareCardBodyMasked ??
    'Body content hidden by default. Toggle "Show body" to include it in the export.',
  footerAttribution: t.shareCardFooter ?? 'Local-first journal · vectorlife.app',
  attachmentBadge: t.shareCardAttachmentBadge ?? 'Has attachment',
  emptyBodyPlaceholder: t.shareCardEmptyBody ?? '(no body)',
});

/**
 * Phase 3 §3.h — share-card preview + privacy-toggle + export modal.
 *
 * Wired into the Viewer footer via `onShareCard`. Owns:
 *   - the live `useShareCardOptions` toggles (privacy-default-on
 *     for body content);
 *   - the offscreen `<ShareCard>` reference fed into
 *     `useShareCardExport.exportPng`;
 *   - the scaled-down preview rendered inside the modal so the
 *     user sees exactly what they will get before saving.
 */
export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  open,
  onClose,
  theme,
  t,
  entry,
  displayIdentity,
}) => {
  const { options, updateOption, resetToDefaults } = useShareCardOptions();
  const { status, errorMessage, exportPng, reset } = useShareCardExport();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const labels = buildLabels(t);

  // Reset the export status whenever the modal opens so a previous
  // session's "success" / "error" doesn't leak into the new view.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Close on Escape — keeps keyboard parity with the rest of the
  // app's modals (`SettingsPanel`, `MasterLock`).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleExport = async () => {
    const safeTitle = entry.title?.trim() || 'entry';
    await exportPng(cardRef.current, {
      filename: `vector-share-card-${safeTitle.slice(0, 32)}-${entry.id.slice(0, 6)}`,
    });
  };

  // Preview width: 360 px feels right inside a centred modal on
  // desktop and degrades gracefully on mobile (the modal scrolls).
  // Card itself is canonically 1080 px wide; preview scale = 1/3.
  const PREVIEW_WIDTH = 360;
  const previewScale = PREVIEW_WIDTH / SHARE_CARD_DIMENSIONS.width;
  const previewHeight = SHARE_CARD_DIMENSIONS.height * previewScale;

  const surface =
    theme === 'light'
      ? 'bg-vector-paper-white border-slate-200 text-vector-ink-strong'
      : 'bg-vector-night-navy border-cyan-950/60 text-cyan-100';
  const subtleText = theme === 'light' ? 'text-vector-slate-soft' : 'text-vector-slate-chrome';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t.shareCardTitle ?? 'Share card'}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={`relative w-full max-w-3xl border rounded-2xl p-8 my-12 shadow-2xl ${surface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close ?? 'Close'}
              className="absolute top-4 right-4 p-2 rounded-md hover:bg-cyan-500/10 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <h2 className="text-xl font-bold mb-2 tracking-wide">
              {t.shareCardTitle ?? 'Share card'}
            </h2>
            <p className={`text-xs mb-6 ${subtleText}`}>
              {t.shareCardSubtitle ??
                'Privacy-on by default. Body content stays hidden unless you opt in.'}
            </p>

            <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
              {/* Preview viewport — clipped to the scaled card size
                  so the offscreen 1080 × 1920 source is hidden by
                  overflow rather than blowing up the modal. */}
              <div
                style={{
                  width: `${PREVIEW_WIDTH}px`,
                  height: `${previewHeight}px`,
                }}
                className="rounded-lg overflow-hidden border border-cyan-500/20 mx-auto"
              >
                <ShareCard
                  ref={cardRef}
                  entry={entry}
                  options={options}
                  displayIdentity={displayIdentity}
                  labels={labels}
                  scale={previewScale}
                />
              </div>

              <div className="flex flex-col gap-4">
                <fieldset className="flex flex-col gap-3 m-0 p-0 border-0">
                  <legend className={`text-[10px] uppercase tracking-widest ${subtleText} mb-2`}>
                    {t.shareCardPrivacy ?? 'Privacy options'}
                  </legend>
                  <ShareCardToggle
                    icon={options.showBody ? Eye : EyeOff}
                    label={t.shareCardShowBody ?? 'Show body content'}
                    description={
                      t.shareCardShowBodyHint ??
                      'Off by default. Be careful — this reveals the entry text in the exported PNG.'
                    }
                    checked={options.showBody}
                    onChange={(v) => updateOption('showBody', v)}
                    subtleText={subtleText}
                  />
                  <ShareCardToggle
                    icon={Tag}
                    label={t.shareCardShowTags ?? 'Show tags'}
                    description={
                      t.shareCardShowTagsHint ?? 'Tag chips below the title. Usually safe to share.'
                    }
                    checked={options.showTags}
                    onChange={(v) => updateOption('showTags', v)}
                    subtleText={subtleText}
                  />
                  <ShareCardToggle
                    icon={ImageIcon}
                    label={t.shareCardShowAttachment ?? 'Show attachment badge'}
                    description={
                      t.shareCardShowAttachmentHint ??
                      'Adds a "📎 attachment" badge — does not include the file itself.'
                    }
                    checked={options.showAttachmentBadge}
                    onChange={(v) => updateOption('showAttachmentBadge', v)}
                    subtleText={subtleText}
                  />
                </fieldset>

                <ShareCardThemeToggle
                  current={options.theme}
                  onChange={(v) => updateOption('theme', v)}
                  t={t}
                  subtleText={subtleText}
                />

                <ShareCardStatusBanner status={status} message={errorMessage} t={t} />

                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={resetToDefaults}
                    className={`text-[11px] underline-offset-4 hover:underline ${subtleText}`}
                  >
                    {t.shareCardResetDefaults ?? 'Reset to privacy defaults'}
                  </button>
                  <CyberButton
                    onClick={handleExport}
                    theme={theme}
                    disabled={status === 'rendering'}
                    aria-label={t.shareCardSavePng ?? 'Save PNG'}
                  >
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                    {status === 'rendering'
                      ? (t.shareCardRendering ?? 'Rendering…')
                      : (t.shareCardSavePng ?? 'Save PNG')}
                  </CyberButton>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ShareCardToggleProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  subtleText: string;
}

const ShareCardToggle: React.FC<ShareCardToggleProps> = ({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  subtleText,
}) => {
  const inputId = useId();
  return (
    <div className="flex items-start gap-3 group">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1.5 w-4 h-4 accent-vector-cyan-neon cursor-pointer"
      />
      <label htmlFor={inputId} className="flex-1 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Icon className="w-4 h-4 opacity-80" aria-hidden="true" />
          {label}
        </span>
        <span className={`block text-[11px] mt-1 leading-relaxed ${subtleText}`}>
          {description}
        </span>
      </label>
    </div>
  );
};

const ShareCardThemeToggle: React.FC<{
  current: 'dark' | 'light';
  onChange: (next: 'dark' | 'light') => void;
  t: TranslationDictionary;
  subtleText: string;
}> = ({ current, onChange, t, subtleText }) => (
  <div role="radiogroup" aria-label={t.shareCardTheme ?? 'Card theme'} className="mt-2">
    <div className={`text-[10px] uppercase tracking-widest mb-2 ${subtleText}`}>
      {t.shareCardTheme ?? 'Card theme'}
    </div>
    <div className="flex gap-2">
      {(['dark', 'light'] as const).map((value) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-md border transition-colors ${
              selected
                ? 'bg-vector-cyan-neon/15 border-vector-cyan-neon/50 text-vector-cyan-neon'
                : 'border-slate-500/30 hover:border-vector-cyan-neon/40'
            }`}
          >
            {value}
          </button>
        );
      })}
    </div>
  </div>
);

const ShareCardStatusBanner: React.FC<{
  status: ShareCardExportStatus;
  message: string | null;
  t: TranslationDictionary;
}> = ({ status, message, t }) => {
  if (status === 'idle') return null;
  if (status === 'rendering') {
    return (
      <p className="text-[11px] text-cyan-400 font-mono uppercase tracking-widest animate-pulse">
        {t.shareCardRendering ?? 'Rendering…'}
      </p>
    );
  }
  if (status === 'success') {
    return (
      <p className="text-[11px] text-green-400 font-mono uppercase tracking-widest">
        {t.shareCardSaved ?? 'Saved.'}
      </p>
    );
  }
  return (
    <p className="text-[11px] text-rose-400 font-mono">
      {t.shareCardExportError ?? 'Export failed:'} {message ?? '?'}
    </p>
  );
};
