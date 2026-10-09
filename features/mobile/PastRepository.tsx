import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, Trash2, X } from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import type {
  DiaryEntry,
  ActionItem,
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
import { useFuture } from '../../hooks/useFuture';
import { goalProgress } from '../../services/futureRepository';
import type { ActionDraftContext, PracticeReflectionContext } from '../../types/future';
import type { PrincipleRevisionKind } from '../../services/principleRevision';
import { currentPrinciples } from '../../services/principleRevision';
import {
  availablePastTags,
  buildPastEntryRelationIndex,
  buildDeterministicReview,
  filterPastEntries,
  type PastSearchFilters,
} from './pastSearch';

interface PastRepositoryProps {
  archiveMode?: boolean;
  /** Allows a deliberate cross-module handoff, such as an action that is ready to be reflected on. */
  initialSection?: PastRepositorySection;
  initialQuery?: string;
  onViewChange?: (view: { section: PastRepositorySection; query: string }) => void;
  practiceReflectionContext?: PracticeReflectionContext | null;
  onPracticeReflectionContextDismiss?: () => void;
  /** @deprecated Past no longer opens the avatar; retained for call-site compatibility. */
  onOpenAvatar?: () => void;
  onOpenNow?: () => void;
  onOpenFutureGoal?: (goalId: string) => void;
  onOpenFutureAction?: (context: ActionDraftContext) => void;
  language: Language;
  theme?: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  /** Actions are only used to make a past search traceable back to its records. */
  actions?: ActionItem[];
  onAddPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
    application?: PrincipleApplication,
    sourcePatternIds?: string[],
    tags?: string[],
    derivedFromPracticeIds?: string[],
  ) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  onRevisePrinciple?: (
    original: Principle,
    text: string,
    revisionKind: PrincipleRevisionKind,
  ) => void | Promise<void>;
  /** @deprecated Legacy linkage is retained in storage for avatar context only. */
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

const getSourceDateLabel = (value: number, language: Language) =>
  new Date(value).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US');

const getSafeText = (value: unknown) => (typeof value === 'string' ? value : '');

const getSafeTags = (tags: unknown) =>
  Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];

const getSafeTimestamp = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const TIMELINE_RENDER_BATCH_SIZE = 100;

export const PastRepository: React.FC<PastRepositoryProps> = ({
  archiveMode = false,
  initialSection,
  initialQuery = '',
  onViewChange,
  practiceReflectionContext,
  onPracticeReflectionContextDismiss,
  language,
  theme = 'dark',
  entries,
  principles,
  actions = [],
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  onRevisePrinciple,
  onSelectEntry,
  onDeleteEntries,
  onOpenFutureGoal,
  onOpenFutureAction,
  onOpenNow,
}) => {
  const t = TRANSLATIONS[language];
  const [section, setSection] = useState<PastRepositorySection>(initialSection ?? 'timeline');
  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);
  const { state: futureState } = useFuture();
  const [deleting, setDeleting] = useState(false);
  const [timelineQuery, setTimelineQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<PastSearchFilters>({});
  const [timelineRenderLimit, setTimelineRenderLimit] = useState(TIMELINE_RENDER_BATCH_SIZE);
  useEffect(() => {
    onViewChange?.({ section, query: timelineQuery });
  }, [section, timelineQuery, onViewChange]);
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
  const safeActions = useMemo(() => (Array.isArray(actions) ? actions : []), [actions]);
  const activePrinciples = useMemo(() => currentPrinciples(safePrinciples), [safePrinciples]);
  const relationIndex = useMemo(
    () => buildPastEntryRelationIndex(safeActions, activePrinciples),
    [safeActions, activePrinciples],
  );
  const filterTags = useMemo(() => availablePastTags(safeEntries), [safeEntries]);
  const searchMatches = useMemo(() => {
    const query = normalizedTimelineQuery.toLocaleLowerCase();
    if (!query) return { principleIds: new Set<string>(), actionIds: new Set<string>() };
    const includes = (...values: Array<string | undefined>) =>
      values.some((value) => getSafeText(value).toLocaleLowerCase().includes(query));
    return {
      principleIds: new Set(
        activePrinciples
          .filter((principle) =>
            includes(
              principle.text,
              ...(principle.tags ?? []),
              principle.application?.trigger,
              principle.application?.action,
            ),
          )
          .map((principle) => principle.id),
      ),
      actionIds: new Set(
        safeActions
          .filter((action) => includes(action.title, action.question, action.rationale))
          .map((action) => action.id),
      ),
    };
  }, [activePrinciples, safeActions, normalizedTimelineQuery]);
  const relatedSearchSources = useMemo(() => {
    if (!hasTimelineQuery) return [];
    const principles = activePrinciples
      .filter((principle) => searchMatches.principleIds.has(principle.id))
      .map((principle) => ({
        id: principle.id,
        kind: language === 'zh' ? '原则' : 'Principle',
        text: principle.text,
      }));
    const actions = safeActions
      .filter((action) => searchMatches.actionIds.has(action.id))
      .map((action) => ({
        id: action.id,
        kind: language === 'zh' ? '行动' : 'Action',
        text: action.title,
      }));
    return [...principles, ...actions].slice(0, 3);
  }, [activePrinciples, safeActions, searchMatches, hasTimelineQuery, language]);
  const textMatchedEntries = useMemo(() => {
    const active = [...safeEntries].sort(
      (a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt),
    );
    const query = normalizedTimelineQuery.toLocaleLowerCase();
    if (!query) return active;
    const isDirectMatch = (entry: DiaryEntry) =>
      getSafeText(entry.title).toLocaleLowerCase().includes(query) ||
      getSafeText(entry.content).toLocaleLowerCase().includes(query) ||
      getSafeTags(entry.tags).some((tag) => tag.toLocaleLowerCase().includes(query)) ||
      (entry.nowMaterials ?? []).some((material) =>
        getSafeText(material.description).toLocaleLowerCase().includes(query),
      );
    const matchedActionEntryIds = new Set(
      safeActions
        .filter((action) => searchMatches.actionIds.has(action.id))
        .flatMap((action) => [
          action.sourceEntryId,
          action.resultEntryId,
          ...(action.evidenceEntryIds ?? []),
        ])
        .filter((id): id is string => Boolean(id)),
    );
    return active.filter(
      (entry) =>
        isDirectMatch(entry) ||
        matchedActionEntryIds.has(entry.id) ||
        (entry.relatedPrincipleIds ?? []).some((id) => searchMatches.principleIds.has(id)) ||
        (entry.relatedActionIds ?? []).some((id) => searchMatches.actionIds.has(id)) ||
        activePrinciples.some(
          (principle) =>
            searchMatches.principleIds.has(principle.id) &&
            (principle.derivedFromEntryIds ?? []).includes(entry.id),
        ),
    );
  }, [safeEntries, safeActions, activePrinciples, searchMatches, normalizedTimelineQuery]);
  const timelineEntries = useMemo(
    () =>
      filterPastEntries(textMatchedEntries, filters, safeActions, activePrinciples, relationIndex),
    [textMatchedEntries, filters, safeActions, activePrinciples, relationIndex],
  );
  const deterministicReview = useMemo(
    () => buildDeterministicReview(timelineEntries, activePrinciples, safeActions),
    [timelineEntries, activePrinciples, safeActions],
  );
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
  const renderedTimelineRows = timelineRows.slice(0, timelineRenderLimit);
  const hasMoreTimelineRows = timelineRows.length > renderedTimelineRows.length;
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
            ? `已删除 ${ids.length} 条记录；分身已形成的理解与我的原则已保留。`
            : `已删除 ${ids.length} 条记录；分身已形成的理解与我的原则已同步清理。`
          : retainDerivedKnowledge
            ? `Deleted ${ids.length} records; avatar understandings and my principles were kept.`
            : `Deleted ${ids.length} records; avatar understandings and my principles were removed.`,
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

  useEffect(() => {
    setTimelineRenderLimit(TIMELINE_RENDER_BATCH_SIZE);
  }, [normalizedTimelineQuery, filters, entries, actions, principles]);

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
  const sections = [
    {
      id: 'timeline' as const,
      label: language === 'zh' ? '回看' : 'Review',
      detail: timelineEntries.length,
    },
    {
      id: 'principle' as const,
      label: language === 'zh' ? '我的原则' : 'My principles',
      detail: activePrinciples.length,
    },
  ];
  const hasFilters = Boolean(
    filters.tags?.length ||
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.linkedTo,
  );
  const updateDateFilter = (key: 'from' | 'to', value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value
        ? new Date(`${value}T${key === 'to' ? '23:59:59.999' : '00:00:00.000'}`).getTime()
        : undefined,
    }));
    setSelectedEntryIds(new Set());
  };

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
      <>
        <ul className="mobile-past-timeline__list">
          {renderedTimelineRows.map((row, index) =>
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
                  onOpenFutureAction={onOpenFutureAction}
                />
              </li>
            ),
          )}
        </ul>
        {hasMoreTimelineRows && (
          <button
            type="button"
            className="mobile-past-load-more"
            onClick={() => setTimelineRenderLimit((limit) => limit + TIMELINE_RENDER_BATCH_SIZE)}
          >
            {language === 'zh'
              ? `加载更多（剩余 ${timelineRows.length - renderedTimelineRows.length} 条）`
              : `Load more (${timelineRows.length - renderedTimelineRows.length} remaining)`}
          </button>
        )}
      </>
    );
  };

  return (
    <section className="mobile-past-page" data-testid="past-page">
      <div
        className="mobile-past-page__segments"
        role="tablist"
        aria-label={language === 'zh' ? '过去分区' : 'Past sections'}
      >
        {sections.map(({ id, label, detail }) => (
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
                    language === 'zh'
                      ? '搜索记录、原则或行动'
                      : 'Search records, principles, or actions'
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
            <div
              className="mobile-past-filters"
              aria-label={language === 'zh' ? '筛选记录' : 'Filter records'}
            >
              <label>
                {language === 'zh' ? '从' : 'From'}
                <input
                  type="date"
                  aria-label={language === 'zh' ? '开始日期' : 'Start date'}
                  value={filters.from ? new Date(filters.from).toISOString().slice(0, 10) : ''}
                  onChange={(event) => updateDateFilter('from', event.target.value)}
                />
              </label>
              <label>
                {language === 'zh' ? '到' : 'To'}
                <input
                  type="date"
                  aria-label={language === 'zh' ? '结束日期' : 'End date'}
                  value={filters.to ? new Date(filters.to).toISOString().slice(0, 10) : ''}
                  onChange={(event) => updateDateFilter('to', event.target.value)}
                />
              </label>
              <select
                aria-label={language === 'zh' ? '按标签筛选' : 'Filter by tag'}
                value={filters.tags?.[0] ?? ''}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    tags: event.target.value ? [event.target.value] : undefined,
                  }));
                  setSelectedEntryIds(new Set());
                }}
              >
                <option value="">{language === 'zh' ? '所有标签' : 'All tags'}</option>
                {filterTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <select
                aria-label={language === 'zh' ? '按关联筛选' : 'Filter by relation'}
                value={filters.linkedTo ?? ''}
                onChange={(event) => {
                  const linkedTo = event.target.value as PastSearchFilters['linkedTo'] | '';
                  setFilters((current) => ({ ...current, linkedTo: linkedTo || undefined }));
                  setSelectedEntryIds(new Set());
                }}
              >
                <option value="">{language === 'zh' ? '所有关联' : 'All relations'}</option>
                <option value="action">{language === 'zh' ? '关联行动' : 'Linked actions'}</option>
                <option value="principle">
                  {language === 'zh' ? '关联原则' : 'Linked principles'}
                </option>
              </select>
              {hasFilters && (
                <button type="button" onClick={() => setFilters({})}>
                  {language === 'zh' ? '清除筛选' : 'Clear filters'}
                </button>
              )}
            </div>
            <p className="mobile-past-filter-result" role="status">
              {language === 'zh'
                ? `显示 ${timelineEntries.length} 条记录`
                : `${timelineEntries.length} records shown`}
            </p>
            {deleteStatus && (
              <p className="mobile-past-delete-status" role="status">
                {deleteStatus}
              </p>
            )}
            {relatedSearchSources.length > 0 && (
              <aside
                className="mobile-past-search-sources"
                aria-label={language === 'zh' ? '关联依据' : 'Related sources'}
              >
                <span>{language === 'zh' ? '关联依据' : 'Related sources'}</span>
                <ul>
                  {relatedSearchSources.map((source) => (
                    <li key={`${source.kind}-${source.id}`}>
                      <small>{source.kind}</small>
                      <span>{source.text}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
            {deterministicReview.entries.length > 0 && (
              <aside
                className="mobile-past-fact-review"
                aria-label={language === 'zh' ? '事实回顾' : 'Fact review'}
              >
                <strong>{language === 'zh' ? '事实回顾' : 'Fact review'}</strong>
                <p>
                  {language === 'zh'
                    ? '以下内容均来自你已保存的资料，不包含模型推断。'
                    : 'Everything below comes from your saved data; no model inference is included.'}
                </p>
                <ul>
                  <li>
                    {language === 'zh' ? '最近记录：' : 'Recent records: '}
                    {deterministicReview.entries.map((entry) => entry.title).join('、')}
                  </li>
                  {deterministicReview.principles.length > 0 && (
                    <li>
                      {language === 'zh' ? '已有原则：' : 'Existing principles: '}
                      {deterministicReview.principles.map((principle) => principle.text).join('、')}
                    </li>
                  )}
                  {deterministicReview.actions.length > 0 && (
                    <li>
                      {language === 'zh' ? '关联行动：' : 'Related actions: '}
                      {deterministicReview.actions.map((action) => action.title).join('、')}
                    </li>
                  )}
                </ul>
                {onOpenFutureAction && deterministicReview.actionContext && (
                  <button
                    type="button"
                    onClick={() => onOpenFutureAction(deterministicReview.actionContext!)}
                  >
                    {language === 'zh'
                      ? '从最近经历设计下一次尝试'
                      : 'Plan an attempt from the latest experience'}
                  </button>
                )}
              </aside>
            )}
            {!entries.some((entry) => !entry.isSample) && onOpenNow && !hasTimelineQuery && (
              <aside
                className="mobile-past-first-record"
                aria-label={language === 'zh' ? '开始记录' : 'Start journaling'}
              >
                <p>
                  {language === 'zh'
                    ? '从一件刚发生的小事开始。保存后，可以在这里搜索、回看，再决定下一步。'
                    : 'Start with something that just happened. Save it here to search, revisit, and decide your next step.'}
                </p>
                <button type="button" onClick={onOpenNow}>
                  {language === 'zh' ? '写下第一条记录' : 'Write your first entry'}
                </button>
              </aside>
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
              <button
                type="button"
                aria-label={language === 'zh' ? '返回回看' : 'Back to review'}
                onClick={exitSelectionMode}
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <div>
                <p>{language === 'zh' ? '回看' : 'Review'}</p>
                <h2>{language === 'zh' ? '管理记录' : 'Manage records'}</h2>
              </div>
              <button
                type="button"
                className="past-bulk-editor-screen__select-all"
                onClick={toggleSelectAll}
              >
                {allVisibleSelected
                  ? language === 'zh'
                    ? '取消全选'
                    : 'Deselect all'
                  : language === 'zh'
                    ? '全选'
                    : 'Select all'}
              </button>
            </header>
            <div className="past-bulk-editor-screen__content">
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
                    language === 'zh'
                      ? '搜索记录、原则或行动'
                      : 'Search records, principles, or actions'
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
              <p className="past-bulk-editor-screen__count" aria-live="polite">
                {language === 'zh'
                  ? `已选 ${selectedEntryIds.size} 条`
                  : `${selectedEntryIds.size} selected`}
              </p>
              {renderTimelineRows(true)}
            </div>
            <footer className="past-bulk-editor-screen__footer">
              <button
                type="button"
                disabled={deleting || selectedEntryIds.size === 0}
                onClick={() => {
                  setRetainDerivedKnowledge(true);
                  setDeleteStatus('');
                  setDeleteOpen(true);
                }}
              >
                <Trash2 aria-hidden="true" />
                {language === 'zh'
                  ? `删除 ${selectedEntryIds.size} 条`
                  : `Delete ${selectedEntryIds.size}`}
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
              {language === 'zh'
                ? '保留分身已形成的理解与我的原则'
                : 'Keep avatar understandings and my principles'}
            </label>
            {!retainDerivedKnowledge && (
              <p>
                {language === 'zh'
                  ? '分身已形成的理解与我的原则也将同步清理。'
                  : 'Avatar understandings and my principles will also be removed.'}
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
              onRevisePrinciple={onRevisePrinciple}
              displayFirst={!archiveMode}
              practiceReflectionContext={practiceReflectionContext}
              onPracticeReflectionContextDismiss={onPracticeReflectionContextDismiss}
              onOpenFutureAction={onOpenFutureAction}
              emptyReason={clearedDerivedKnowledge ? 'source-deletion' : undefined}
            />
          </div>
        )}
      </section>
    </section>
  );
};
