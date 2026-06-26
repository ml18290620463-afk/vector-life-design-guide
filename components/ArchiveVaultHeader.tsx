import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

export type ArchiveVaultView = 'vault' | 'principles';

interface ArchiveVaultHeaderProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  onBack: () => void;
}

/**
 * The ArchiveVault top header: a dedicated "Past" title block and
 * back affordance. Filtering and time grouping live below this header
 * so the archive page reads as search → time → record stream.
 *
 * Pulled out of `ArchiveVault.tsx` as part of Phase 2 §2.k.
 */
export const ArchiveVaultHeader: React.FC<ArchiveVaultHeaderProps> = ({
  theme,
  language,
  t,
  onBack,
}) => (
  <header className="archive-past-header">
    <div className="archive-past-header__rail">
      <button
        type="button"
        onClick={onBack}
        aria-label={t.backToConsole}
        className={`archive-past-back ${theme === 'light' ? 'archive-past-back--light' : ''}`}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    </div>
    <div className="archive-past-titleblock">
      <h1>{language === 'zh' ? '过去 · 记忆之舟' : 'Past · Memory Ark'}</h1>
      <p>{language === 'zh' ? '让经验可以被找回' : 'Make experience retrievable'}</p>
    </div>
  </header>
);
