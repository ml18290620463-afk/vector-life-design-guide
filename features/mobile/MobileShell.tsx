import React, { useEffect, useRef } from 'react';
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

const MOBILE_TAB_ORDER: MobileMainTab[] = ['past', 'now', 'future', 'avatar'];

export const MobileShell: React.FC<MobileShellProps> = ({
  activeTab,
  language,
  onTabChange,
  children,
}) => {
  const previousTabRef = useRef(activeTab);
  const previousIndex = MOBILE_TAB_ORDER.indexOf(previousTabRef.current);
  const activeIndex = MOBILE_TAB_ORDER.indexOf(activeTab);
  const transitionDirection = activeIndex >= previousIndex ? 'forward' : 'back';

  useEffect(() => {
    previousTabRef.current = activeTab;
  }, [activeTab]);

  return (
    <div className="mobile-shell" data-mobile-tab={activeTab}>
      {activeTab === 'future' && (
        <button
          type="button"
          className="mobile-shell__back"
          aria-label={language === 'zh' ? '返回过去' : 'Back to Past'}
          onClick={() => onTabChange('past')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <div
        key={activeTab}
        className={`mobile-shell__content mobile-shell__content--${transitionDirection}`}
        data-transition-direction={transitionDirection}
      >
        {children}
      </div>
      <MobileMainNav activeTab={activeTab} language={language} onTabChange={onTabChange} />
    </div>
  );
};
