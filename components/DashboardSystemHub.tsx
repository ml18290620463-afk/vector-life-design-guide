import React from 'react';
import { Database, Download, Settings, ShieldCheck } from 'lucide-react';
import type { Language, Theme } from '../types';

interface DashboardSystemHubProps {
  activeEntriesCount: number;
  archivedEntriesCount: number;
  language: Language;
  onOpenSettings: () => void;
  theme: Theme;
  totalEntriesCount: number;
}

type HubAction = {
  id: string;
  title: string;
  body: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
};

export const DashboardSystemHub: React.FC<DashboardSystemHubProps> = ({
  activeEntriesCount,
  archivedEntriesCount,
  language,
  onOpenSettings,
  theme,
  totalEntriesCount,
}) => {
  const isZh = language === 'zh';
  const mutedClass = theme === 'light' ? 'text-slate-500' : 'text-cyan-100/55';
  const cardClass =
    theme === 'light'
      ? 'border-slate-200 bg-white/80 text-slate-700 hover:border-cyan-300 hover:bg-white shadow-sm'
      : 'border-cyan-900/35 bg-slate-950/60 text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-950/20 shadow-[0_18px_60px_rgba(0,0,0,0.22)]';

  const actions: HubAction[] = [
    {
      id: 'status',
      title: isZh ? '记录状态' : 'Record status',
      body: isZh
        ? '这里只显示全局记录计数；真正的时间线、蒸馏、原则和归档统一进入 Past。'
        : 'This hub shows global counts only. Timeline, distillation, principles and archive live in Past.',
      meta: isZh ? `${totalEntriesCount} 条记录` : `${totalEntriesCount} records`,
      icon: Database,
    },
    {
      id: 'settings',
      title: isZh ? '系统设置' : 'System settings',
      body: isZh
        ? '主题、语言、身份、安全、自定义锚点和授权集中在这里。'
        : 'Theme, language, identity, security, custom anchors and license live here.',
      meta: isZh ? '系统治理' : 'Governance',
      icon: Settings,
      onClick: onOpenSettings,
    },
    {
      id: 'backup',
      title: isZh ? '备份与安全' : 'Backup & security',
      body: isZh
        ? '普通备份、导入、Notes 下载、扫描修复与数据清除仍由设置中心承载。'
        : 'Backup export/import, notes download, scan/repair and wipe flows stay in settings.',
      meta: isZh ? '轻量备份' : 'Light backup',
      icon: ShieldCheck,
      onClick: onOpenSettings,
    },
    {
      id: 'security',
      title: isZh ? '安全与恢复' : 'Security & recovery',
      body: isZh
        ? '主密码、恢复流程、扫描修复和数据清除集中在设置中心。'
        : 'Master password, recovery, scan/repair and wipe flows stay in settings.',
      meta: isZh ? '本地治理' : 'Local governance',
      icon: ShieldCheck,
      onClick: onOpenSettings,
    },
  ];

  return (
    <section
      className={`dashboard-system-hub mb-5 rounded-xl border p-5 ${
        theme === 'light'
          ? 'border-slate-200/80 bg-white/65 shadow-sm'
          : 'border-white/[0.07] bg-slate-950/45'
      }`}
      aria-label={isZh ? '系统中心' : 'System hub'}
      data-testid="dashboard-system-hub"
    >
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={`mb-2 text-[10px] font-mono uppercase tracking-[0.28em] ${mutedClass}`}>
            {isZh ? 'VECTOR · 系统治理' : 'VECTOR · System governance'}
          </p>
          <h3
            className={`text-2xl font-semibold tracking-tight ${
              theme === 'light' ? 'text-slate-900' : 'text-cyan-50'
            }`}
          >
            {isZh ? '管理本地数据与运行状态' : 'Manage local data and system status'}
          </h3>
          <p className={`mt-2 max-w-3xl text-sm leading-7 ${mutedClass}`}>
            {isZh
              ? '这里仅承载设置、备份、安全、授权与全局状态。记录、回顾和行动不在系统中心重复出现。'
              : 'This area only contains settings, backup, security, licensing and global status. Capture, review and action are not duplicated here.'}
          </p>
        </div>
        <div
          className={`grid grid-cols-3 gap-2 rounded-lg border p-3 text-center ${
            theme === 'light'
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-cyan-900/30 bg-black/20 text-cyan-100/70'
          }`}
        >
          <div>
            <strong className="block text-lg text-current">{totalEntriesCount}</strong>
            <span className="text-[9px] uppercase tracking-widest">{isZh ? '总计' : 'Total'}</span>
          </div>
          <div>
            <strong className="block text-lg text-current">{activeEntriesCount}</strong>
            <span className="text-[9px] uppercase tracking-widest">
              {isZh ? '活跃' : 'Active'}
            </span>
          </div>
          <div>
            <strong className="block text-lg text-current">{archivedEntriesCount}</strong>
            <span className="text-[9px] uppercase tracking-widest">
              {isZh ? '归档' : 'Archived'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ id, title, body, meta, icon: Icon, onClick }) => {
          const CardTag = onClick ? 'button' : 'div';
          return (
          <CardTag
            key={id}
            type={onClick ? 'button' : undefined}
            className={`group rounded-lg border p-4 text-left transition-all duration-300 ${cardClass}`}
            onClick={onClick}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <Icon className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className={`text-[9px] uppercase tracking-[0.2em] ${mutedClass}`}>{meta}</span>
            </div>
            <strong className="block text-sm">{title}</strong>
            <p className={`mt-2 text-xs leading-6 ${mutedClass}`}>{body}</p>
          </CardTag>
          );
        })}
      </div>

      <div
        className={`mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-xs leading-6 ${
          theme === 'light'
            ? 'border-cyan-100 bg-cyan-50/60 text-cyan-900'
            : 'border-cyan-500/15 bg-cyan-500/5 text-cyan-100/70'
        }`}
      >
        <Download className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {isZh
            ? '备份仍在设置中心：点击“备份与安全”即可导出 Star Map、导入 JSON 或下载 Notes。'
            : 'Backup stays in settings: use Backup & security to export Star Map, import JSON or download Notes.'}
        </p>
      </div>
    </section>
  );
};
