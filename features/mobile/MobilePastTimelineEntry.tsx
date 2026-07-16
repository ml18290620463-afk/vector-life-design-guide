import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { DiaryEntry, Language } from '../../types';
import { PastEntryPreview } from '../../components/PastEntryPreview';

interface MobilePastTimelineEntryProps {
  entry: DiaryEntry;
  highlight?: boolean;
  language: Language;
  onSelect?: (entry: DiaryEntry) => void;
}

export const MobilePastTimelineEntry: React.FC<MobilePastTimelineEntryProps> = ({
  entry,
  highlight = false,
  language,
  onSelect,
}) => (
  <article
    className={`mobile-past-timeline__item ${highlight ? 'mobile-past-timeline__item--latest' : ''}`}
  >
    {highlight && (
      <span className="mobile-past-timeline__latest-badge">
        {language === 'zh' ? '最新写入' : 'Latest'}
      </span>
    )}
    {onSelect ? (
      <button
        type="button"
        className="mobile-past-timeline__open"
        onClick={() => onSelect(entry)}
        aria-label={`${language === 'zh' ? '查看记录' : 'Open entry'} ${entry.title}`}
      >
        <span>{language === 'zh' ? '查看详情' : 'View details'}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    ) : null}
    <PastEntryPreview entry={entry} variant="mobile" language={language} />
  </article>
);
