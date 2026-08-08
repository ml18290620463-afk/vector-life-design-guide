import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DiaryEntry, Language } from '../../types';
import { PastEntryMedia } from '../../components/PastEntryMedia';
import { PastEntryBody, PastEntryTags, PastEntryTitle } from '../../components/PastEntryText';

interface MobilePastTimelineEntryProps {
  entry: DiaryEntry;
  highlight?: boolean;
  language: Language;
}

export const MobilePastTimelineEntry: React.FC<MobilePastTimelineEntryProps> = ({
  entry,
  highlight = false,
  language,
}) => {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const date = new Date(entry.createdAt);
  const dateTime = Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  const dateLabel = Number.isNaN(date.getTime())
    ? entry.title
    : date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: language === 'zh' ? 'long' : 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <article
      className={`mobile-past-timeline__item ${highlight ? 'mobile-past-timeline__item--latest' : ''}`}
    >
      <time className="mobile-past-timeline__navigator" dateTime={dateTime} aria-label={dateLabel}>
        <span>{Number.isNaN(date.getTime()) ? '--' : date.getFullYear()}</span>
        <strong>
          {Number.isNaN(date.getTime())
            ? '--.--'
            : `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`}
        </strong>
        <small>
          {Number.isNaN(date.getTime())
            ? '--:--'
            : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
        </small>
      </time>

      <div className="mobile-past-timeline__reading-column">
        {highlight && (
          <span className="mobile-past-timeline__latest-badge">
            {language === 'zh' ? '最新写入' : 'Latest'}
          </span>
        )}
        <div className="mobile-past-timeline__summary-row">
          <div className="mobile-past-timeline__summary-title">
            <PastEntryTitle entry={entry} variant="mobile" language={language} />
          </div>
          <button
            type="button"
            className="mobile-past-timeline__fold"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-label={
              expanded
                ? language === 'zh'
                  ? '收起记录内容'
                  : 'Collapse record content'
                : language === 'zh'
                  ? '展开记录内容'
                  : 'Expand record content'
            }
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        <div id={contentId} className="mobile-past-timeline__fold-content">
          <PastEntryBody
            entry={entry}
            variant="mobile"
            language={language}
            expanded={expanded}
            showToggle={false}
          />
          <PastEntryMedia entry={entry} variant="mobile" language={language} />
          {expanded && (
            <div className="mobile-past-timeline__fold-details">
              <PastEntryTags entry={entry} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
