import React from 'react';
import { Lock } from 'lucide-react';
import type { DiaryEntry, Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';
import { PastEntryMedia } from './PastEntryMedia';
import { PastEntryBody, PastEntryTags, PastEntryTitle } from './PastEntryText';

type PastEntryPreviewVariant = 'mobile' | 'archive-list' | 'archive-grid';

interface PastEntryPreviewProps {
  entry: DiaryEntry;
  variant: PastEntryPreviewVariant;
  archiveId?: string;
  isTimeLocked?: boolean;
  language?: Language;
  sampleBadge?: React.ReactNode;
  t?: TranslationDictionary;
  theme?: Theme;
}

/**
 * Shared record-preview composition for Past surfaces.
 *
 * `PastEntryText` owns title/body/tag rules, `PastEntryMedia` owns media and
 * legacy material compatibility, and this component defines the ordering for
 * each surface variant. Outer shells still own their platform-specific chrome:
 * mobile timeline item, archive list row, archive grid card, hover scanners,
 * locks and animations.
 */
export const PastEntryPreview: React.FC<PastEntryPreviewProps> = ({
  entry,
  variant,
  archiveId,
  isTimeLocked = false,
  language = 'zh',
  sampleBadge,
  t,
  theme = 'dark',
}) => {
  if (variant === 'mobile') {
    return (
      <>
        <PastEntryTitle entry={entry} variant="mobile" language={language} />
        <PastEntryBody entry={entry} variant="mobile" language={language} />
        <PastEntryMedia entry={entry} variant="mobile" language={language} />
        <PastEntryTags entry={entry} />
      </>
    );
  }

  if (variant === 'archive-list') {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PastEntryTitle
            entry={entry}
            variant="archive-list"
            theme={theme}
            archiveId={archiveId}
          />
          {sampleBadge}
        </div>

        <PastEntryMedia entry={entry} variant="archive" theme={theme} compact />
        <PastEntryBody entry={entry} variant="archive-list" theme={theme} />

        {isTimeLocked && (
          <div className="flex items-center gap-1.5 text-vector-magenta transition-colors neon-glow-alert">
            <Lock className="w-3 h-3" />
            <span className="text-[9px] font-bold tracking-tighter uppercase px-1 border border-vector-magenta/30 neon-border-alert">
              {t?.encryptedRecord || 'RESTRICTED'}
            </span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PastEntryTitle entry={entry} variant="archive-grid" theme={theme} />
      <PastEntryMedia entry={entry} variant="archive" theme={theme} />
      <PastEntryBody entry={entry} variant="archive-grid" theme={theme} />
    </>
  );
};
