import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { APP_VERSION } from '../constants';

type SyncStatus = 'synced' | 'local-only' | 'error' | 'merging' | 'mirror-skipped';

interface DashboardHeaderProps {
  theme: Theme;
  language: Language;
  isFullscreen: boolean;
  toggleFullScreen: () => void;
  syncStatus?: SyncStatus;
}

interface SyncBadgeContent {
  label: string;
  tone: 'normal' | 'warn' | 'error';
}

const buildSyncBadge = (status: SyncStatus | undefined, language: Language): SyncBadgeContent => {
  const isZh = language === 'zh';
  switch (status) {
    case 'mirror-skipped':
      return {
        label: isZh ? '本地镜像已跳过' : 'Backup mirror skipped',
        tone: 'warn',
      };
    case 'error':
      return {
        label: isZh ? '同步异常' : 'Sync error',
        tone: 'error',
      };
    case 'merging':
      return {
        label: isZh ? '正在合并' : 'Merging…',
        tone: 'normal',
      };
    case 'local-only':
      return {
        label: isZh ? '本地存档' : 'Local Only',
        tone: 'normal',
      };
    case 'synced':
    default:
      return {
        label: isZh ? '同步活跃' : 'Sync Active',
        tone: 'normal',
      };
  }
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  theme,
  language,
  isFullscreen,
  toggleFullScreen,
  syncStatus,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header
      className={`vector-dashboard-header flex flex-col md:flex-row justify-between items-start md:items-end relative gap-5 border-b ${theme === 'light' ? 'border-slate-200/80' : 'border-white/[0.06]'}`}
    >
      <div className="w-full md:w-auto">
        <div className="flex items-baseline gap-3 mb-2">
          <h2
            className={`vector-dashboard-title text-3xl sm:text-4xl font-black uppercase ${theme === 'light' ? 'text-slate-950' : 'text-slate-50'}`}
          >
            {language === 'zh' ? '系统中心' : 'System Center'}
          </h2>
          <span
            className={`text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-1 border rounded-md ${theme === 'light' ? 'text-slate-500 border-slate-200 bg-white shadow-sm' : 'text-cyan-300/80 border-cyan-500/20 bg-cyan-500/5'}`}
          >
            v{APP_VERSION}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p
            className={`text-[10px] font-mono tracking-[0.24em] uppercase opacity-70 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {language === 'zh'
              ? '设置 · 备份 · 安全 · 全局状态'
              : 'Settings · Backup · Security · Global status'}
          </p>
          <div className={`h-[1px] w-24 ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />
          {(() => {
            const badge = buildSyncBadge(syncStatus, language);
            const dotClass =
              badge.tone === 'error'
                ? 'bg-rose-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-rose-500)_70%,_transparent)]'
                : badge.tone === 'warn'
                  ? 'bg-amber-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-amber-500)_70%,_transparent)]'
                  : theme === 'light'
                    ? 'bg-emerald-500'
                    : 'bg-cyan-500 shadow-[0_0_8px_color-mix(in_srgb,_var(--color-cyan-500)_80%,_transparent)]';
            const labelClass =
              badge.tone === 'error'
                ? 'text-rose-500'
                : badge.tone === 'warn'
                  ? 'text-amber-500'
                  : 'opacity-80';
            return (
              <div
                className={`flex items-center gap-1.5 ${badge.tone === 'normal' ? 'animate-pulse' : ''}`}
                role="status"
                aria-label={badge.label}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span className={`text-[9px] font-mono uppercase tracking-widest ${labelClass}`}>
                  {badge.label}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 w-full md:w-auto justify-start md:justify-end">
        <button
          onClick={toggleFullScreen}
          className={`p-2 border transition-all rounded-md group relative w-11 h-11 flex items-center justify-center ${theme === 'light' ? 'border-slate-200 text-slate-500 hover:text-slate-900 bg-white' : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5'}`}
          title={t.toggleFullscreen}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};
