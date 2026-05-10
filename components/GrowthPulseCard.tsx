import React, { useMemo } from 'react';
import type { DiaryEntry, Theme } from '../types';

interface GrowthPulseCardProps {
  entries: readonly DiaryEntry[];
  theme: Theme;
  language: 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'es' | 'de';
}

const dayMs = 24 * 60 * 60 * 1000;

const parseAnalysisText = (raw?: string): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { content?: unknown };
    return typeof parsed.content === 'string' ? parsed.content : raw;
  } catch {
    return raw;
  }
};

export const GrowthPulseCard: React.FC<GrowthPulseCardProps> = ({ entries, theme, language }) => {
  const isZh = language === 'zh';
  const metrics = useMemo(() => {
    const now = Date.now();
    const in30 = entries.filter((entry) => now - entry.createdAt <= 30 * dayMs);
    const in7 = entries.filter((entry) => now - entry.createdAt <= 7 * dayMs);
    const tagCount = new Map<string, number>();
    let analysisHits = 0;
    for (const entry of in30) {
      for (const tag of entry.tags ?? []) {
        const cleaned = tag.trim();
        if (!cleaned) continue;
        tagCount.set(cleaned, (tagCount.get(cleaned) ?? 0) + 1);
      }
      const text = parseAnalysisText(entry.morningStarAnalysis);
      if (text) analysisHits += 1;
    }
    const topTag =
      Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      (isZh ? '未形成主题' : 'No dominant theme');
    return {
      in30: in30.length,
      in7: in7.length,
      topTag,
      analysisHits,
    };
  }, [entries, isZh]);

  if (entries.length < 3) return null;

  return (
    <section
      className={`mb-6 border rounded-xl p-4 ${theme === 'light' ? 'bg-white/80 border-slate-200 text-slate-700' : 'bg-black/30 border-cyan-900/40 text-cyan-100/85'}`}
      data-testid="growth-pulse-card"
    >
      <p className="text-[11px] font-mono uppercase tracking-widest opacity-80">
        {isZh ? '近况复盘（最近30天）' : 'Recent pulse (last 30 days)'}
      </p>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
        <p>{isZh ? `记录次数：${metrics.in30}` : `Entries: ${metrics.in30}`}</p>
        <p>{isZh ? `最近7天：${metrics.in7}` : `Last 7 days: ${metrics.in7}`}</p>
        <p>{isZh ? `高频主题：${metrics.topTag}` : `Top theme: ${metrics.topTag}`}</p>
      </div>
      <p className="mt-2 text-xs opacity-70">
        {isZh
          ? `启明星回信覆盖 ${metrics.analysisHits} 条记录。继续保持节律，你会更容易看见自己的变化。`
          : `Morning Star replies covered ${metrics.analysisHits} entries. Keep a steady rhythm to make your growth easier to see.`}
      </p>
    </section>
  );
};
