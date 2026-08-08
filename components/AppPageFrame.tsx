import type { FC, ReactNode } from 'react';
import type { MobileMainTab } from '../features/mobile/types';
import type { Language } from '../types';
import { DesktopMainNav } from './DesktopMainNav';

type AppPageFrameProps = {
  children: ReactNode;
  variant?: 'default' | 'now' | 'avatar';
  className?: string;
  activeTab: MobileMainTab;
  language: Language;
  onNavigate: (tab: MobileMainTab) => void;
};

export const AppPageFrame: FC<AppPageFrameProps> = ({
  children,
  variant = 'default',
  className = '',
  activeTab,
  language,
  onNavigate,
}) => (
  <div
    className={[
      'desktop-main-module-frame',
      'app-page-transition',
      variant === 'now' || variant === 'avatar' ? 'desktop-main-module-frame--now' : '',
      variant === 'avatar' ? 'desktop-main-module-frame--avatar' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <DesktopMainNav activeTab={activeTab} language={language} onNavigate={onNavigate} />
    {children}
  </div>
);
