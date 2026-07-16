import type { FC } from 'react';
import type { Language } from '../types';
import { TRANSLATIONS } from '../constants';

export const ScreenLoader: FC<{ language: Language }> = ({ language }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <div className="font-mono text-cyan-500 text-xs tracking-widest animate-pulse uppercase">
        {TRANSLATIONS[language].restoringLink}
      </div>
    </div>
  </div>
);
