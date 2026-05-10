import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Save,
  Hash,
  Wifi,
  Activity,
  Heart,
  Coins,
  Layers,
  AlertTriangle,
  Briefcase,
  Users,
  TrendingUp,
  Palmtree,
  Target,
  Anchor,
  Edit2,
  Clock,
} from 'lucide-react';
import { DiaryEntry, Language, Theme } from '../types';
import { CyberButton } from './CyberButton';
import { TRANSLATIONS } from '../constants';
import { SecurityService } from '../services/securityService';
import { clearEditorDraft, loadEditorDraft, saveEditorDraft } from '../services/editorDraft';
import { useTimeoutManager } from '../hooks/useTimeoutManager';

interface EditorProps {
  language: Language;
  theme?: Theme;
  masterPassword: string | null;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => void;
  onCancel: () => void;
  onGoHome?: () => void;
  existingTitles: string[]; // New prop for validation
  /**
   * Phase 4.5 follow-ups (F4) — pre-seed the editor when opened
   * via a Proactive Recall card. The seed is applied AFTER the
   * draft restore step, but ONLY when each respective field
   * arrives empty (so we never clobber an in-progress draft the
   * user has typed previously). Optional; legacy callers behave
   * unchanged.
   */
  seed?: {
    title?: string;
    content?: string;
    tags?: string;
  } | null;
}

export const Editor: React.FC<EditorProps> = ({
  language,
  theme = 'dark',
  masterPassword,
  onSave,
  onCancel,
  onGoHome,
  existingTitles,
  seed,
}) => {
  const t = TRANSLATIONS[language];
  const { scheduleTimeout } = useTimeoutManager();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [autoSaved, setAutoSaved] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<'encrypt' | 'quota' | 'unknown' | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(''); // Local error state
  const [showConfirmHome, setShowConfirmHome] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Recording guide state
  const [showGuide, setShowGuide] = useState(false);

  // Custom Anchor state
  const [customAnchor, setCustomAnchor] = useState(t.customAnchor);
  const [isEditingAnchor, setIsEditingAnchor] = useState(false);
  const [anchorInput, setAnchorInput] = useState(t.customAnchor);
  const anchorInputRef = useRef<HTMLInputElement>(null);

  // Time Lock state
  const [unlockAt, setUnlockAt] = useState<number>(Date.now());
  const [customUnlockDate, setCustomUnlockDate] = useState<string>('');
  const [showTimeOptions, setShowTimeOptions] = useState(false);

  // System Presets - Updated categories with descriptions
  const SYSTEM_TAGS = [
    { label: t.career, desc: t.careerDesc, icon: Briefcase, color: 'text-blue-200/80' },
    { label: t.finance, desc: t.financeDesc, icon: Coins, color: 'text-yellow-200/80' },
    { label: t.health, desc: t.healthDesc, icon: Activity, color: 'text-emerald-200/80' },
    { label: t.social, desc: t.socialDesc, icon: Users, color: 'text-indigo-200/80' },
    { label: t.family, desc: t.familyDesc, icon: Heart, color: 'text-rose-200/80' },
    { label: t.growth, desc: t.growthDesc, icon: TrendingUp, color: 'text-cyan-200/80' },
    { label: t.leisure, desc: t.leisureDesc, icon: Palmtree, color: 'text-orange-200/80' },
    { label: t.purpose, desc: t.purposeDesc, icon: Target, color: 'text-violet-200/80' },
    {
      label: customAnchor,
      desc: t.customAnchorDesc,
      icon: Anchor,
      color: 'text-slate-200/80',
      isCustom: true,
    },
  ];

  // 1. Restore Draft on Mount.
  // Phase 4.5 follow-ups (F4) — when a `seed` prop is provided
  // (e.g. ProactiveRecallCard opened the composer), apply each
  // seed field ONLY when the corresponding draft field is empty.
  // This way:
  //   - First-time recall click → empty draft → seed wins.
  //   - Recall click while a draft already has content → user's
  //     draft is preserved verbatim; seed is silently dropped.
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await loadEditorDraft(masterPassword);
      setTitle(draft.title || seed?.title || '');
      setContent(draft.content || seed?.content || '');
      setTags(draft.tags || seed?.tags || '');
    };
    loadDraft();
    // The seed is treated as a one-shot snapshot at mount time;
    // re-running on seed identity change would clobber the user's
    // typing mid-session. Lint disable kept local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterPassword]);

  // 2. Auto-save Draft on Change
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await saveEditorDraft({ title, content, tags }, masterPassword);

      if (result.saved) {
        setDraftSaveError(null);
        if (title || content || tags) {
          setAutoSaved(true);
          scheduleTimeout(() => setAutoSaved(false), 2000);
        }
      } else {
        setAutoSaved(false);
        setDraftSaveError(result.reason ?? 'unknown');
      }
    }, 1000); // Debounce save every 1s

    return () => clearTimeout(timer);
  }, [title, content, tags, masterPassword, scheduleTimeout]);

  // Clear error when user types in the title field. We intentionally omit
  // `error` to avoid an immediate self-clearing loop.
  useEffect(() => {
    if (error) setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Helper to toggle system tags
  const toggleSystemTag = (tagLabel: string) => {
    const currentTags = tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    let newTags;

    if (currentTags.includes(tagLabel)) {
      // Remove tag
      newTags = currentTags.filter((t) => t !== tagLabel);
    } else {
      // Add tag
      newTags = [...currentTags, tagLabel];
    }
    setTags(newTags.join(', '));
  };

  const handleAnchorConfirm = () => {
    if (anchorInput.trim() && anchorInput !== customAnchor) {
      const currentTags = tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (currentTags.includes(customAnchor)) {
        const newTags = currentTags.map((t) => (t === customAnchor ? anchorInput.trim() : t));
        setTags(newTags.join(', '));
      }
      setCustomAnchor(anchorInput.trim());
    }
    setIsEditingAnchor(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    // VALIDATION: Check for duplicate titles
    if (existingTitles.some((t) => t.toLowerCase() === title.trim().toLowerCase())) {
      setError(t.duplicateTitle);
      return;
    }

    setIsSaving(true);

    try {
      let finalContent = content;
      let isEncrypted = false;

      if (masterPassword) {
        finalContent = await SecurityService.encrypt(content, masterPassword);
        isEncrypted = true;
      }

      // Simulate write delay for effect
      scheduleTimeout(() => {
        onSave({
          title: title.trim(),
          content: finalContent,
          isEncrypted,
          tags: tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          unlockAt: unlockAt > Date.now() + 1000 ? unlockAt : undefined,
        });

        // Clear draft
        clearEditorDraft();
      }, 800);
    } catch (err) {
      console.error('Encryption failed', err);
      setError(t.failed);
      setIsSaving(false);
    }
  };

  const isValid = title.trim() && content.trim();

  // Determine which system tags are currently active
  const currentTagList = tags.split(/[,，]/).map((t) => t.trim());

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col relative z-10"
    >
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <CyberButton variant="ghost" onClick={onCancel} theme={theme}>
            <ArrowLeft className="w-4 h-4" /> {t.abortProgram}
          </CyberButton>
        </div>
        <div className="flex items-center gap-4">
          {autoSaved && !isSaving && !error && !draftSaveError && (
            <span
              className={`text-xs font-mono flex items-center gap-1 animate-pulse ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-600'}`}
            >
              <Wifi className="w-3 h-3" /> {t.dataCached}
            </span>
          )}
          {draftSaveError && (
            <span
              role="alert"
              className="text-xs font-mono flex items-center gap-1 text-rose-500 drop-shadow-glow-rose"
            >
              <AlertTriangle className="w-3 h-3" />
              {draftSaveError === 'quota'
                ? (t.draftSaveQuota ?? 'Draft cache full; recent edits not stored.')
                : draftSaveError === 'encrypt'
                  ? (t.draftSaveEncrypt ?? 'Draft encryption failed; clear cache and retry.')
                  : (t.draftSaveFailed ?? 'Draft autosave failed; copy your text to be safe.')}
            </span>
          )}
          <h2
            className={`text-2xl font-bold tracking-widest ${theme === 'light' ? 'text-slate-900' : 'text-cyan-500'}`}
          >
            {t.engraving}
          </h2>
        </div>
      </div>

      <div
        className={`flex-1 border p-8 backdrop-blur-md flex flex-col gap-6 relative transition-all duration-500 ${error ? 'border-rose-500 shadow-glow-rose-mid' : theme === 'light' ? 'border-vector-cyan-brand/10 bg-white/60 shadow-lg' : 'border-cyan-500/30 bg-black/40 shadow-xl'}`}
      >
        {/* Corners */}
        <div
          className={`absolute top-0 left-0 w-4 h-4 border-l-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500'}`}
        ></div>
        <div
          className={`absolute top-0 right-0 w-4 h-4 border-r-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500'}`}
        ></div>
        <div
          className={`absolute bottom-0 left-0 w-4 h-4 border-l-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500'}`}
        ></div>
        <div
          className={`absolute bottom-0 right-0 w-4 h-4 border-r-2 ${theme === 'light' ? 'border-cyan-400' : 'border-cyan-500'}`}
        ></div>

        {/* Title Input */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            {error && (
              <span className="text-xs font-mono text-rose-500 flex items-center gap-1 animate-pulse drop-shadow-glow-rose">
                <AlertTriangle className="w-3 h-3" /> {error}
              </span>
            )}
          </div>
          <input
            data-testid="editor-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`text-3xl font-bold px-2 py-2 focus:outline-none transition-all ${theme === 'light' ? 'bg-transparent text-vector-ink-strong placeholder:text-slate-200' : 'bg-cyan-950/20 text-white placeholder-cyan-900'} ${error ? 'border-b border-rose-500' : ''}`}
            placeholder={t.titlePlaceholder}
            disabled={isSaving}
          />
        </div>

        {/* Content Input */}
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex justify-between items-center">
            <label
              className={`text-xs font-mono uppercase ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
            >
              {t.dataStream}
            </label>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`text-xs font-mono flex items-center gap-1 transition-colors ${showGuide ? (theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400') : theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-cyan-700 hover:text-cyan-500'}`}
            >
              <Layers className="w-3 h-3" /> {t.toggleGuide}
            </button>
          </div>

          <AnimatePresence>
            {showGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`p-4 mb-2 text-sm font-mono flex flex-col gap-2 border ${theme === 'light' ? 'bg-vector-cyan-brand/5 border-vector-cyan-brand/10 text-slate-600' : 'bg-cyan-950/20 border-cyan-900/30 text-cyan-500/80'}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
                    >
                      01
                    </span>{' '}
                    <span>{t.guideEvent}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
                    >
                      02
                    </span>{' '}
                    <span>{t.guideEmotion}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
                    >
                      03
                    </span>{' '}
                    <span>{t.guideJudgment}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold ${theme === 'light' ? 'text-vector-cyan-brand' : 'text-cyan-400'}`}
                    >
                      04
                    </span>{' '}
                    <span>{t.guideDecision}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            data-testid="editor-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`flex-1 bg-transparent border p-4 font-mono text-lg focus:outline-none resize-none min-h-[200px] transition-all ${theme === 'light' ? 'border-slate-100 text-vector-slate-mid focus:border-cyan-200 focus:bg-white/50' : 'border-cyan-900/50 text-cyan-100 focus:border-cyan-500/50 focus:shadow-inset-glow-cyan-mid'}`}
            placeholder={t.contentPlaceholder}
            disabled={isSaving}
          />
        </div>

        {/* Meta Data Section - Restored Multi-dimensional Coordinates */}
        <div className={`grid grid-cols-1 gap-8 pt-6`}>
          {/* 1. Tags Selection */}
          <div className="flex flex-col gap-4">
            <label
              className={`text-xs font-mono uppercase flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
            >
              <Hash className="w-3 h-3" /> {t.tagsLabel}
            </label>

            {/* System Tag Buttons */}
            <div className="flex flex-wrap gap-2">
              {SYSTEM_TAGS.map((sysTag, idx) => {
                const isSelected = tags
                  .split(/[,，]/)
                  .map((t) => t.trim())
                  .includes(sysTag.label);
                const Icon = sysTag.icon;
                return (
                  <button
                    key={sysTag.isCustom ? 'custom-anchor' : sysTag.label}
                    type="button"
                    onClick={() => {
                      if (sysTag.isCustom && isSelected) {
                        setIsEditingAnchor(true);
                      } else {
                        toggleSystemTag(sysTag.label);
                      }
                    }}
                    disabled={isSaving}
                    title={sysTag.desc}
                    className={`relative flex flex-col items-start gap-1 px-3 py-2 border text-xs font-mono uppercase tracking-wider transition-all duration-300 group
                           ${
                             isSelected
                               ? theme === 'light'
                                 ? 'bg-cyan-50 border-cyan-400 text-cyan-700 shadow-glow-cyan-card'
                                 : `bg-black/80 border-cyan-700 text-gray-200`
                               : theme === 'light'
                                 ? 'bg-white/40 border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-300'
                                 : `bg-transparent border-cyan-900/50 text-cyan-700 hover:text-cyan-400 hover:border-cyan-500`
                           }
                         `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`w-3 h-3 ${isSelected ? (theme === 'light' ? 'text-cyan-600' : sysTag.color) : ''}`}
                      />
                      {sysTag.isCustom && isEditingAnchor ? (
                        <input
                          ref={anchorInputRef}
                          autoFocus
                          type="text"
                          value={anchorInput}
                          onChange={(e) => setAnchorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAnchorConfirm();
                            }
                          }}
                          onBlur={handleAnchorConfirm}
                          className="bg-transparent border-b border-cyan-500 focus:outline-none w-24 lowercase"
                        />
                      ) : (
                        <span className="flex items-center gap-2">
                          {sysTag.label}
                          {sysTag.isCustom && isSelected && !isEditingAnchor && (
                            <Edit2 className="w-2 h-2 opacity-30 group-hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] lowercase opacity-0 group-hover:opacity-40 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {sysTag.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Time Lock Selection */}
          <div className="flex flex-col gap-4">
            <label
              className={`text-xs font-mono uppercase flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-cyan-700'}`}
            >
              <Clock className="w-3 h-3" /> {t.setTimeLock}
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setUnlockAt(Date.now());
                  setShowTimeOptions(false);
                }}
                className={`px-3 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all
                      ${
                        unlockAt <= Date.now() + 1000
                          ? theme === 'light'
                            ? 'bg-cyan-50 border-cyan-400 text-cyan-700'
                            : 'bg-cyan-900 border-cyan-500 text-white shadow-glow-cyan-mid'
                          : theme === 'light'
                            ? 'bg-white/40 border-slate-200 text-slate-400'
                            : 'bg-transparent border-cyan-900/50 text-cyan-700'
                      }
                    `}
              >
                {t.immediate}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnlockAt(Date.now() + 60 * 1000);
                  setShowTimeOptions(false);
                }}
                className={`px-3 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all
                      ${
                        Math.abs(unlockAt - (Date.now() + 60 * 1000)) < 10000
                          ? theme === 'light'
                            ? 'bg-cyan-50 border-cyan-400 text-cyan-700'
                            : 'bg-cyan-900 border-cyan-500 text-white shadow-glow-cyan-mid'
                          : theme === 'light'
                            ? 'bg-white/40 border-slate-200 text-slate-400'
                            : 'bg-transparent border-cyan-900/50 text-cyan-700'
                      }
                    `}
              >
                {t.oneMin}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnlockAt(Date.now() + 24 * 60 * 60 * 1000);
                  setShowTimeOptions(false);
                }}
                className={`px-3 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all
                      ${
                        Math.abs(unlockAt - (Date.now() + 24 * 60 * 60 * 1000)) < 10000
                          ? theme === 'light'
                            ? 'bg-cyan-50 border-cyan-400 text-cyan-700'
                            : 'bg-cyan-900 border-cyan-500 text-white shadow-glow-cyan-mid'
                          : theme === 'light'
                            ? 'bg-white/40 border-slate-200 text-slate-400'
                            : 'bg-transparent border-cyan-900/50 text-cyan-700'
                      }
                    `}
              >
                {t.oneDay}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTimeOptions(!showTimeOptions)}
                  className={`px-3 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all flex items-center gap-2
                        ${
                          unlockAt > Date.now() + 25 * 60 * 60 * 1000 ||
                          (unlockAt > Date.now() + 65 * 1000 &&
                            unlockAt < Date.now() + 23 * 60 * 60 * 1000)
                            ? theme === 'light'
                              ? 'bg-cyan-50 border-cyan-400 text-cyan-700'
                              : 'bg-cyan-900 border-cyan-500 text-white shadow-glow-cyan-mid'
                            : theme === 'light'
                              ? 'bg-white/40 border-slate-200 text-slate-400'
                              : 'bg-transparent border-cyan-900/50 text-cyan-700'
                        }
                        `}
                >
                  {t.customDate}{' '}
                  {unlockAt > Date.now() + 25 * 60 * 60 * 1000 &&
                    `[${new Date(unlockAt).toLocaleDateString()}]`}
                </button>

                <AnimatePresence>
                  {showTimeOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={`absolute bottom-full mb-2 left-0 z-50 p-4 border rounded-lg shadow-2xl backdrop-blur-xl ${theme === 'light' ? 'bg-white/90 border-slate-200 shadow-elevation-modal-light' : 'bg-black/90 border-cyan-500/30 shadow-elevation-modal-cyan'}`}
                    >
                      <input
                        type="datetime-local"
                        value={customUnlockDate}
                        onChange={(e) => {
                          setCustomUnlockDate(e.target.value);
                          if (e.target.value) {
                            setUnlockAt(new Date(e.target.value).getTime());
                          }
                        }}
                        className={`bg-transparent border p-2 text-xs font-mono outline-none ${theme === 'light' ? 'text-slate-900 border-slate-200' : 'text-cyan-100 border-cyan-900'}`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {unlockAt > Date.now() && (
              <p
                className={`text-[10px] font-mono italic ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-500'}`}
              >
                锁定至: {new Date(unlockAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <CyberButton
            data-testid="editor-save"
            onClick={handleSave}
            disabled={!isValid || isSaving || !!error}
            theme={theme}
          >
            {isSaving ? (
              <span className="flex items-center gap-2 animate-pulse text-green-500">
                {t.writing}
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" /> {t.engrave}
              </>
            )}
          </CyberButton>
        </div>
      </div>
    </motion.div>
  );
};
