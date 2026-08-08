import type { FC } from 'react';
import { getMainModules } from '../features/mobile/mainModules';
import type { MobileMainTab } from '../features/mobile/types';
import type { Language } from '../types';

type DesktopMainNavProps = {
  activeTab: MobileMainTab;
  language: Language;
  onNavigate: (tab: MobileMainTab) => void;
};

export const DesktopMainNav: FC<DesktopMainNavProps> = ({ activeTab, language, onNavigate }) => (
  <nav
    className="desktop-main-nav"
    aria-label={language === 'zh' ? '主页面导航' : 'Main page navigation'}
  >
    {getMainModules(language).map(({ id, title, Icon }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          className={`desktop-main-nav__item ${isActive ? 'desktop-main-nav__item--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon aria-hidden="true" />
          <span>{title}</span>
        </button>
      );
    })}
  </nav>
);
