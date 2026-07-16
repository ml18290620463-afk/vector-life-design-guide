import React from 'react';
import { getMainModules } from './mainModules';
import type { Language } from '../../types';
import type { MobileMainTab } from './types';

interface MobileMainNavProps {
  activeTab: MobileMainTab;
  language: Language;
  onTabChange: (tab: MobileMainTab) => void;
}

export const MobileMainNav: React.FC<MobileMainNavProps> = ({
  activeTab,
  language,
  onTabChange,
}) => (
  <nav className="mobile-main-nav" aria-label="主框架导航">
    {getMainModules(language).map(({ id, title, hint, Icon }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          className={`mobile-main-nav__item ${isActive ? 'mobile-main-nav__item--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onTabChange(id)}
        >
          <Icon className="mobile-main-nav__icon" />
          <span className="mobile-main-nav__label">{title}</span>
          <span className="mobile-main-nav__hint">{hint}</span>
        </button>
      );
    })}
  </nav>
);
