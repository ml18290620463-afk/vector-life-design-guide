import React from 'react';
import { getMainModules } from './mainModules';
import type { Language } from '../../types';
import type { MobileMainTab } from './types';
import { SilkNavIcon } from '../../components/silk/SilkNavIcons';

interface MobileMainNavProps {
  activeTab: MobileMainTab;
  language: Language;
  onTabChange: (tab: MobileMainTab) => void;
  onTabIntent?: (tab: MobileMainTab) => void;
}

export const MobileMainNav: React.FC<MobileMainNavProps> = ({
  activeTab,
  language,
  onTabChange,
  onTabIntent,
}) => (
  <nav
    className="mobile-main-nav m-dock"
    aria-label={language === 'zh' ? '主页面导航' : 'Main page navigation'}
  >
    {getMainModules(language).map(({ id, title }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          className={`mobile-main-nav__item ${isActive ? 'mobile-main-nav__item--active' : ''}`}
          aria-label={title}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onTabChange(id)}
          onTouchStart={() => onTabIntent?.(id)}
          onFocus={() => onTabIntent?.(id)}
        >
          <SilkNavIcon name={id} className="mobile-main-nav__icon" />
          <span className="mobile-main-nav__label">{title}</span>
        </button>
      );
    })}
  </nav>
);
