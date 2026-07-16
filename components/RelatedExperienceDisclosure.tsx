import { useState, type FC } from 'react';
import { ChevronDown, Link2 } from 'lucide-react';
import type { DiaryEntry, Language, Theme } from '../types';

type RelatedExperienceDisclosureProps = {
  entry: DiaryEntry;
  language: Language;
  onSelectEntry: (entry: DiaryEntry) => void;
  relatedEntries: DiaryEntry[];
  theme: Theme;
};

const summarize = (content: string): string => {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact;
};

export const RelatedExperienceDisclosure: FC<RelatedExperienceDisclosureProps> = ({
  entry,
  language,
  onSelectEntry,
  relatedEntries,
  theme,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isZh = language === 'zh';
  const panelId = `related-experiences-${entry.id}`;

  if (relatedEntries.length === 0) return null;

  return (
    <section
      className={`related-experiences ${theme === 'light' ? 'related-experiences--light' : ''}`}
      aria-label={isZh ? '保存后的关联经验' : 'Related experiences after saving'}
    >
      <button
        type="button"
        className="related-experiences__toggle"
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <Link2 aria-hidden="true" className="h-4 w-4" />
        <span>
          {isZh
            ? `已关联到过去 ${relatedEntries.length} 条经验`
            : `Linked to ${relatedEntries.length} past experiences`}
        </span>
        <small>{isZh ? '按需查看' : 'Explore when useful'}</small>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 ${expanded ? 'related-experiences__chevron--expanded' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="related-experiences__list">
          {relatedEntries.map((relatedEntry) => (
            <button
              key={relatedEntry.id}
              type="button"
              onClick={() => onSelectEntry(relatedEntry)}
              aria-label={
                isZh
                  ? `查看关联经验 ${relatedEntry.title}`
                  : `Open related experience ${relatedEntry.title}`
              }
            >
              <span>
                {new Date(relatedEntry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}
              </span>
              <strong>{relatedEntry.title}</strong>
              <small>{summarize(relatedEntry.content)}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
