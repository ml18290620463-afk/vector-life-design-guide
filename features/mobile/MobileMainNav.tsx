import React from 'react';
import { Archive, Bot, Clock3, Sparkles } from 'lucide-react';
import type { MobileMainTab } from './types';

interface MobileMainNavProps {
  activeTab: MobileMainTab;
  onTabChange: (tab: MobileMainTab) => void;
}

const TABS: Array<{
  id: MobileMainTab;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'past', label: '过去', hint: '仓库', Icon: Archive },
  { id: 'now', label: '现在', hint: '写入', Icon: Clock3 },
  { id: 'future', label: '未来', hint: '转化', Icon: Sparkles },
  { id: 'avatar', label: '分身', hint: '协助', Icon: Bot },
];

export const MobileMainNav: React.FC<MobileMainNavProps> = ({ activeTab, onTabChange }) => (
  <nav className="mobile-main-nav" aria-label="主框架导航">
    {TABS.map(({ id, label, hint, Icon }) => {
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
          <span className="mobile-main-nav__label">{label}</span>
          <span className="mobile-main-nav__hint">{hint}</span>
        </button>
      );
    })}
  </nav>
);
