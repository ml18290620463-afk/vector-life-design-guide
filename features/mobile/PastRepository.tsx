import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNowTick } from '../../hooks/useNowTick';
import { useArchiveGrouping } from '../../hooks/useArchiveGrouping';
import { TRANSLATIONS } from '../../constants';
import type { Container, DiaryEntry, Language, Principle, Theme } from '../../types';
import { ArchivePrinciplesView } from '../../components/ArchivePrinciplesView';
import { ArchiveVaultEntries } from '../../components/ArchiveVaultEntries';
import type { PastRepositorySection } from './types';

interface PastRepositoryProps {
  language: Language;
  theme?: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  onAddPrinciple: (text: string, year: number, showOnHome: boolean) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
  containers: Container[];
}

const SECTIONS: Array<{ id: PastRepositorySection; label: string }> = [
  { id: 'timeline', label: '时间线' },
  { id: 'principles', label: '原则' },
  { id: 'archive', label: '归档' },
];

export const PastRepository: React.FC<PastRepositoryProps> = ({
  language,
  theme = 'dark',
  entries,
  principles,
  onAddPrinciple,
  onDeletePrinciple,
  onUpdatePrinciple,
  onSelectEntry,
  containers,
}) => {
  const t = TRANSLATIONS[language];
  const [section, setSection] = useState<PastRepositorySection>('timeline');
  const [timelineQuery, setTimelineQuery] = useState('');

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

  const hasPendingTimeLock = useMemo(
    () =>
      archivedEntries.some(
        (entry) => typeof entry.unlockAt === 'number' && entry.unlockAt > Date.now(),
      ),
    [archivedEntries],
  );
  const now = useNowTick(hasPendingTimeLock);
  const grouping = useArchiveGrouping({ entries: archivedEntries });

  return (
    <main className="mobile-past-page" data-testid="past-page">
      <header className="mobile-past-page__header">
        <p className="mobile-past-page__eyebrow">
          {language === 'zh' ? 'VECTOR · 过去' : 'VECTOR · Past'}
        </p>
        <h1>{language === 'zh' ? '仓库' : 'Repository'}</h1>
        <p className="mobile-past-page__subtitle">
          {language === 'zh' ? '时间线 · 原则 · 归档' : 'Timeline · Principles · Archive'}
        </p>
      </header>

      <div
        className="mobile-past-page__segments"
        role="tablist"
        aria-label={language === 'zh' ? '过去分区' : 'Past sections'}
      >
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={section === item.id ? 'mobile-past-page__segment--active' : ''}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="mobile-past-page__body">
        {section === 'timeline' && (
          <div className="mobile-past-timeline">
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
            {timelineEntries.length === 0 ? (
              <p className="mobile-past-empty">
                {language === 'zh'
                  ? '还没有记录。请前往「现在」写入。'
                  : 'No records yet. Write in Now.'}
              </p>
            ) : (
              <ul className="mobile-past-timeline__list">
                {timelineEntries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="mobile-past-timeline__item"
                      onClick={() => onSelectEntry(entry)}
                    >
                      <span className="mobile-past-timeline__time">
                        {new Date(entry.createdAt).toLocaleString(
                          language === 'zh' ? 'zh-CN' : 'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}
                      </span>
                      <strong>
                        {entry.title || (language === 'zh' ? '未命名记录' : 'Untitled')}
                      </strong>
                      <p>
                        {entry.content.slice(0, 96) ||
                          (language === 'zh' ? '（无正文）' : '(empty)')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === 'principles' && (
          <ArchivePrinciplesView
            theme={theme}
            t={t}
            principles={principles}
            onAddPrinciple={onAddPrinciple}
            onDeletePrinciple={onDeletePrinciple}
            onUpdatePrinciple={onUpdatePrinciple}
          />
        )}

        {section === 'archive' && (
          <div className="mobile-past-archive">
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
