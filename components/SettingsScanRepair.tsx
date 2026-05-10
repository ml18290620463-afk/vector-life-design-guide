import React from 'react';
import { motion } from 'motion/react';
import { RefreshCcw } from 'lucide-react';
import type { Language, Theme } from '../types';
import type { TranslationDictionary } from '../i18n/translations';

interface ScanSummary {
  status: 'success' | 'error';
  finishedAt: number;
  mergedEntries: number;
  mergedPrinciples: number;
  mergedContainers: number;
  error?: string;
}

interface SettingsScanRepairProps {
  theme: Theme;
  language: Language;
  t: TranslationDictionary;
  isScanning?: boolean;
  scanProgress?: number;
  lastScanSummary?: ScanSummary | null;
  /** Trigger a fresh scan; the parent decides whether to also show a
   *  confirmation modal. */
  onTriggerScan?: () => Promise<unknown>;
}

const SCAN_PROMPT_ZH = '这将启动数据深度扫描程序，可能需要几秒钟。确定吗？';
const SCAN_PROMPT_EN = 'This will start a deep data scan, which may take a few seconds. Continue?';

/**
 * "Data scan & repair" widget shown inside the Storage section of the
 * Settings drawer. Pulled out of `SettingsPanel.tsx` as part of Phase
 * 2 §2.j. The scan workflow itself lives in the parent (App / Dashboard)
 * — this component only renders state + relays the click.
 */
export const SettingsScanRepair: React.FC<SettingsScanRepairProps> = ({
  theme,
  language,
  t,
  isScanning,
  scanProgress,
  lastScanSummary,
  onTriggerScan,
}) => (
  <div
    className={`p-4 rounded-xl border flex flex-col gap-4 ${theme === 'light' ? 'bg-cyan-50/20 border-cyan-100' : 'bg-cyan-950/10 border-cyan-900/30'}`}
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <RefreshCcw className={`w-5 h-5 text-cyan-500 ${isScanning ? 'animate-spin' : ''}`} />
        <div className="flex flex-col">
          <span
            className={`text-xs font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-cyan-100'}`}
          >
            {language === 'zh' ? '数据扫描与修复' : 'Scan & Repair'}
          </span>
          <span
            className={`text-[9px] opacity-60 ${theme === 'light' ? 'text-slate-500' : 'text-cyan-700'}`}
          >
            {language === 'zh'
              ? '重新扫描丢失的历史记录并整合到统一存储'
              : 'Rescan legacy data and merge into unified vault'}
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          if (isScanning) return;
          if (confirm(language === 'zh' ? SCAN_PROMPT_ZH : SCAN_PROMPT_EN)) {
            onTriggerScan?.();
          }
        }}
        disabled={isScanning}
        className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${isScanning ? 'opacity-50 cursor-wait border-cyan-900 text-cyan-800' : theme === 'light' ? 'border-cyan-200 text-cyan-600 hover:bg-cyan-100' : 'border-cyan-900 text-cyan-500 hover:border-cyan-400 hover:text-cyan-400'}`}
      >
        {isScanning
          ? language === 'zh'
            ? '正在扫描'
            : 'SCANNING'
          : language === 'zh'
            ? '执行扫描'
            : 'EXECUTE'}
      </button>
    </div>

    {isScanning && (
      <div className="space-y-2 animate-in fade-in duration-300">
        <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-cyan-500">
          <span>{language === 'zh' ? '正在解析时空节点' : 'Parsing temporal nodes'}...</span>
          <span>{scanProgress}%</span>
        </div>
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-cyan-950'}`}
        >
          <motion.div
            className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${scanProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    )}

    {!isScanning && lastScanSummary && (
      <div
        role="status"
        className={`text-[10px] font-mono leading-relaxed flex flex-col gap-1 ${
          lastScanSummary.status === 'success' ? 'text-cyan-500/80' : 'text-rose-500'
        }`}
      >
        {lastScanSummary.status === 'success' ? (
          <span>
            {(
              t.scanSummarySuccess ??
              'Last scan merged {entries} entries · {principles} principles · {containers} containers.'
            )
              .replace('{entries}', String(lastScanSummary.mergedEntries))
              .replace('{principles}', String(lastScanSummary.mergedPrinciples))
              .replace('{containers}', String(lastScanSummary.mergedContainers))}
          </span>
        ) : (
          <>
            <span>{t.scanSummaryFailed ?? 'Last scan failed; data was not modified.'}</span>
            <button
              type="button"
              onClick={() => onTriggerScan?.()}
              className="self-start mt-1 px-2 py-1 rounded border border-rose-500/50 text-rose-500 text-[9px] uppercase tracking-widest hover:bg-rose-500/10"
            >
              {t.scanRetry ?? 'Retry scan'}
            </button>
          </>
        )}
      </div>
    )}
  </div>
);
