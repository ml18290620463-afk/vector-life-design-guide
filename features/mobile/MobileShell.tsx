import React from 'react';
import { MobileMainNav } from './MobileMainNav';
import type { MobileMainTab } from './types';

interface MobileShellProps {
  activeTab: MobileMainTab;
  onTabChange: (tab: MobileMainTab) => void;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({ activeTab, onTabChange, children }) => (
  <div className="mobile-shell" data-mobile-tab={activeTab}>
    <div className="mobile-shell__content">{children}</div>
    <MobileMainNav activeTab={activeTab} onTabChange={onTabChange} />
  </div>
);
