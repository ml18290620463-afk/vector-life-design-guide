import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Pencil, Plus, Shield, Star, Tag, Trash2, X } from 'lucide-react';
import type {
  Language,
  PatternPrincipleLink,
  PatternPrincipleLinkStatus,
  PatternPrincipleRelation,
  Principle,
  PrincipleApplication,
  Theme,
} from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { EVENT_TAGS } from '../features/now/constants/tags';
import { PastActionDialog } from './PastActionDialog';
import { CyberButton } from './CyberButton';
import type { PracticeReflectionContext } from '../types/future';

function PrincipleEditorSurface({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return open ? (
    <dialog
      ref={ref}
      className="principle-editor-screen"
      aria-label="书写原则"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  ) : (
    <>{children}</>
  );
}

interface ArchivePrinciplesViewProps {
  theme: Theme;
  language?: Language;
  t: TranslationDictionary;
  principles: Principle[];
  onAddPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
    application?: PrincipleApplication,
    sourcePatternIds?: string[],
    tags?: string[],
  ) => void | Promise<void>;
  onDeletePrinciple: (id: string) => void | Promise<void>;
  onUpdatePrinciple: (principle: Principle) => void | Promise<void>;
  patterns?: Array<{ id: string; statement: string; status?: string }>;
  patternPrincipleLinks?: PatternPrincipleLink[];
  onAddPatternPrincipleLink?: (
    patternId: string,
    principleId: string,
    relation?: PatternPrincipleRelation,
    status?: PatternPrincipleLinkStatus,
  ) => void;
  onRemovePatternPrincipleLink?: (id: string) => void;
  requestedPatternId?: string | null;
  onRequestedPatternHandled?: () => void;
  displayFirst?: boolean;
  onManagementChange?: (open: boolean) => void;
  practiceReflectionContext?: PracticeReflectionContext | null;
  onPracticeReflectionContextDismiss?: () => void;
  /** A short, session-only explanation after the user removes source entries. */
  emptyReason?: 'source-deletion';
}

const PRINCIPLE_MAX_LENGTH = 30;
const UNCATEGORIZED_SECTION = '__uncategorized__';
const ALL_SECTION = '__all__';
type PrincipleSection = 'extract' | typeof ALL_SECTION | string;

/**
 * Principles tab of ArchiveVault: an "add new principle" form (text +
 * target year + show-on-home toggle) followed by the persisted list
 * grouped by year, descending. Each principle row exposes a
 * show-on-home toggle and a delete affordance.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchivePrinciplesView: React.FC<ArchivePrinciplesViewProps> = ({
  theme,
  language = 'zh',
  t,
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  patterns = [],
  requestedPatternId,
  onRequestedPatternHandled,
  displayFirst = false,
  onManagementChange,
  practiceReflectionContext,
  onPracticeReflectionContextDismiss,
  emptyReason,
}) => {
  const [newPrincipleText, setNewPrincipleText] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showOnHome, setShowOnHome] = useState(true);
  const [selectedPrincipleTag, setSelectedPrincipleTag] = useState('');
  const [selectedSection, setSelectedSection] = useState<PrincipleSection>(
    displayFirst ? ALL_SECTION : 'extract',
  );
  const [managementOpen, setManagementOpen] = useState(!displayFirst);
  const [editingPrincipleId, setEditingPrincipleId] = useState<string | null>(null);
  const [editingPrincipleText, setEditingPrincipleText] = useState('');
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const managementButtonRef = useRef<HTMLButtonElement>(null);
  const wasManagementOpenRef = useRef(managementOpen);
  const pendingNavigation = useRef<HTMLElement | null>(null);
  const allowNavigation = useRef(false);
  const dirty = Boolean(
    newPrincipleText.trim() ||
    (editingPrincipleId &&
      editingPrincipleText !== principles.find((p) => p.id === editingPrincipleId)?.text),
  );
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const intercept = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        'nav button, nav a, [role="tab"]',
      );
      if (!target || allowNavigation.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      pendingNavigation.current = target;
      setConfirmExit(true);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', intercept, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', intercept, true);
    };
  }, [dirty, busy]);
  const runMutation = async (action: () => void | Promise<void>, done?: () => void) => {
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      await action();
      done?.();
    } catch {
      setSaveError(
        language === 'zh'
          ? '操作失败，请重试；输入已保留。'
          : 'Could not save. Your input is retained. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!displayFirst || !managementOpen) return;
    const frame = requestAnimationFrame(() => editorTextareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [displayFirst, managementOpen, editingPrincipleId]);

  useEffect(() => {
    const shouldRestoreFocus = displayFirst && wasManagementOpenRef.current && !managementOpen;
    wasManagementOpenRef.current = managementOpen;
    if (!shouldRestoreFocus) return;
    const frame = requestAnimationFrame(() => managementButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [displayFirst, managementOpen]);

  const closeManagement = () => {
    setManagementOpen(false);
    setEditingPrincipleId(null);
    setEditingPrincipleText('');
    setNewPrincipleText('');
    setSelectedPrincipleTag('');
    setSelectedPatternIds([]);
    setShowPatternPicker(false);
    onManagementChange?.(false);
  };

  const requestCloseManagement = () => {
    if (busy) return;
    if (newPrincipleText.trim() || editingPrincipleId) {
      pendingNavigation.current = null;
      setConfirmExit(true);
      return;
    }
    closeManagement();
  };

  const editingPrinciple = editingPrincipleId
    ? principles.find((principle) => principle.id === editingPrincipleId)
    : undefined;
  const editorText = editingPrinciple ? editingPrincipleText : newPrincipleText;
  const editorOverLimit = editorText.length >= PRINCIPLE_MAX_LENGTH;
  const selectablePatterns = useMemo(
    () => patterns.filter((pattern) => pattern.status !== 'pending'),
    [patterns],
  );

  useEffect(() => {
    if (!requestedPatternId) return;
    if (!selectablePatterns.some((pattern) => pattern.id === requestedPatternId)) return;

    if (displayFirst) {
      onRequestedPatternHandled?.();
      return;
    }

    setSelectedSection('extract');
    setManagementOpen(true);
    onManagementChange?.(true);
    setSelectedPatternIds([requestedPatternId]);
    setShowPatternPicker(true);
    onRequestedPatternHandled?.();
  }, [
    requestedPatternId,
    selectablePatterns,
    displayFirst,
    onRequestedPatternHandled,
    onManagementChange,
  ]);
  const allTags = Array.from(
    new Set([...EVENT_TAGS, ...principles.flatMap((principle) => principle.tags ?? [])]),
  ).sort((a, b) => {
    const aIndex = EVENT_TAGS.indexOf(a);
    const bIndex = EVENT_TAGS.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.localeCompare(b, language);
  });
  const visiblePrinciples = principles.filter((principle) =>
    selectedSection === ALL_SECTION
      ? true
      : selectedSection === UNCATEGORIZED_SECTION
        ? !principle.tags?.length
        : principle.tags?.includes(selectedSection),
  );
  const years = Array.from(new Set(visiblePrinciples.map((p) => p.year))).sort((a, b) => b - a);

  return (
    <PrincipleEditorSurface
      open={displayFirst && managementOpen}
      onClose={requestCloseManagement}
    >
      <div
        className={`mobile-principles-view animate-in fade-in slide-in-from-bottom-4 duration-700 ${displayFirst ? 'mobile-principles-view--result-first' : ''}`}
      >
        {saveError && <p role="alert">{saveError}</p>}
        {confirmExit && (
          <PastActionDialog
            title={language === 'zh' ? '放弃未保存的修改？' : 'Discard unsaved changes?'}
            onCancel={() => {
              pendingNavigation.current = null;
              setConfirmExit(false);
            }}
          >
            <div className="past-action-dialog__actions">
              <button
                data-cancel
                onClick={() => {
                  pendingNavigation.current = null;
                  setConfirmExit(false);
                }}
              >
                {language === 'zh' ? '继续编辑' : 'Keep editing'}
              </button>
              <button
                onClick={() => {
                  setNewPrincipleText('');
                  setSelectedPrincipleTag('');
                  setSelectedYear(new Date().getFullYear());
                  setShowOnHome(true);
                  setConfirmExit(false);
                  closeManagement();
                  const target = pendingNavigation.current;
                  pendingNavigation.current = null;
                  if (target) {
                    allowNavigation.current = true;
                    target.click();
                    allowNavigation.current = false;
                  }
                }}
              >
                {language === 'zh' ? '放弃修改' : 'Discard'}
              </button>
            </div>
          </PastActionDialog>
        )}
        {deletingId && (
          <PastActionDialog
            title={language === 'zh' ? '删除这条原则？' : 'Delete this principle?'}
            busy={busy}
            onCancel={() => setDeletingId(null)}
          >
            <p>{principles.find((p) => p.id === deletingId)?.text}</p>
            {saveError && <p role="alert">{saveError}</p>}
            <div className="past-action-dialog__actions">
              <button data-cancel disabled={busy} onClick={() => setDeletingId(null)}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void runMutation(
                    () => onDeletePrinciple(deletingId),
                    () => setDeletingId(null),
                  )
                }
              >
                {language === 'zh' ? '确认删除' : 'Delete'}
              </button>
            </div>
          </PastActionDialog>
        )}
        <h2 className="sr-only">{t.principlesLibrary}</h2>

        {displayFirst && (
          <div className="mobile-principles-view__result-header">
            <div>
              <strong>{language === 'zh' ? '我的原则' : 'My principles'}</strong>
              <small>{principles.length}</small>
            </div>
            <button
              type="button"
              ref={managementButtonRef}
              className="mobile-principles-view__manage-button"
              aria-expanded={managementOpen}
              onClick={() => {
                if (busy) return;
                if (
                  managementOpen &&
                  (newPrincipleText.trim() ||
                    (editingPrincipleId &&
                      editingPrincipleText !==
                        principles.find((p) => p.id === editingPrincipleId)?.text))
                ) {
                  pendingNavigation.current = null;
                  setConfirmExit(true);
                  return;
                }
                const next = !managementOpen;
                setManagementOpen(next);
                setSelectedSection(displayFirst ? ALL_SECTION : next ? 'extract' : ALL_SECTION);
                setEditingPrincipleId(null);
                onManagementChange?.(next);
              }}
            >
              {managementOpen ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
              {language === 'zh'
                ? managementOpen
                  ? '完成'
                  : '写原则'
                : managementOpen
                  ? 'Done'
                  : 'Write principles'}
            </button>
          </div>
        )}

        {displayFirst && practiceReflectionContext && !managementOpen && (
          <aside className="practice-reflection-context" aria-label={language === 'zh' ? '行动沉淀提示' : 'Action reflection prompt'}>
            <button
              type="button"
              className="practice-reflection-context__dismiss"
              aria-label={language === 'zh' ? '关闭行动提示' : 'Dismiss action prompt'}
              onClick={onPracticeReflectionContextDismiss}
            >
              <X aria-hidden="true" />
            </button>
            <small>{language === 'zh' ? '刚刚完成的行动' : 'Action just completed'}</small>
            <strong>{practiceReflectionContext.actionTitle}</strong>
            {practiceReflectionContext.result && <p>{practiceReflectionContext.result}</p>}
            <span>
              {language === 'zh'
                ? '什么值得留给下一次选择？'
                : 'What is worth carrying into your next choice?'}
            </span>
          </aside>
        )}

        {!displayFirst && (
          <nav
            className="principle-section-nav"
            aria-label={language === 'zh' ? '原则分区' : 'Principle sections'}
          >
            <button
              type="button"
              aria-current={selectedSection === 'extract' ? 'page' : undefined}
              onClick={() => setSelectedSection('extract')}
            >
              {language === 'zh' ? '萃取' : 'Extract'}
            </button>
            {!displayFirst &&
              allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-current={selectedSection === tag ? 'page' : undefined}
                  onClick={() => setSelectedSection(tag)}
                >
                  {tag}
                </button>
              ))}
            {!displayFirst && (
              <button
                type="button"
                aria-current={selectedSection === UNCATEGORIZED_SECTION ? 'page' : undefined}
                onClick={() => setSelectedSection(UNCATEGORIZED_SECTION)}
              >
                {language === 'zh' ? '未分类' : 'Uncategorized'}
              </button>
            )}
          </nav>
        )}

        {/* Extraction is deliberately isolated from the principle library. */}
        {managementOpen && (displayFirst || selectedSection === 'extract') && (
          <div
            className={`mobile-principles-view__composer border p-6 rounded-sm mb-12 relative overflow-hidden group ${theme === 'light' ? 'bg-white/60 border-vector-cyan-brand/5 shadow-sm' : 'bg-green-950/10 border-green-900/50'}`}
          >
            <div className="mobile-principles-view__composer-content flex flex-col gap-4">
              {displayFirst && (
                <button
                  type="button"
                  className="principle-editor-screen__back"
                  aria-label={language === 'zh' ? '返回' : 'Back'}
                  disabled={busy}
                  onClick={requestCloseManagement}
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
              )}
              <div>
                <div>
                  <label
                    htmlFor="archive-principle-text"
                    className="mobile-principles-view__reflection-hint"
                  >
                    {language === 'zh'
                      ? '让经历成为理解，让理解照亮下一次选择。'
                      : 'Let experience become understanding, and understanding illuminate your next choice.'}
                  </label>
                  <textarea
                    disabled={busy}
                    maxLength={PRINCIPLE_MAX_LENGTH}
                    id="archive-principle-text"
                    ref={editorTextareaRef}
                    autoFocus
                    value={editorText}
                    onChange={(e) => {
                      const nextText = e.target.value.slice(0, PRINCIPLE_MAX_LENGTH);
                      if (editingPrinciple) setEditingPrincipleText(nextText);
                      else setNewPrincipleText(nextText);
                    }}
                    aria-label={
                      editingPrinciple
                        ? language === 'zh'
                          ? `编辑原则：${editingPrinciple.text}`
                          : `Edit principle: ${editingPrinciple.text}`
                        : t.addPrinciple
                    }
                    className={`mobile-principles-view__textarea w-full border p-3 text-sm focus:border-vector-cyan-brand outline-none min-h-[80px] resize-none font-mono ${theme === 'light' ? 'bg-vector-cyan-brand/2 border-vector-cyan-brand/5 text-vector-ink-strong placeholder:text-vector-slate-soft/30' : 'bg-black border-white/5 text-cyan-400 placeholder:text-cyan-900'} ${editorOverLimit ? 'border-vector-magenta/50' : ''}`}
                  />
                  <div className="flex justify-between mt-1 px-1">
                    <span
                      className={`text-[9px] font-mono ${editorOverLimit ? 'text-vector-magenta neon-glow-alert' : theme === 'light' ? 'text-vector-slate-soft/40' : 'text-slate-600'}`}
                    >
                      {t.charLimit.replace('{count}', editorText.length.toString())}
                    </span>
                    {editorOverLimit && (
                      <span
                        role="alert"
                        className="text-[9px] font-mono text-vector-magenta uppercase tracking-tighter neon-glow-alert"
                      >
                        {t.charLimitWarning}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(selectedYear < 1900 || selectedYear > 2100) && (
                <p role="alert">
                  {language === 'zh' ? '年份请填写 1900—2100。' : 'Enter a year from 1900 to 2100.'}
                </p>
              )}
              <div className="principle-meta-row">
                <div className="principle-meta-field">
                  <label
                    htmlFor="archive-principle-year"
                    className={theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}
                  >
                    {t.targetYear}
                  </label>
                  <input
                    disabled={busy}
                    id="archive-principle-year"
                    type="number"
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())
                    }
                    className={`border p-2 text-xs outline-none focus:border-vector-cyan-brand w-full ${theme === 'light' ? 'bg-vector-cyan-brand/2 border-vector-cyan-brand/5 text-vector-slate-mid' : 'bg-black border-green-900/50 text-green-500'}`}
                    min="1900"
                    max="2100"
                  />
                </div>
                <div className="principle-meta-field">
                  <label
                    htmlFor="archive-principle-tag"
                    className={theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}
                  >
                    <Tag aria-hidden="true" />
                    {language === 'zh' ? '标签（可选）' : 'Tag (optional)'}
                  </label>
                  <select
                    disabled={busy}
                    id="archive-principle-tag"
                    value={selectedPrincipleTag}
                    onChange={(event) => setSelectedPrincipleTag(event.target.value)}
                    className={theme === 'light' ? 'is-light' : ''}
                  >
                    <option value="">{language === 'zh' ? '不选择' : 'No tag'}</option>
                    {EVENT_TAGS.filter((tag) => tag !== '自定义锚点').map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!displayFirst && selectablePatterns.length > 0 && (
                <div className="principle-pattern-picker">
                  <button
                    type="button"
                    className="principle-pattern-picker__toggle"
                    aria-expanded={showPatternPicker}
                    onClick={() => setShowPatternPicker((current) => !current)}
                  >
                    <span>
                      {language === 'zh' ? '关联模式（可选）' : 'Link pattern (optional)'}
                    </span>
                    <small>
                      {selectedPatternIds.length > 0
                        ? language === 'zh'
                          ? `${selectedPatternIds.length}/3 已选`
                          : `${selectedPatternIds.length}/3 selected`
                        : language === 'zh'
                          ? '不选择'
                          : 'None'}
                    </small>
                  </button>
                  {showPatternPicker && (
                    <div
                      className="principle-pattern-picker__list"
                      role="group"
                      aria-label={language === 'zh' ? '选择关联模式' : 'Select linked patterns'}
                    >
                      {selectablePatterns.slice(0, 8).map((pattern) => {
                        const checked = selectedPatternIds.includes(pattern.id);
                        const disabled = !checked && selectedPatternIds.length >= 3;
                        return (
                          <label
                            key={pattern.id}
                            className="principle-pattern-picker__option"
                            data-selected={checked || undefined}
                            data-disabled={disabled || undefined}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => {
                                setSelectedPatternIds((current) =>
                                  current.includes(pattern.id)
                                    ? current.filter((id) => id !== pattern.id)
                                    : current.length >= 3
                                      ? current
                                      : [...current, pattern.id],
                                );
                              }}
                            />
                            <span>{pattern.statement}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mobile-principles-view__home-toggle flex items-center gap-3 px-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={showOnHome}
                  aria-label={t.showOnHome}
                  disabled={busy}
                  onClick={() => setShowOnHome(!showOnHome)}
                  className={`w-4 h-4 border flex items-center justify-center transition-all ${showOnHome ? (theme === 'light' ? 'bg-vector-cyan-brand border-vector-cyan-brand' : 'bg-green-500 border-green-500') : theme === 'light' ? 'border-vector-cyan-brand/10' : 'border-green-900'}`}
                >
                  {showOnHome && (
                    <div className={`w-2 h-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`} />
                  )}
                </button>
                <span
                  className={`text-[10px] uppercase tracking-widest ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-700'}`}
                >
                  {t.showOnHome}
                </span>
              </div>

              {displayFirst && editingPrinciple && (
                <button
                  type="button"
                  disabled={busy}
                  className="mobile-principles-view__delete-button"
                  onClick={() => {
                    setSaveError('');
                    setDeletingId(editingPrinciple.id);
                    closeManagement();
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  {t.deletePrinciple}
                </button>
              )}

              <CyberButton
                onClick={() => {
                  if (editorText.trim()) {
                    void runMutation(
                      () => {
                        if (editingPrinciple) {
                          return onUpdatePrinciple({
                            ...editingPrinciple,
                            text: editorText.trim(),
                            year: selectedYear,
                            showOnHome,
                            tags: selectedPrincipleTag ? [selectedPrincipleTag] : [],
                          });
                        }
                        return onAddPrinciple(
                          editorText.trim(),
                          selectedYear,
                          showOnHome,
                          undefined,
                          undefined,
                          !displayFirst && selectedPatternIds.length
                            ? selectedPatternIds
                            : undefined,
                          selectedPrincipleTag ? [selectedPrincipleTag] : [],
                        );
                      },
                      () => {
                        setNewPrincipleText('');
                        setEditingPrincipleId(null);
                        setEditingPrincipleText('');
                        setSelectedPrincipleTag('');
                        setSelectedPatternIds([]);
                        setShowPatternPicker(false);
                        if (displayFirst) {
                          setManagementOpen(false);
                          onManagementChange?.(false);
                        }
                      },
                    );
                  }
                }}
                disabled={busy || !editorText.trim() || selectedYear < 1900 || selectedYear > 2100}
                className="w-full"
                theme={theme}
              >
                {displayFirst ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Plus className="w-4 h-4" aria-hidden="true" />
                )}{' '}
                {displayFirst ? (language === 'zh' ? '确定' : 'Save') : t.addPrinciple}
              </CyberButton>
            </div>
          </div>
        )}

        {/* Each tag owns one focused display page. */}
        {(!displayFirst || !managementOpen) &&
          (displayFirst || selectedSection !== 'extract') &&
          (visiblePrinciples.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center py-12 border border-dashed rounded-lg ${theme === 'light' ? 'border-vector-cyan-brand/10 bg-white/40' : 'border-green-900/30'}`}
            >
              <Shield
                className={`w-12 h-12 mb-4 opacity-30 ${theme === 'light' ? 'text-vector-slate-soft/20' : 'text-green-900'}`}
              />
              <p
                className={`text-sm ${theme === 'light' ? 'text-vector-slate-soft' : 'text-green-800'}`}
              >
                {emptyReason === 'source-deletion'
                  ? language === 'zh'
                    ? '关联经历已删除，原有原则已同步清理。新的理解会在回看中慢慢沉淀。'
                    : 'Related entries were deleted, so the related principles were also cleared. New understanding can be distilled through review.'
                  : t.noPrinciples}
              </p>
            </div>
          ) : (
            <div className="mobile-principles-view__list space-y-6">
              {years.map((year) => (
                <div key={year} className="mobile-principles-view__year space-y-4">
                  {!displayFirst && (
                    <div className="mobile-principles-view__year-label flex items-center gap-4">
                      <span
                        className={`text-[10px] font-bold tracking-[0.3em] uppercase ${theme === 'light' ? 'text-vector-slate-soft/40' : 'text-green-600'}`}
                      >
                        {t.formedThrough.replace('{year}', year.toString())}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {visiblePrinciples
                      .filter((p) => p.year === year)
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((principle, idx) => {
                        return (
                          <motion.div
                            key={principle.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`mobile-principle-card group relative border p-5 transition-all overflow-hidden ${theme === 'light' ? 'bg-white/60 border-vector-cyan-brand/5 hover:border-vector-cyan-brand/30 hover:bg-white' : 'bg-green-950/5 border-green-900/30 hover:border-green-500/50 hover:bg-green-950/10'}`}
                          >
                            {!displayFirst && (
                              <>
                                <div
                                  className={`absolute inset-[2px] border pointer-events-none transition-all duration-500 opacity-20 ${theme === 'light' ? 'border-slate-200 group-hover:border-cyan-200' : 'border-green-900/30 group-hover:border-green-500/30'}`}
                                />
                                <motion.div
                                  className="absolute top-0 bottom-0 w-1 pointer-events-none z-10 opacity-0 group-hover:opacity-100 bg-gradient-to-b from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_color-mix(in_srgb,var(--color-cyan-400)_40%,transparent)]"
                                  initial={{ left: '-5%' }}
                                  whileHover={{
                                    left: ['-5%', '105%'],
                                    transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
                                  }}
                                />
                              </>
                            )}
                            <div className="mobile-principle-card__layout flex justify-between items-start gap-4">
                              <div className="mobile-principle-card__content flex gap-4">
                                {!displayFirst && (
                                  <div
                                    className={`mt-1 w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-vector-cyan-brand' : 'bg-green-500'}`}
                                  />
                                )}
                                <div>
                                  <p
                                    className={`text-sm leading-relaxed tracking-wide ${theme === 'light' ? 'text-vector-slate-mid' : 'text-green-300'}`}
                                  >
                                    {principle.text}
                                  </p>
                                  {!displayFirst && principle.application && (
                                    <dl className="principle-application">
                                      <div>
                                        <dt>{language === 'zh' ? '当' : 'When'}</dt>
                                        <dd>{principle.application.trigger}</dd>
                                      </div>
                                      <div>
                                        <dt>{language === 'zh' ? '就' : 'Do'}</dt>
                                        <dd>{principle.application.action}</dd>
                                      </div>
                                    </dl>
                                  )}
                                </div>
                              </div>
                              {(!displayFirst || !managementOpen) && (
                                <div className="mobile-principle-card__actions flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (displayFirst) {
                                        setNewPrincipleText('');
                                        setEditingPrincipleId(principle.id);
                                        setEditingPrincipleText(principle.text);
                                        setSelectedYear(principle.year);
                                        setSelectedPrincipleTag(principle.tags?.[0] ?? '');
                                        setShowOnHome(principle.showOnHome);
                                        setManagementOpen(true);
                                        onManagementChange?.(true);
                                        return;
                                      }
                                      setEditingPrincipleId(principle.id);
                                      setEditingPrincipleText(principle.text);
                                    }}
                                    aria-label={
                                      language === 'zh'
                                        ? `编辑原则：${principle.text}`
                                        : `Edit principle: ${principle.text}`
                                    }
                                    title={language === 'zh' ? '编辑原则' : 'Edit principle'}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void runMutation(() =>
                                        onUpdatePrinciple({
                                          ...principle,
                                          showOnHome: !principle.showOnHome,
                                        }),
                                      )
                                    }
                                    disabled={busy}
                                    aria-label={t.showOnHome}
                                    aria-pressed={principle.showOnHome}
                                    className={`p-1 rounded border transition-all ${principle.showOnHome ? (theme === 'light' ? 'bg-vector-cyan-brand/5 border-vector-cyan-brand text-vector-cyan-brand' : 'bg-green-500/10 border-green-500/50 text-green-400') : theme === 'light' ? 'bg-white border-vector-cyan-brand/10 text-vector-slate-soft/40 hover:border-vector-cyan-brand' : 'bg-black border-green-900 text-green-900 hover:border-green-700'}`}
                                    title={t.showOnHome}
                                  >
                                    <Star
                                      className={`w-3 h-3 ${principle.showOnHome ? (theme === 'light' ? 'fill-vector-cyan-brand/20' : 'fill-green-400/20') : ''}`}
                                    />
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </PrincipleEditorSurface>
  );
};
