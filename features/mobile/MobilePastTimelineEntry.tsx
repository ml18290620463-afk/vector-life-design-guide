import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { DiaryEntry, Language } from '../../types';
import { PastEntryMedia } from '../../components/PastEntryMedia';
import { PastEntryBody, PastEntryTags, PastEntryTitle } from '../../components/PastEntryText';
import { splitEntryContent } from '../../lib/entryContent';

interface MobilePastTimelineEntryProps {
  entry: DiaryEntry;
  highlight?: boolean;
  language: Language;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export const MobilePastTimelineEntry: React.FC<MobilePastTimelineEntryProps> = ({
  entry,
  highlight = false,
  language,
  selectionMode = false,
  selected = false,
  onToggleSelection,
}) => {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const date = new Date(entry.createdAt);
  const dateTime = Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  const dateLabel = Number.isNaN(date.getTime())
    ? entry.title
    : date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
  const body = splitEntryContent(entry.content).body;
  const contentRef = useRef<HTMLDivElement>(null);
  const [canExpand, setCanExpand] = useState(body.length > 100 || body.split('\n').length > 3);
  useEffect(() => {
    const paragraph = contentRef.current?.querySelector('p');
    if (!paragraph) return;
    const measure = () => {
      if (expanded || !paragraph.clientHeight) return;
      setCanExpand(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(paragraph);
    return () => observer?.disconnect();
  }, [body, expanded]);

  return (
    <article
      data-expanded={expanded}
      className={`mobile-past-timeline__item past-record ${highlight ? 'mobile-past-timeline__item--latest' : ''} ${selectionMode ? 'mobile-past-timeline__item--selecting' : ''} ${selected ? 'mobile-past-timeline__item--selected' : ''}`}
    >
      {selectionMode && (
        <button
          type="button"
          className="mobile-past-timeline__checkbox"
          role="checkbox"
          aria-checked={selected}
          aria-label={
            language === 'zh' ? `选择${entry.title || '记录'}` : `Select ${entry.title || 'record'}`
          }
          onClick={() => onToggleSelection?.(entry.id)}
        >
          {selected && <Check aria-hidden="true" />}
        </button>
      )}
      <div className="mobile-past-timeline__reading-column">
        <div className="mobile-past-timeline__summary-row">
          <div className="mobile-past-timeline__summary-title">
            <time className="past-record__date" dateTime={dateTime}>
              {dateLabel}
            </time>
            <PastEntryTitle
              entry={entry}
              variant="mobile"
              language={language}
              showTimestamp={false}
            />
          </div>
          {!selectionMode && canExpand && (
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
          )}
        </div>
        <div ref={contentRef} id={contentId} className="mobile-past-timeline__fold-content">
          <PastEntryBody
            entry={entry}
            variant="mobile"
            language={language}
            expanded={expanded}
            showToggle={false}
          />
          <PastEntryTags entry={entry} />
          <PastEntryMedia entry={entry} variant="mobile" language={language} />
        </div>
      </div>
    </article>
  );
};
