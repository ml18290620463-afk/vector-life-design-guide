import type { FC } from 'react';
import { getMainModules } from '../features/mobile/mainModules';
import type { MobileMainTab } from '../features/mobile/types';
import type { Language } from '../types';
import { SilkNavIcon } from './silk/SilkNavIcons';

type DesktopMainNavProps = {
  activeTab: MobileMainTab;
  language: Language;
  onNavigate: (tab: MobileMainTab) => void;
  onNavigateIntent?: (tab: MobileMainTab) => void;
};

export const DesktopMainNav: FC<DesktopMainNavProps> = ({
  activeTab,
  language,
  onNavigate,
  onNavigateIntent,
}) => (
  <nav
    className="desktop-main-nav v-sidebar"
    aria-label={language === 'zh' ? '主页面导航' : 'Main page navigation'}
  >
    <div className="desktop-main-nav__brand" aria-label="VECTOR">
      V<span>VECTOR</span>
    </div>
    <div className="desktop-main-nav__links">
      {getMainModules(language).map(({ id, title }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`desktop-main-nav__item ${isActive ? 'desktop-main-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            onMouseEnter={() => onNavigateIntent?.(id)}
            onFocus={() => onNavigateIntent?.(id)}
            onTouchStart={() => onNavigateIntent?.(id)}
          >
            <SilkNavIcon name={id} />
            <span>{title}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
