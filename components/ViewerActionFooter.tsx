import React from 'react';
import { Download, Flame, Share2, Sparkles } from 'lucide-react';
import { Theme } from '../types';
import { TranslationDictionary } from '../i18n/translations';
import { CyberButton } from './CyberButton';

interface ViewerActionFooterProps {
  theme: Theme;
  t: TranslationDictionary;
  onDownload: () => void;
  onRequestBurn: () => void;
  /** Phase 3 §3.h — open the share-card preview / export modal.
   *  Optional so legacy callers compile without modification. */
  onShareCard?: () => void;
  onOpenAvatar?: () => void;
}

export const ViewerActionFooter: React.FC<ViewerActionFooterProps> = ({
  theme,
  t,
  onDownload,
  onRequestBurn,
  onShareCard,
  onOpenAvatar,
}) => (
  <div
    className={`mt-12 pt-6 border-t flex flex-col gap-4 relative z-20 ${theme === 'light' ? 'border-[color-mix(in_srgb,_var(--color-vector-cyan-brand)_5%,_transparent)]' : 'border-cyan-900/30'}`}
  >
    {onOpenAvatar && (
      <div className="flex justify-center">
        <CyberButton
          variant="ghost"
          onClick={onOpenAvatar}
          theme={theme}
          className={`min-w-[280px] py-3 border font-serif text-sm tracking-[0.2em] ${theme === 'light' ? 'border-violet-200 text-violet-700 hover:bg-violet-50' : 'border-violet-800/60 text-violet-300 hover:bg-violet-950/30'}`}
        >
          <Sparkles className="w-4 h-4 mr-3" aria-hidden="true" />
          帮我整理
        </CyberButton>
      </div>
    )}
    <div className="grid grid-cols-2 gap-3 md:gap-4 font-mono">
      <CyberButton
        variant="ghost"
        onClick={onDownload}
        theme={theme}
        className={`w-full border py-2 text-[11px] ${theme === 'light' ? 'border-vector-cyan-brand/20 text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'border-cyan-900/50 text-cyan-600 hover:bg-cyan-950/20'}`}
      >
        <Download className="w-4 h-4 mr-1 md:mr-2" /> {t.downloadNote}
      </CyberButton>

      <CyberButton
        variant="danger"
        onClick={onRequestBurn}
        theme={theme}
        className="w-full py-2 text-[11px]"
      >
        <Flame className="w-4 h-4 mr-1 md:mr-2" /> {t.burnMessage}
      </CyberButton>
    </div>

    {onShareCard && (
      <div className="flex justify-center">
        <CyberButton
          variant="ghost"
          onClick={onShareCard}
          theme={theme}
          className={`min-w-[260px] py-2 text-[11px] tracking-[0.2em] ${theme === 'light' ? 'border-vector-cyan-brand/20 text-vector-cyan-brand hover:bg-vector-cyan-brand/5' : 'border-cyan-900/50 text-cyan-500 hover:bg-cyan-950/20'} border`}
          aria-label={t.shareCardOpen ?? t.shareCardTitle ?? 'Share card'}
        >
          <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {t.shareCardOpen ?? t.shareCardTitle ?? 'Share card'}
        </CyberButton>
      </div>
    )}
  </div>
);
