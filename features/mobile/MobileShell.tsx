import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { MobileMainNav } from './MobileMainNav';
import type { Language } from '../../types';
import type { MobileMainTab } from './types';

interface MobileShellProps {
  activeTab: MobileMainTab;
  language: Language;
  onTabChange: (tab: MobileMainTab) => void;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  activeTab,
  language,
  onTabChange,
  children,
}) => (
  <div className="mobile-shell" data-mobile-tab={activeTab}>
    {activeTab === 'future' && (
      <button
        type="button"
        className="mobile-shell__back"
        aria-label="返回过去"
        onClick={() => onTabChange('past')}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    )}
    <div className="mobile-shell__content">{children}</div>
    {activeTab === 'past' && (
      <MobileMainNav activeTab={activeTab} language={language} onTabChange={onTabChange} />
    )}
  </div>
);
