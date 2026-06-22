import React from 'react';
import { AppState, Language } from '../types';

/**
 * 移动端专用底部三入口导航：过去 / 现在 / 未来。
 * 仅在 DASHBOARD / EDITOR / FUTURE 三个状态、且为移动视口时渲染。
 * 通过 setAppState 驱动现有状态机：
 *   过去 → DASHBOARD（时间线/储存）
 *   现在 → EDITOR（记录）
 *   未来 → FUTURE（克莱因空间）
 */
export interface MobileTabBarProps {
  appState: AppState;
  language: Language;
  onGoPast: () => void;
  onGoPresent: () => void;
  onGoFuture: () => void;
}

const LABELS: Partial<Record<Language, { past: string; present: string; future: string }>> = {
  zh: { past: '过去', present: '现在', future: '未来' },
  en: { past: 'Past', present: 'Now', future: 'Future' },
};

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  appState,
  language,
  onGoPast,
  onGoPresent,
  onGoFuture,
}) => {
  const t = LABELS[language] ?? LABELS.zh!;

  const tabs = [
    {
      key: 'past',
      label: t.past,
      icon: '📜',
      active: appState === AppState.DASHBOARD,
      onClick: onGoPast,
    },
    {
      key: 'present',
      label: t.present,
      icon: '✍️',
      active: appState === AppState.EDITOR,
      onClick: onGoPresent,
    },
    {
      key: 'future',
      label: t.future,
      icon: '🔮',
      active: appState === AppState.FUTURE,
      onClick: onGoFuture,
    },
  ] as const;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-[color:var(--foreground)]/10 bg-[var(--background)]/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={tab.onClick}
          aria-current={tab.active ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-[color:var(--foreground)]/5 ${
            tab.active ? 'text-[color:var(--foreground)]' : 'text-[color:var(--foreground)]/45'
          }`}
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          <span className="text-[11px] tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default MobileTabBar;
