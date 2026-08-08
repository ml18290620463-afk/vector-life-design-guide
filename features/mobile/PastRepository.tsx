import React, { useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { TRANSLATIONS } from '../../constants';
import type { DiaryEntry, Language, Principle, PrincipleApplication, Theme } from '../../types';
import { ArchivePrinciplesView } from '../../components/ArchivePrinciplesView';
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
    application?: PrincipleApplication,
  ) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (principle: Principle) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
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
  onOpenAvatar,
}) => {
  const t = TRANSLATIONS[language];
  const [section, setSection] = useState<PastRepositorySection>('timeline');
  const [timelineQuery, setTimelineQuery] = useState('');
  const normalizedTimelineQuery = timelineQuery.trim();
  const hasTimelineQuery = normalizedTimelineQuery.length > 0;

  const timelineEntries = useMemo(() => {
    const active = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const query = normalizedTimelineQuery.toLowerCase();
    if (!query) return active;
    return active.filter(
      (entry) =>
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [entries, normalizedTimelineQuery]);

  const sections = [
    {
      id: 'timeline' as const,
      label: language === 'zh' ? '记录' : 'Records',
      detail: timelineEntries.length,
    },
    {
      id: 'experience' as const,
      label: language === 'zh' ? '原则' : 'Principles',
      detail: principles.length,
    },
  ];

  return (
    <main className="mobile-past-page" data-testid="past-page">
      <header className="mobile-past-page__header">
        <p className="mobile-past-page__eyebrow">
          {language === 'zh' ? '经验资产' : 'Experience library'}
        </p>
        <div className="mobile-past-page__heading-row">
          <div>
            <h1>{language === 'zh' ? '过去' : 'Past'}</h1>
            <p className="mobile-past-page__subtitle">
              {language === 'zh'
                ? '回看发生过的事，把可复用的判断留下来。'
                : 'Review what happened and keep the judgments worth reusing.'}
            </p>
          </div>
          <dl
            className="mobile-past-page__overview"
            aria-label={language === 'zh' ? '过去概览' : 'Past overview'}
          >
            <div>
              <dt>{language === 'zh' ? '记录' : 'Records'}</dt>
              <dd>{entries.length}</dd>
            </div>
            <div>
              <dt>{language === 'zh' ? '原则' : 'Principles'}</dt>
              <dd>{principles.length}</dd>
            </div>
          </dl>
        </div>
      </header>
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
                  onChange={(event) => setTimelineQuery(event.target.value)}
                  placeholder={
                    language === 'zh' ? '搜索标题 / 内容 / 标签' : 'Search title / content / tags'
                  }
                />
                {timelineQuery.length > 0 && (
                  <button
                    type="button"
                    className="mobile-past-search__clear"
                    aria-label={language === 'zh' ? '清除搜索' : 'Clear search'}
                    onClick={() => setTimelineQuery('')}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              {onOpenAvatar && (
                <button
                  type="button"
                  className="mobile-past-ask-avatar"
                  onClick={() =>
                    onOpenAvatar({
                      mode: 'recall',
                      source: 'past-search',
                      query: normalizedTimelineQuery,
                    })
                  }
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>{language === 'zh' ? '问问过去' : 'Ask Past'}</span>
                </button>
              )}
            </div>
            {timelineEntries.length === 0 ? (
              <p className="mobile-past-empty" role="status" aria-live="polite">
                {hasTimelineQuery
                  ? language === 'zh'
                    ? '没有找到相关记录。'
                    : 'No matching records found.'
                  : language === 'zh'
                    ? '还没有记录。请前往「现在」写入。'
                    : 'No records yet. Write in Now.'}
              </p>
            ) : (
              <ul className="mobile-past-timeline__list">
                {timelineEntries.map((entry, index) => (
                  <li key={entry.id}>
                    <MobilePastTimelineEntry
                      entry={entry}
                      highlight={!hasTimelineQuery && index === 0}
                      language={language}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === 'experience' && (
          <div className="mobile-past-experience">
            <ArchivePrinciplesView
              theme={theme}
              language={language}
              t={t}
              principles={principles}
              onAddPrinciple={onAddPrinciple}
              onDeletePrinciple={onDeletePrinciple}
              onUpdatePrinciple={onUpdatePrinciple}
            />
          </div>
        )}
      </section>
    </main>
  );
};
