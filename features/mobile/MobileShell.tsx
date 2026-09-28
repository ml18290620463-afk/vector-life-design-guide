import React, { useEffect, useRef } from 'react';
import { getMainModules } from './mainModules';
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

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.add('mobile-product-active');
    body.classList.add('mobile-product-active');
    root.dataset.mobileProductTab = activeTab;
    body.dataset.mobileProductTab = activeTab;

    return () => {
      root.classList.remove('mobile-product-active');
      body.classList.remove('mobile-product-active');
      delete root.dataset.mobileProductTab;
      delete body.dataset.mobileProductTab;
    };
  }, [activeTab]);

  return (
    <div className="mobile-shell" data-mobile-tab={activeTab}>
      <h1 className="mobile-shell__accessible-title">
        {getMainModules(language).find((item) => item.id === activeTab)?.title}
      </h1>
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
