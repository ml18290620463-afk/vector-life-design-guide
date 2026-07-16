import React from 'react';
import type { MobileMainTab } from '../features/mobile/types';
import { getMainModules } from '../features/mobile/mainModules';
import type { Language } from '../types';

interface MainModuleGuideProps {
  language: Language;
  activeTab?: MobileMainTab;
  onNavigate: (tab: MobileMainTab) => void;
}

export const MainModuleGuide: React.FC<MainModuleGuideProps> = ({
  language,
  activeTab,
  onNavigate,
}) => (
  <section
    className="main-module-guide"
    aria-label={language === 'zh' ? '整体模块引导' : 'Main module guide'}
  >
    <div className="main-module-guide__head">
      <span>{language === 'zh' ? '整体框架' : 'Framework'}</span>
      <strong>
        {language === 'zh'
          ? '首页 → 密码解锁 → 过去 / 现在 / 未来 / 分身'
          : 'Home → Password unlock → Past / Now / Future / Avatar'}
      </strong>
    </div>
    <div className="main-module-guide__grid">
      {getMainModules(language).map(({ id, title, hint, Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            className={`main-module-guide__item ${active ? 'main-module-guide__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon className="main-module-guide__icon" />
            <span>{title}</span>
            <small>{hint}</small>
          </button>
        );
      })}
    </div>
  </section>
);
