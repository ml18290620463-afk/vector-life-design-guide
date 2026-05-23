import React from 'react';
import { Maximize, Minimize, Archive } from 'lucide-react';
import { Language, Theme } from '../types';
import { CyberButton } from './CyberButton';
import { TRANSLATIONS } from '../constants';

type SyncStatus = 'synced' | 'local-only' | 'error' | 'merging' | 'mirror-skipped';

interface DashboardHeaderProps {
  theme: Theme;
  language: Language;
  dynamicVersion: string;
  isFullscreen: boolean;
  onOpenArchive: () => void;
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
  dynamicVersion,
  isFullscreen,
  onOpenArchive,
  toggleFullScreen,
  syncStatus,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header
      className={`flex flex-col md:flex-row justify-between items-end mb-16 pb-6 relative gap-8 border-b border-white/[0.03]`}
    >
      <div className="w-full md:w-auto">
        <div className="flex items-baseline gap-3 mb-2">
          <h2
            className={`text-3xl sm:text-5xl font-black tracking-tighter uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}
            style={{ letterSpacing: '-0.05em' }}
          >
            {t.appTitle}
          </h2>
          <span
            className={`text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-1 border ${theme === 'light' ? 'text-slate-400 border-slate-200 bg-white shadow-sm' : 'text-cyan-500/80 border-cyan-500/20 bg-cyan-500/5'}`}
          >
            {dynamicVersion}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p
            className={`text-[10px] font-mono tracking-[0.3em] uppercase opacity-60 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}
          >
            {t.archiveStatus}
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
      <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
        <button
          onClick={toggleFullScreen}
          className={`p-2 border transition-all rounded-sm group relative w-12 h-12 flex items-center justify-center ${theme === 'light' ? 'border-slate-200 text-slate-400 hover:text-slate-900 bg-white' : 'border-white/10 text-slate-500 hover:text-white hover:border-white/20 hover:bg-white/5'}`}
          title={t.toggleFullscreen}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        <CyberButton
          data-testid="dashboard-open-archive"
          onClick={onOpenArchive}
          variant="ghost"
          className="text-[10px] tracking-[0.2em] h-12 px-6"
          theme={theme}
        >
          <Archive className="w-4 h-4 mr-2" /> {t.archive}
        </CyberButton>
      </div>
    </header>
  );
};
