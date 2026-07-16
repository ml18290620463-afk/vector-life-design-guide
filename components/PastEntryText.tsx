import React, { useState } from 'react';
import type { DiaryEntry, Language, Theme } from '../types';
import { formatDateDots } from '../lib/dateFormat';
import {
  formatEntryTag,
  formatEntryTime,
  isGeneratedTimeTitle,
  splitEntryContent,
} from '../lib/entryContent';

type PastEntryTitleVariant = 'mobile' | 'archive-list' | 'archive-grid';
type PastEntryBodyVariant = 'mobile' | 'archive-list' | 'archive-grid';

interface PastEntryTitleProps {
  entry: DiaryEntry;
  variant: PastEntryTitleVariant;
  language?: Language;
  theme?: Theme;
  archiveId?: string;
}

interface PastEntryBodyProps {
  entry: DiaryEntry;
  variant: PastEntryBodyVariant;
  language?: Language;
  theme?: Theme;
}

interface PastEntryTagsProps {
  entry: DiaryEntry;
}

const TEXT_COLLAPSE_LIMIT = 200;

const getDisplayTitle = (entry: DiaryEntry, language: Language) =>
  entry.title || (language === 'zh' ? '未命名记录' : 'Untitled');

const CollapsibleRecordText: React.FC<{ text: string; language: Language }> = ({
  text,
  language,
}) => {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = text.length > TEXT_COLLAPSE_LIMIT;
  const visibleText = shouldCollapse && !expanded ? `${text.slice(0, TEXT_COLLAPSE_LIMIT)}…` : text;

  return (
    <>
      <p>{visibleText}</p>
      {shouldCollapse && (
        <button
          type="button"
          className="mobile-past-text-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? language === 'zh'
              ? '收起'
              : 'Collapse'
            : language === 'zh'
              ? '展开全文'
              : 'Read more'}
        </button>
      )}
    </>
  );
};

/**
 * Shared title / timestamp renderer for Past entry previews.
 *
 * Mobile timeline and archive cards keep their own visual class contracts, but
 * generated-title hiding, fallback titles and date formatting now live in one
 * place.
 */
export const PastEntryTitle: React.FC<PastEntryTitleProps> = ({
  entry,
  variant,
  language = 'zh',
  theme = 'dark',
  archiveId,
}) => {
  const title = getDisplayTitle(entry, language);
  const showTitle = title && !isGeneratedTimeTitle(title);

  if (variant === 'mobile') {
    return (
      <>
        <span className="mobile-past-timeline__time">{formatEntryTime(entry, language)}</span>
        {showTitle && <strong>{title}</strong>}
      </>
    );
  }

  if (variant === 'archive-list') {
    return (
      <div className="min-w-0 flex-1">
        <div
          className={`mb-1 font-mono text-[10px] opacity-50 ${
            theme === 'light' ? 'text-slate-500' : 'text-green-700'
          }`}
        >
          {formatDateDots(entry.createdAt)}
          {archiveId ? ` · ${archiveId}` : ''}
        </div>
        <h4
          className={`text-base font-bold leading-snug tracking-tight ${
            theme === 'light'
              ? 'text-vector-ink-strong group-hover/item:text-vector-cyan-brand'
              : 'text-cyan-100 group-hover/item:text-cyan-50'
          }`}
        >
          {title}
        </h4>
      </div>
    );
  }

  return (
    <h4
      className={`font-bold mb-2 tracking-tight text-sm ${
        theme === 'light'
          ? 'text-vector-ink-strong group-hover/item:text-vector-cyan-brand'
          : 'text-cyan-100 group-hover/item:text-cyan-50'
      }`}
    >
      {title}
    </h4>
  );
};

/**
 * Shared body renderer for Past entry previews. It strips the structured
 * material appendix once, so audio/link/image metadata never leaks into the
 * readable body on either mobile timeline or archive cards.
 */
export const PastEntryBody: React.FC<PastEntryBodyProps> = ({
  entry,
  variant,
  language = 'zh',
  theme = 'dark',
}) => {
  const { body } = splitEntryContent(entry.content);
  if (!body) return null;

  if (variant === 'mobile') {
    return (
      <div className="mobile-past-timeline__content">
        <CollapsibleRecordText text={body} language={language} />
      </div>
    );
  }

  return (
    <p
      className={`${variant === 'archive-grid' ? 'mt-3 ' : ''}whitespace-pre-wrap break-words text-sm leading-7 ${
        theme === 'light' ? 'text-slate-600' : 'text-slate-300'
      }`}
    >
      {body}
    </p>
  );
};

export const PastEntryTags: React.FC<PastEntryTagsProps> = ({ entry }) => {
  if (entry.tags.length === 0) return null;

  return (
    <div className="mobile-past-timeline__tags">
      {entry.tags.map((tag) => {
        const label = formatEntryTag(tag);
        return label ? <span key={tag}>{label}</span> : null;
      })}
    </div>
  );
};
