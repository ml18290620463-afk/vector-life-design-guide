import React, { useMemo, useState } from 'react';
import { Archive, BookOpen, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useNowTick } from '../../hooks/useNowTick';
import { useArchiveGrouping } from '../../hooks/useArchiveGrouping';
import { TRANSLATIONS } from '../../constants';
import type { Container, DiaryEntry, Language, Principle, Theme } from '../../types';
import type { ExperienceFeedbackOutcome } from '../../types';
import { ArchivePrinciplesView } from '../../components/ArchivePrinciplesView';
import { ArchiveVaultEntries } from '../../components/ArchiveVaultEntries';
import { ExperienceFeedbackPrompt } from '../../components/ExperienceFeedbackPrompt';
import { FilterHub } from '../../components/FilterHub';
import { PastExperienceWorkbench } from '../../components/PastExperienceWorkbench';
import { RelatedExperienceDisclosure } from '../../components/RelatedExperienceDisclosure';
import { applyPrincipleFeedback, hasFeedbackForPrinciple } from '../../services/experienceFeedback';
import { MobilePastTimelineEntry } from './MobilePastTimelineEntry';
import type { PastRepositorySection } from './types';
import type { AvatarLaunchContext } from '../avatar/types';

interface PastRepositoryProps {
  language: Language;
  theme?: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  onAddPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
  ) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  onUpdateEntry?: (entry: DiaryEntry) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  containers: Container[];
  onAddContainer: (name: string) => void;
  onDeleteContainer: (id: string) => void;
  onOpenAvatar?: (context: AvatarLaunchContext) => void;
}

export const PastRepository: React.FC<PastRepositoryProps> = ({
  language,
  theme = 'dark',
  entries,
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  onUpdateEntry,
  onSelectEntry,
  containers,
  onAddContainer,
  onDeleteContainer,
  onOpenAvatar,
}) => {
  const t = TRANSLATIONS[language];
  const [section, setSection] = useState<PastRepositorySection>('timeline');
  const [experienceView, setExperienceView] = useState<'distill' | 'principles'>('distill');
  const [timelineQuery, setTimelineQuery] = useState('');
  const [showArchiveFilter, setShowArchiveFilter] = useState(false);

  const timelineEntries = useMemo(() => {
    const active = entries
      .filter((entry) => !entry.isArchived)
      .sort((a, b) => b.createdAt - a.createdAt);
    const query = timelineQuery.trim().toLowerCase();
    if (!query) return active;
    return active.filter(
      (entry) =>
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [entries, timelineQuery]);

  const archivedEntries = useMemo(() => entries.filter((entry) => entry.isArchived), [entries]);
  const latestEntry = timelineEntries[0] ?? null;
  const relatedExperiences = useMemo(() => {
    if (!latestEntry) return [];
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    return (latestEntry.relatedEntryIds ?? []).flatMap((entryId) => {
      const relatedEntry = entriesById.get(entryId);
      return relatedEntry && relatedEntry.id !== latestEntry.id ? [relatedEntry] : [];
    });
  }, [entries, latestEntry]);
  const pendingFeedbackPrinciple = useMemo(() => {
    if (!latestEntry || !onUpdateEntry) return null;
    return (
      (latestEntry.relatedPrincipleIds ?? [])
        .map((principleId) => principles.find((principle) => principle.id === principleId))
        .find(
          (principle): principle is Principle =>
            Boolean(principle) && !hasFeedbackForPrinciple(latestEntry, principle.id),
        ) ?? null
    );
  }, [latestEntry, onUpdateEntry, principles]);
  const distillableEntriesCount = useMemo(
    () =>
      entries.filter(
        (entry) => !entry.isArchived && (!entry.unlockAt || entry.unlockAt <= Date.now()),
      ).length,
    [entries],
  );

  const hasPendingTimeLock = useMemo(
    () =>
      entries.some((entry) => typeof entry.unlockAt === 'number' && entry.unlockAt > Date.now()),
    [entries],
  );
  const now = useNowTick(hasPendingTimeLock);
  const grouping = useArchiveGrouping({ entries: archivedEntries });
  const handleExperienceFeedback = (
    entry: DiaryEntry,
    principle: Principle,
    outcome: ExperienceFeedbackOutcome,
  ) => {
    if (!onUpdateEntry) return;
    const createdAt = Date.now();
    onUpdateEntry({
      ...entry,
      principleFeedback: [
        ...(entry.principleFeedback ?? []),
        { principleId: principle.id, outcome, createdAt },
      ],
    });
    if (outcome !== 'unrelated') {
      onUpdatePrinciple(applyPrincipleFeedback(principle, outcome, createdAt));
    }
  };
  const sections = [
    {
      id: 'timeline' as const,
      label: language === 'zh' ? '记录' : 'Records',
      detail: timelineEntries.length,
      Icon: BookOpen,
    },
    {
      id: 'experience' as const,
      label: language === 'zh' ? '经验' : 'Insights',
      detail: principles.length,
      Icon: Sparkles,
    },
    {
      id: 'archive' as const,
      label: language === 'zh' ? '归档' : 'Archive',
      detail: archivedEntries.length,
      Icon: Archive,
    },
  ];

  return (
    <main className="mobile-past-page" data-testid="past-page">
      <header className="mobile-past-page__header">
        <p className="mobile-past-page__eyebrow">
          {language === 'zh' ? 'VECTOR · 过去' : 'VECTOR · Past'}
        </p>
        <div className="mobile-past-page__heading-row">
          <h1>{language === 'zh' ? '过去' : 'Past'}</h1>
          <span>
            {language === 'zh' ? `${entries.length} 条记录` : `${entries.length} records`}
          </span>
        </div>
        <p className="mobile-past-page__subtitle">
          {language === 'zh'
            ? '回看记录，提炼经验，整理长期记忆'
            : 'Review records, distill insights, organize long-term memory'}
        </p>
      </header>

      <div
        className="mobile-past-page__segments"
        role="tablist"
        aria-label={language === 'zh' ? '过去分区' : 'Past sections'}
      >
        {sections.map(({ id, label, detail, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-label={label}
            aria-selected={section === id}
            className={section === id ? 'mobile-past-page__segment--active' : ''}
            onClick={() => setSection(id)}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <small>{detail}</small>
          </button>
        ))}
      </div>

      <section className="mobile-past-page__body">
        {section === 'timeline' && (
          <div className="mobile-past-timeline">
            {latestEntry && relatedExperiences.length > 0 && (
              <RelatedExperienceDisclosure
                entry={latestEntry}
                language={language}
                onSelectEntry={onSelectEntry}
                relatedEntries={relatedExperiences}
                theme={theme}
              />
            )}
            {latestEntry && pendingFeedbackPrinciple && (
              <ExperienceFeedbackPrompt
                entry={latestEntry}
                language={language}
                principle={pendingFeedbackPrinciple}
                theme={theme}
                onFeedback={handleExperienceFeedback}
              />
            )}
            {latestEntry && (
              <section
                className="mobile-past-continuity"
                aria-label={language === 'zh' ? '记录闭环引导' : 'Record loop guidance'}
              >
                <div>
                  <span>{language === 'zh' ? '下一步' : 'Next step'}</span>
                  <strong>
                    {language === 'zh' ? '从记录中提炼可复用经验' : 'Distill reusable insight'}
                  </strong>
                  <p>
                    {language === 'zh'
                      ? `已有 ${distillableEntriesCount} 条素材可用，需要时再处理。`
                      : `${distillableEntriesCount} materials are ready when you are.`}
                  </p>
                </div>
                <button type="button" onClick={() => setSection('experience')}>
                  {language === 'zh' ? '去提炼' : 'Distill'}
                </button>
              </section>
            )}
            <div className="mobile-past-search-row">
              <label className="mobile-past-search">
                <Search className="h-4 w-4" />
                <input
                  value={timelineQuery}
                  onChange={(event) => setTimelineQuery(event.target.value)}
                  placeholder={
                    language === 'zh' ? '搜索标题 / 内容 / 标签' : 'Search title / content / tags'
                  }
                />
              </label>
              {onOpenAvatar && (
                <button
                  type="button"
                  className="mobile-past-ask-avatar"
                  onClick={() =>
                    onOpenAvatar({
                      mode: 'recall',
                      source: 'past-search',
                      query: timelineQuery.trim(),
                    })
                  }
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {language === 'zh' ? '问问过去' : 'Ask Past'}
                </button>
              )}
            </div>
            {timelineEntries.length === 0 ? (
              <p className="mobile-past-empty">
                {language === 'zh'
                  ? '还没有记录。请前往「现在」写入。'
                  : 'No records yet. Write in Now.'}
              </p>
            ) : (
              <ul className="mobile-past-timeline__list">
                {timelineEntries.map((entry, index) => (
                  <li key={entry.id}>
                    <MobilePastTimelineEntry
                      entry={entry}
                      highlight={index === 0}
                      language={language}
                      onSelect={onSelectEntry}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === 'experience' && (
          <div className="mobile-past-experience">
            <div
              className="mobile-past-subnav"
              role="tablist"
              aria-label={language === 'zh' ? '经验工作区' : 'Insight workspace'}
            >
              <button
                type="button"
                role="tab"
                aria-selected={experienceView === 'distill'}
                onClick={() => setExperienceView('distill')}
              >
                {language === 'zh' ? '待提炼' : 'To distill'}
                <small>{distillableEntriesCount}</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={experienceView === 'principles'}
                onClick={() => setExperienceView('principles')}
              >
                {language === 'zh' ? '原则库' : 'Principles'}
                <small>{principles.length}</small>
              </button>
            </div>
            {experienceView === 'distill' ? (
              <PastExperienceWorkbench
                language={language}
                theme={theme}
                entries={entries}
                principles={principles}
                now={now}
                onAddPrinciple={onAddPrinciple}
                onSelectEntry={onSelectEntry}
              />
            ) : (
              <ArchivePrinciplesView
                theme={theme}
                language={language}
                t={t}
                principles={principles}
                onAddPrinciple={onAddPrinciple}
                onDeletePrinciple={onDeletePrinciple}
                onUpdatePrinciple={onUpdatePrinciple}
              />
            )}
          </div>
        )}

        {section === 'archive' && (
          <div className="mobile-past-archive">
            <div className="mobile-past-archive__tools">
              <label className="mobile-past-search">
                <Search className="h-4 w-4" />
                <input
                  value={grouping.searchQuery}
                  onChange={(event) => grouping.setSearchQuery(event.target.value)}
                  placeholder={
                    language === 'zh' ? '搜索归档 / 标签 / 日期' : 'Search archive / tags / date'
                  }
                />
              </label>
              <button
                type="button"
                className={`mobile-past-filter ${showArchiveFilter ? 'mobile-past-filter--active' : ''}`}
                aria-label={language === 'zh' ? '打开归档筛选' : 'Open archive filters'}
                aria-pressed={showArchiveFilter}
                onClick={() => setShowArchiveFilter((current) => !current)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
            {showArchiveFilter && (
              <div className="mobile-past-filter-panel">
                <FilterHub
                  entries={grouping.archivedEntriesBase}
                  language={language}
                  theme={theme}
                  searchQuery={grouping.searchQuery}
                  onSearchChange={grouping.setSearchQuery}
                  selectedTag={grouping.selectedTag}
                  onSelectTag={grouping.setSelectedTag}
                  selectedCategory={grouping.selectedCategory}
                  onSelectCategory={grouping.setSelectedCategory}
                  containers={containers}
                  onAddContainer={onAddContainer}
                  onDeleteContainer={onDeleteContainer}
                  onClose={() => setShowArchiveFilter(false)}
                  accentColor="green"
                  groupingMode={grouping.groupingMode}
                  onGroupingModeChange={(mode) =>
                    grouping.setGroupingMode(mode === 'none' ? 'year' : mode)
                  }
                />
              </div>
            )}
            <div
              className="mobile-past-page__segments mobile-past-page__segments--compact"
              role="tablist"
            >
              {(
                [
                  { id: 'year', label: t.year },
                  { id: 'month', label: t.month },
                  { id: 'day', label: t.day },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={grouping.groupingMode === mode.id}
                  className={
                    grouping.groupingMode === mode.id ? 'mobile-past-page__segment--active' : ''
                  }
                  onClick={() => grouping.setGroupingMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <ArchiveVaultEntries
              theme={theme}
              t={t}
              groupingMode={grouping.groupingMode}
              groupKeys={grouping.groupKeys}
              groupedEntries={grouping.groupedEntries}
              now={now}
              onSelectEntry={onSelectEntry}
            />
          </div>
        )}
      </section>
    </main>
  );
};
