import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import type {
  DiaryEntry,
  Language,
  PatternPrincipleLink,
  PatternPrincipleLinkStatus,
  PatternPrincipleRelation,
  Principle,
  PrincipleApplication,
  Theme,
} from '../../types';
import { PastActionDialog } from '../../components/PastActionDialog';
import { ArchivePrinciplesView } from '../../components/ArchivePrinciplesView';
import { MobilePastTimelineEntry } from './MobilePastTimelineEntry';
import type { PastRepositorySection } from './types';
import {
  readAvatarUnderstandings,
  updateAvatarUnderstandingStatus,
  writeAvatarUnderstanding,
} from '../../services/avatarMemory';
import {
  derivePastPatternEvolution,
  extractPastPatterns,
  isLegacyEventOnlyPattern,
  type PastPatternEvolutionStage,
} from '../../services/pastPatternExtraction';
import type { AvatarUnderstandingVersion } from '../avatar/types';
import { useFuture } from '../../hooks/useFuture';
import { goalProgress } from '../../services/futureRepository';
import type { PracticeReflectionContext } from '../../types/future';

interface PastRepositoryProps {
  archiveMode?: boolean;
  /** Allows a deliberate cross-module handoff, such as an action that is ready to be reflected on. */
  initialSection?: PastRepositorySection;
  practiceReflectionContext?: PracticeReflectionContext | null;
  onPracticeReflectionContextDismiss?: () => void;
  onOpenFutureGoal?: (goalId: string) => void;
  language: Language;
  theme?: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  onAddPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
    application?: PrincipleApplication,
    sourcePatternIds?: string[],
    tags?: string[],
  ) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  patternPrincipleLinks?: PatternPrincipleLink[];
  onAddPatternPrincipleLink?: (
    patternId: string,
    principleId: string,
    relation?: PatternPrincipleRelation,
    status?: PatternPrincipleLinkStatus,
  ) => void;
  onUpdatePatternPrincipleLink?: (link: PatternPrincipleLink) => void;
  onRemovePatternPrincipleLink?: (id: string) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  onDeleteEntries: (ids: string[], retainDerivedKnowledge?: boolean) => Promise<void> | void;
}

const getSafeText = (value: unknown) => (typeof value === 'string' ? value : '');

const getSafeTags = (tags: unknown) =>
  Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];

const getSafeTimestamp = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const getSourceDateLabel = (timestamp: unknown, language: Language) => {
  const safeTimestamp = getSafeTimestamp(timestamp);
  if (!safeTimestamp) return language === 'zh' ? '未标日期' : 'No date';

  return new Date(safeTimestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en');
};

const getPatternDisplayStatement = (statement: unknown, language: Language = 'zh') => {
  if (typeof statement !== 'string') {
    return language === 'zh' ? '这个模式还在整理中。' : 'This pattern is still being organized.';
  }

  const normalized = statement
    .replace(/^在\s*\d+\s*条记录中[，,]\s*/, '')
    .replace(/[，,]\s*已收集\s*\d+\s*条来源。?$/, '。')
    .replace(/\s*已收集\s*\d+\s*条来源。?$/, '')
    .trim();

  return (
    normalized ||
    (language === 'zh' ? '这个模式还在整理中。' : 'This pattern is still being organized.')
  );
};

const PATTERN_DOMAIN_LABELS: Record<
  NonNullable<AvatarUnderstandingVersion['patternDomain']>,
  { zh: string; en: string }
> = {
  cognitive: { zh: '思维', en: 'Thinking' },
  behavioral: { zh: '行为', en: 'Behavior' },
  emotional: { zh: '情感', en: 'Emotion' },
  relational: { zh: '关系', en: 'Relationship' },
  coping: { zh: '应对', en: 'Coping' },
  motivational: { zh: '动力', en: 'Motivation' },
};

const getPatternDomainLabel = (
  domain: AvatarUnderstandingVersion['patternDomain'],
  language: Language,
) => (domain ? PATTERN_DOMAIN_LABELS[domain]?.[language] : null);

const PATTERN_EVOLUTION_LABELS: Record<PastPatternEvolutionStage, { zh: string; en: string }> = {
  emerging: { zh: '萌芽', en: 'Emerging' },
  strengthening: { zh: '强化', en: 'Strengthening' },
  established: { zh: '稳定', en: 'Established' },
  shifting: { zh: '转变中', en: 'Shifting' },
  fading: { zh: '消退', en: 'Fading' },
};

const getPatternEvolutionLabel = (stage: PastPatternEvolutionStage, language: Language) =>
  PATTERN_EVOLUTION_LABELS[stage][language];

export const PastRepository: React.FC<PastRepositoryProps> = ({
  archiveMode = false,
  initialSection,
  practiceReflectionContext,
  onPracticeReflectionContextDismiss,
  language,
  theme = 'dark',
  entries,
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  patternPrincipleLinks = [],
  onAddPatternPrincipleLink,
  onRemovePatternPrincipleLink,
  onSelectEntry,
  onDeleteEntries,
  onOpenFutureGoal,
}) => {
  const t = TRANSLATIONS[language];
  const [section, setSection] = useState<PastRepositorySection>(
    initialSection ?? (archiveMode ? 'pattern' : 'timeline'),
  );
  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);
  const { state: futureState } = useFuture();
  const [deleting, setDeleting] = useState(false);
  const [timelineQuery, setTimelineQuery] = useState('');
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [principleSourcePatternId, setPrincipleSourcePatternId] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<AvatarUnderstandingVersion[]>([]);
  const [isExtractingPatterns, setIsExtractingPatterns] = useState(false);
  const [patternStatus, setPatternStatus] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [deleteStatus, setDeleteStatus] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [retainDerivedKnowledge, setRetainDerivedKnowledge] = useState(true);
  // This is deliberately session-only: it explains the consequence of the
  // user's most recent deletion without turning a past action into permanent UI.
  const [clearedDerivedKnowledge, setClearedDerivedKnowledge] = useState(false);
  const bulkManagerRef = useRef<HTMLDialogElement>(null);
  const normalizedTimelineQuery = timelineQuery.trim();
  const hasTimelineQuery = normalizedTimelineQuery.length > 0;
  const safeEntries = useMemo(() => (Array.isArray(entries) ? entries : []), [entries]);
  const safePrinciples = useMemo(() => (Array.isArray(principles) ? principles : []), [principles]);
  const safePatternPrincipleLinks = useMemo(
    () => (Array.isArray(patternPrincipleLinks) ? patternPrincipleLinks : []),
    [patternPrincipleLinks],
  );
  const principlePatterns = useMemo(
    () =>
      patterns.map((pattern) => ({
        id: pattern.id,
        statement: getPatternDisplayStatement(pattern.statement, language),
        status: pattern.status,
      })),
    [patterns, language],
  );
  const handlePrincipleSourcePatternHandled = useCallback(
    () => setPrincipleSourcePatternId(null),
    [],
  );
  const getSourceRecordLabel = useCallback(
    (entry: DiaryEntry) => {
      const title = getSafeText(entry.title).trim();
      const content = getSafeText(entry.content).replace(/\s+/g, ' ').trim();
      const isDateTitle =
        /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(title) || /^\d{4}年\d{1,2}月\d{1,2}日/.test(title);
      const label = title && !isDateTitle ? title : content || title;

      if (!label) return language === 'zh' ? '未命名记录' : 'Untitled record';
      return label.length > 34 ? `${label.slice(0, 34)}…` : label;
    },
    [language],
  );

  const timelineEntries = useMemo(() => {
    const active = [...safeEntries].sort(
      (a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt),
    );
    const query = normalizedTimelineQuery.toLowerCase();
    if (!query) return active;
    return active.filter(
      (entry) =>
        getSafeText(entry.title).toLowerCase().includes(query) ||
        getSafeText(entry.content).toLowerCase().includes(query) ||
        getSafeTags(entry.tags).some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [safeEntries, normalizedTimelineQuery]);
  const visibleEntryIds = useMemo(
    () => timelineEntries.map((entry) => entry.id),
    [timelineEntries],
  );
  const timelineRows = [
    ...timelineEntries.map((entry) => ({
      kind: 'entry' as const,
      entry,
      id: entry.id,
      createdAt: entry.createdAt,
    })),
    ...futureState.closures
      .filter(
        (closure, index, all) =>
          !all.slice(index + 1).some((next) => next.goalId === closure.goalId) &&
          closure.snapshot.title
            .toLocaleLowerCase()
            .includes(timelineQuery.trim().toLocaleLowerCase()),
      )
      .map((closure) => ({
        kind: 'closure' as const,
        closure,
        id: closure.id,
        createdAt: closure.createdAt,
      })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  const allVisibleSelected =
    visibleEntryIds.length > 0 && visibleEntryIds.every((id) => selectedEntryIds.has(id));

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedEntryIds(new Set());
  }, []);

  const toggleEntrySelection = useCallback((id: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleEntryIds.forEach((id) => next.delete(id));
      else visibleEntryIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (deleting) return;
    const ids = [...selectedEntryIds];
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      await onDeleteEntries(ids, retainDerivedKnowledge);
      setClearedDerivedKnowledge(!retainDerivedKnowledge);
      setDeleteStatus(
        language === 'zh'
          ? retainDerivedKnowledge
            ? `已删除 ${ids.length} 条记录；相关模式和原则已保留。`
            : `已删除 ${ids.length} 条记录；相关模式和原则已同步清理。`
          : retainDerivedKnowledge
            ? `Deleted ${ids.length} records; related patterns and principles were kept.`
            : `Deleted ${ids.length} records; related patterns and principles were removed.`,
      );
      setDeleteOpen(false);
      exitSelectionMode();
    } catch (error) {
      setDeleteStatus(error instanceof Error ? error.message : '删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (section !== 'timeline') exitSelectionMode();
  }, [section, exitSelectionMode]);

  // Managing records is a task of its own.  A native modal puts it in the
  // browser's top layer, so neither the previous page nor the main navigation
  // can remain visible or receive touches while it is open.
  useEffect(() => {
    const dialog = bulkManagerRef.current;
    if (!dialog) return;

    if (selectionMode && !dialog.open) {
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    }
  }, [selectionMode]);
  const refreshPatterns = useCallback(() => {
    setIsExtractingPatterns(true);
    const realEntries = safeEntries.filter((entry) => !entry.isSample);
    const validEntryIds = new Set(realEntries.map((entry) => entry.id));
    const recordCount = realEntries.length;
    const existing = readAvatarUnderstandings();
    const extracted = extractPastPatterns(safeEntries, existing);
    extracted.forEach((pattern) => writeAvatarUnderstanding(pattern));
    const extractedIds = new Set(extracted.map((pattern) => pattern.id));
    const next = readAvatarUnderstandings().filter(
      (understanding) =>
        !isLegacyEventOnlyPattern(understanding) &&
        (understanding.status === 'confirmed' || understanding.status === 'pending') &&
        (understanding.retainedAfterSourceDeletion === true ||
          understanding.sourceEntryIds.some((entryId) => validEntryIds.has(entryId))) &&
        (extractedIds.has(understanding.id) ||
          understanding.retainedAfterSourceDeletion === true ||
          (Array.isArray(understanding.sourceEntryIds) && understanding.sourceEntryIds.length > 0)),
    );
    setPatterns(next);
    setPatternStatus(
      language === 'zh'
        ? `候选 ${extracted.length} · 记录 ${recordCount}`
        : `${extracted.length} candidates · ${recordCount} records`,
    );
    setIsExtractingPatterns(false);
  }, [safeEntries, language]);

  useEffect(() => {
    refreshPatterns();
  }, [refreshPatterns]);

  const confirmPattern = (pattern: AvatarUnderstandingVersion) => {
    const updated = updateAvatarUnderstandingStatus(pattern.id, 'confirmed');
    if (!updated) return;
    setPatterns((current) => current.map((item) => (item.id === pattern.id ? updated : item)));
  };

  const sections = [
    {
      id: 'timeline' as const,
      label: language === 'zh' ? '回看' : 'Review',
      detail: timelineEntries.length,
    },
    {
      id: 'pattern' as const,
      label: language === 'zh' ? '模式' : 'Patterns',
      detail: patterns.length,
    },
    {
      id: 'principle' as const,
      label: archiveMode
        ? language === 'zh'
          ? '原则'
          : 'Principles'
        : language === 'zh'
          ? '沉淀'
          : 'Distill',
      detail: safePrinciples.length,
    },
  ];

  const renderTimelineRows = (isManaging = false) => {
    if (timelineRows.length === 0) {
      return (
        <p className="mobile-past-empty" role="status" aria-live="polite">
          {hasTimelineQuery
            ? language === 'zh'
              ? '没有找到相关记录。'
              : 'No matching records found.'
            : language === 'zh'
              ? '还没有记录。请前往「现在」写入。'
              : 'No records yet. Write in Now.'}
        </p>
      );
    }

    return (
      <ul className="mobile-past-timeline__list">
        {timelineRows.map((row, index) =>
          row.kind === 'closure' ? (
            <li key={row.id}>
              <article className="mobile-past-goal-summary">
                <small>
                  {getSourceDateLabel(row.createdAt, language)} ·{' '}
                  {row.closure.snapshot.status === 'completed' ? '目标完成' : '目标结束'}
                </small>
                <h3>{row.closure.snapshot.title}</h3>
                <p>
                  {row.closure.snapshot.measurement.kind === 'quantity'
                    ? `${row.closure.total} / ${row.closure.snapshot.measurement.target} ${row.closure.snapshot.measurement.unit}`
                    : '已归档文字进展'}
                </p>
                {row.closure.total !== goalProgress(futureState, row.closure.snapshot).total && (
                  <small>当前进度已变化，以上为结束时快照</small>
                )}
                {onOpenFutureGoal && (
                  <button type="button" onClick={() => onOpenFutureGoal(row.closure.goalId)}>
                    查看进展与历史
                  </button>
                )}
              </article>
            </li>
          ) : (
            <li key={row.id}>
              <MobilePastTimelineEntry
                entry={row.entry}
                highlight={!isManaging && !hasTimelineQuery && index === 0}
                language={language}
                selectionMode={isManaging}
                selected={selectedEntryIds.has(row.id)}
                onToggleSelection={toggleEntrySelection}
              />
            </li>
          ),
        )}
      </ul>
    );
  };

  return (
    <section className="mobile-past-page" data-testid="past-page">
      <div
        className="mobile-past-page__segments"
        role="tablist"
        aria-label={language === 'zh' ? '过去分区' : 'Past sections'}
      >
        {sections
          .filter(({ id }) => (archiveMode ? id !== 'timeline' : id !== 'pattern'))
          .map(({ id, label, detail }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={section === id}
              className={section === id ? 'mobile-past-page__segment--active' : ''}
              onClick={() => setSection(id)}
            >
              <span>{label}</span>
              <small aria-label={`${detail}`}>{detail}</small>
            </button>
          ))}
      </div>

      <section className="mobile-past-page__body">
        {section === 'timeline' && (
          <div className="mobile-past-timeline">
            <div className="mobile-past-search-row">
              <div className="mobile-past-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <input
                  type="search"
                  aria-label={language === 'zh' ? '搜索记录' : 'Search records'}
                  value={timelineQuery}
                  onChange={(event) => {
                    setTimelineQuery(event.target.value);
                    setSelectedEntryIds(new Set());
                  }}
                  placeholder={
                    language === 'zh' ? '搜索标题 / 内容 / 标签' : 'Search title / content / tags'
                  }
                />
                {timelineQuery.length > 0 && (
                  <button
                    type="button"
                    className="mobile-past-search__clear"
                    aria-label={language === 'zh' ? '清除搜索' : 'Clear search'}
                    onClick={() => {
                      setTimelineQuery('');
                      setSelectedEntryIds(new Set());
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="mobile-past-selection-toggle"
                onClick={() => {
                  setDeleteStatus('');
                  setSelectionMode(true);
                }}
              >
                {language === 'zh' ? '选择' : 'Select'}
              </button>
            </div>
            {deleteStatus && (
              <p className="mobile-past-delete-status" role="status">
                {deleteStatus}
              </p>
            )}
            {renderTimelineRows()}
          </div>
        )}

        {selectionMode && (
          <dialog
            ref={bulkManagerRef}
            className="past-bulk-editor-screen"
            aria-label={language === 'zh' ? '管理记录' : 'Manage records'}
            aria-hidden={deleteOpen || undefined}
            onCancel={(event) => {
              event.preventDefault();
              if (!deleting && !deleteOpen) exitSelectionMode();
            }}
          >
            <header className="past-bulk-editor-screen__header">
              <button type="button" aria-label={language === 'zh' ? '返回回看' : 'Back to review'} onClick={exitSelectionMode}>
                <ArrowLeft aria-hidden="true" />
              </button>
              <div>
                <p>{language === 'zh' ? '回看' : 'Review'}</p>
                <h2>{language === 'zh' ? '管理记录' : 'Manage records'}</h2>
              </div>
              <button type="button" className="past-bulk-editor-screen__select-all" onClick={toggleSelectAll}>
                {allVisibleSelected ? (language === 'zh' ? '取消全选' : 'Deselect all') : language === 'zh' ? '全选' : 'Select all'}
              </button>
            </header>
            <div className="past-bulk-editor-screen__content">
              <div className="mobile-past-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <input type="search" aria-label={language === 'zh' ? '搜索记录' : 'Search records'} value={timelineQuery} onChange={(event) => { setTimelineQuery(event.target.value); setSelectedEntryIds(new Set()); }} placeholder={language === 'zh' ? '搜索标题 / 内容 / 标签' : 'Search title / content / tags'} />
                {timelineQuery.length > 0 && <button type="button" className="mobile-past-search__clear" aria-label={language === 'zh' ? '清除搜索' : 'Clear search'} onClick={() => { setTimelineQuery(''); setSelectedEntryIds(new Set()); }}><X className="h-4 w-4" aria-hidden="true" /></button>}
              </div>
              <p className="past-bulk-editor-screen__count" aria-live="polite">{language === 'zh' ? `已选 ${selectedEntryIds.size} 条` : `${selectedEntryIds.size} selected`}</p>
              {renderTimelineRows(true)}
            </div>
            <footer className="past-bulk-editor-screen__footer">
              <button type="button" disabled={deleting || selectedEntryIds.size === 0} onClick={() => { setRetainDerivedKnowledge(true); setDeleteStatus(''); setDeleteOpen(true); }}>
                <Trash2 aria-hidden="true" />
                {language === 'zh' ? `删除 ${selectedEntryIds.size} 条` : `Delete ${selectedEntryIds.size}`}
              </button>
            </footer>
          </dialog>
        )}

        {deleteOpen && (
          <PastActionDialog
            title={
              language === 'zh'
                ? `删除 ${selectedEntryIds.size} 条记录？`
                : `Delete ${selectedEntryIds.size} records?`
            }
            onCancel={() => setDeleteOpen(false)}
            busy={deleting}
          >
            <p>{language === 'zh' ? '删除后无法恢复。' : 'This cannot be undone.'}</p>
            <label>
              <input
                type="checkbox"
                checked={retainDerivedKnowledge}
                disabled={deleting}
                onChange={(event) => setRetainDerivedKnowledge(event.target.checked)}
              />
              {language === 'zh' ? '保留相关模式和原则' : 'Keep related patterns and principles'}
            </label>
            {!retainDerivedKnowledge && (
              <p>
                {language === 'zh'
                  ? '相关模式和原则也将同步清理。'
                  : 'Related patterns and principles will also be removed.'}
              </p>
            )}
            {deleteStatus && <p role="alert">{deleteStatus}</p>}
            <div className="past-action-dialog__actions">
              <button data-cancel disabled={deleting} onClick={() => setDeleteOpen(false)}>
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button disabled={deleting} onClick={handleDeleteSelected}>
                {language === 'zh' ? (deleting ? '删除中…' : '确认删除') : 'Delete'}
              </button>
            </div>
          </PastActionDialog>
        )}

        {section === 'principle' && (
          <div className="mobile-past-experience">
            <ArchivePrinciplesView
              theme={theme}
              language={language}
              t={t}
              principles={safePrinciples}
              onAddPrinciple={onAddPrinciple}
              onDeletePrinciple={onDeletePrinciple}
              onUpdatePrinciple={onUpdatePrinciple}
              patterns={principlePatterns}
              patternPrincipleLinks={safePatternPrincipleLinks}
              onAddPatternPrincipleLink={onAddPatternPrincipleLink}
              onRemovePatternPrincipleLink={onRemovePatternPrincipleLink}
              requestedPatternId={principleSourcePatternId}
              onRequestedPatternHandled={handlePrincipleSourcePatternHandled}
              displayFirst={!archiveMode}
              practiceReflectionContext={practiceReflectionContext}
              onPracticeReflectionContextDismiss={onPracticeReflectionContextDismiss}
              emptyReason={clearedDerivedKnowledge ? 'source-deletion' : undefined}
            />
          </div>
        )}

        {section === 'pattern' && (
          <div className="mobile-past-patterns">
            <div className="mobile-past-patterns__toolbar">
              <span role="status" aria-live="polite">
                {isExtractingPatterns
                  ? language === 'zh'
                    ? '正在提取'
                    : 'Extracting'
                  : patternStatus}
              </span>
              <button
                type="button"
                onClick={refreshPatterns}
                disabled={isExtractingPatterns}
                aria-busy={isExtractingPatterns}
              >
                <RefreshCw aria-hidden="true" />
                {language === 'zh' ? '刷新' : 'Refresh'}
              </button>
            </div>
            {patterns.length === 0 ? (
              <p className="mobile-past-empty" role="status">
                {language === 'zh'
                  ? clearedDerivedKnowledge
                    ? '关联经历已删除，因此没有可显示的模式。新的相似经历出现两次后，会形成候选模式。'
                    : '相似情境与反应出现两次后，将形成候选模式。'
                  : clearedDerivedKnowledge
                    ? 'Related entries were deleted, so there are no patterns to show. A candidate appears after a similar situation and response occur twice.'
                    : 'A candidate appears after a similar situation and response occur twice.'}
              </p>
            ) : (
              <ul className="mobile-past-patterns__list">
                {patterns.map((pattern) => {
                  const sourceEntryIds = Array.isArray(pattern.sourceEntryIds)
                    ? pattern.sourceEntryIds
                    : [];
                  const evidenceEntries = sourceEntryIds
                    .flatMap((entryId) => {
                      const entry = safeEntries.find((item) => item.id === entryId);
                      return entry ? [entry] : [];
                    })
                    .sort((a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt));
                  const occurrenceCount = evidenceEntries.length;
                  const visibleEvidenceEntries = evidenceEntries.slice(0, 2);
                  const hiddenEvidenceCount = Math.max(evidenceEntries.length - 2, 0);
                  const isRetainedWithoutSources =
                    pattern.retainedAfterSourceDeletion === true && sourceEntryIds.length === 0;
                  const evolution = derivePastPatternEvolution({
                    pattern,
                    entries: safeEntries,
                    principles: safePrinciples,
                    links: safePatternPrincipleLinks,
                  });
                  const lifecycle = getPatternEvolutionLabel(evolution.stage, language);
                  const isExpanded = expandedPatternId === pattern.id;
                  const patternStatement = getPatternDisplayStatement(pattern.statement, language);
                  const patternStateLabel =
                    pattern.status === 'confirmed'
                      ? language === 'zh'
                        ? '已确认'
                        : 'Confirmed'
                      : language === 'zh'
                        ? '候选'
                        : 'Candidate';
                  const domainLabel = getPatternDomainLabel(pattern.patternDomain, language);
                  const patternLabel = getSafeText(pattern.patternLabel).trim();
                  return (
                    <li
                      key={pattern.id}
                      className="mobile-past-pattern-card"
                      data-status={pattern.status}
                      data-panel={isExpanded ? 'source' : 'idle'}
                    >
                      <div className="mobile-past-pattern-card__summary">
                        <span
                          className="mobile-past-pattern-card__state"
                          aria-label={`${patternStateLabel} · ${lifecycle}`}
                        >
                          {patternStateLabel}
                        </span>
                        <span className="mobile-past-pattern-card__count">
                          {isRetainedWithoutSources
                            ? language === 'zh'
                              ? '原始记录已删除'
                              : 'Original records deleted'
                            : language === 'zh'
                              ? `出现 ${occurrenceCount} 次`
                              : `${occurrenceCount} occurrences`}
                        </span>
                      </div>
                      <p>{patternStatement}</p>
                      <div className="mobile-past-pattern-card__actions">
                        <button
                          type="button"
                          className="mobile-past-pattern-card__source-link"
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedPatternId(isExpanded ? null : pattern.id);
                          }}
                        >
                          {language === 'zh' ? '查看依据' : 'View evidence'}
                        </button>
                        {pattern.status === 'pending' ? (
                          <button
                            type="button"
                            className="mobile-past-pattern-card__primary-action"
                            onClick={() => {
                              confirmPattern(pattern);
                              setExpandedPatternId(null);
                            }}
                          >
                            <Check aria-hidden="true" />
                            {language === 'zh' ? '确认模式' : 'Confirm pattern'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="mobile-past-pattern-card__primary-action"
                            onClick={() => {
                              setExpandedPatternId(null);
                              setPrincipleSourcePatternId(pattern.id);
                              setSection('principle');
                            }}
                          >
                            {language === 'zh' ? '萃取原则' : 'Extract principle'}
                          </button>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="mobile-past-pattern-card__panel mobile-past-pattern-card__evidence">
                          {(domainLabel || patternLabel || lifecycle) && (
                            <p className="mobile-past-pattern-card__context">
                              {[domainLabel, patternLabel, lifecycle].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {getSafeText(pattern.outcome).trim() && (
                            <p className="mobile-past-pattern-card__outcome">
                              <span>{language === 'zh' ? '结果' : 'Result'}</span>
                              {pattern.outcome}
                            </p>
                          )}
                          {evidenceEntries.length > 0 ? (
                            <>
                              {visibleEvidenceEntries.map((entry) => (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => onSelectEntry(entry)}
                                >
                                  <span>{getSourceRecordLabel(entry)}</span>
                                  <time>{getSourceDateLabel(entry.createdAt, language)}</time>
                                </button>
                              ))}
                              {hiddenEvidenceCount > 0 && (
                                <span>
                                  {language === 'zh'
                                    ? `还有 ${hiddenEvidenceCount} 条`
                                    : `${hiddenEvidenceCount} more`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>
                              {isRetainedWithoutSources
                                ? language === 'zh'
                                  ? '这是保留的理解，原始记录已删除。'
                                  : 'This retained understanding no longer has its original records.'
                                : language === 'zh'
                                  ? '来源暂不可用'
                                  : 'Source unavailable'}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </section>
  );
};
