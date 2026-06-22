import React, { useCallback, useMemo, useState } from 'react';
import type { DiaryEntry, Language, Theme } from '../types';
import { GrowthPulseCard } from './GrowthPulseCard';
import { getStoredJson, setStoredJson } from '../services/browserStorage';

/**
 * 「未来」克莱因空间（移动端 MVP：垂直流动版）。
 *
 * 三层自然衔接，无硬分区：
 *   照见层  —— 从真实记录中合成模式（高频主题 / 记录节奏 / 时段规律 / 里程碑），
 *              永远以「我注意到…」呈现，是镜子而非定义。
 *   转化层  —— 从某条照见生成「轻量实验清单」（可验证、可撤回的探针，不是目标），
 *              本地持久化，可勾选、可删除。
 *   反馈层  —— 完成实验后给出回应，并引导把结果写回「现在」，沉淀到「过去」。
 *
 * 数据全部来自传入的 `entries`，不依赖 AI 也能给出真实可用的模块；
 * 接入 AI 时把 `illuminations` 作为受控输入传入即可覆盖本地推导。
 */

const STORAGE_KEY = 'vector.future.experiments.v1';
const dayMs = 24 * 60 * 60 * 1000;

export interface Illumination {
  id: string;
  observation: string;
  detections: string[];
  quote?: string;
  suggestedAction: string;
  suggestedDuration: string;
}

export interface Experiment {
  id: string;
  fromIllumination: string;
  action: string;
  duration: string;
  done: boolean;
  createdAt: number;
}

export interface FutureKleinViewProps {
  entries: DiaryEntry[];
  language: Language;
  theme: Theme;
  /** 进入「现在」记录（把实验结果写回去） */
  onNewEntry: () => void;
  /** 接入真实 AI 时由上层注入；不传则使用本地推导 */
  illuminations?: Illumination[];
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** 当前连续记录天数（从今天或昨天往前数） */
function computeStreak(entries: DiaryEntry[]): number {
  if (!entries.length) return 0;
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  let streak = 0;
  const cursor = new Date();
  // 允许从「昨天」起算，避免今天还没记录就显示 0
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setTime(cursor.getTime() - dayMs);
  }
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setTime(cursor.getTime() - dayMs);
  }
  return streak;
}

/** 从真实记录推导照见。无记录返回空数组。 */
function deriveIlluminations(entries: DiaryEntry[], isZh: boolean): Illumination[] {
  if (!entries.length) return [];
  const out: Illumination[] = [];
  const now = Date.now();

  // 1) 高频主题（标签）
  const tagCount = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags ?? []) {
      const c = tag.trim();
      if (!c || c === 'upload' || c === 'material') continue;
      tagCount.set(c, (tagCount.get(c) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCount.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  if (topTags.length) {
    out.push({
      id: 'theme',
      observation: isZh
        ? `我注意到你反复回到这些主题：${topTags.map((t) => '#' + t).join('  ')}。`
        : `You keep returning to these themes: ${topTags.map((t) => '#' + t).join('  ')}.`,
      detections: [
        isZh
          ? '可能是你当前最投入、或最被牵动的领域'
          : 'Likely where your attention or tension concentrates',
      ],
      suggestedAction: isZh
        ? `这周就主题「${topTags[0]}」做一个很小的相关尝试，并记录当下的感受。`
        : `This week, run one tiny experiment around “${topTags[0]}” and note how it feels.`,
      suggestedDuration: isZh ? '本周 1 次' : '1× this week',
    });
  }

  // 2) 记录节奏 / 连续天数
  const streak = computeStreak(entries);
  const in7 = entries.filter((e) => now - e.createdAt <= 7 * dayMs).length;
  if (streak >= 2 || in7 >= 2) {
    out.push({
      id: 'cadence',
      observation: isZh
        ? streak >= 2
          ? `你已经连续 ${streak} 天在记录，最近 7 天写了 ${in7} 条。`
          : `最近 7 天你写了 ${in7} 条，节奏正在形成。`
        : streak >= 2
          ? `You've recorded ${streak} days in a row, ${in7} entries in the last 7 days.`
          : `${in7} entries in the last 7 days — a rhythm is forming.`,
      detections: [
        isZh
          ? '稳定的节律会让你更容易看见自己的变化'
          : 'A steady rhythm makes change easier to notice',
      ],
      suggestedAction: isZh
        ? '给自己定一个极小的记录锚点：固定时刻写一句话即可。'
        : 'Set a tiny anchor: one sentence at a fixed moment each day.',
      suggestedDuration: isZh ? '连续 3 天' : '3 days in a row',
    });
  }

  // 3) 时段规律
  const buckets = [0, 0, 0, 0]; // 凌晨/上午/下午/晚上
  for (const e of entries) {
    const h = new Date(e.createdAt).getHours();
    if (h < 6) buckets[0] += 1;
    else if (h < 12) buckets[1] += 1;
    else if (h < 18) buckets[2] += 1;
    else buckets[3] += 1;
  }
  const labelsZh = ['深夜', '上午', '下午', '晚上'];
  const labelsEn = ['late night', 'morning', 'afternoon', 'evening'];
  const domIdx = buckets.indexOf(Math.max(...buckets));
  if (entries.length >= 4) {
    out.push({
      id: 'timeofday',
      observation: isZh
        ? `你大多在「${labelsZh[domIdx]}」记录。`
        : `You mostly record in the ${labelsEn[domIdx]}.`,
      detections: [
        isZh ? '这往往是你回看自己、最坦诚的时刻' : 'Often your most honest, reflective window',
      ],
      suggestedAction: isZh
        ? `在「${labelsZh[domIdx]}」之外，挑一个不同时段记录一次，看看会写出什么不一样的东西。`
        : `Try recording once outside the ${labelsEn[domIdx]} and see what surfaces differently.`,
      suggestedDuration: isZh ? '本周 1 次' : '1× this week',
    });
  }

  // 4) 里程碑
  if (entries.length >= 10) {
    out.push({
      id: 'milestone',
      observation: isZh
        ? `你已经积累了 ${entries.length} 条经验。它们足够开始照见一些更长线的线索了。`
        : `You've gathered ${entries.length} entries — enough to surface longer-range threads.`,
      detections: [
        isZh
          ? '把跨越数周的记录连起来，常能看见自己没察觉的取向'
          : 'Connecting weeks of notes reveals unnoticed leanings',
      ],
      suggestedAction: isZh
        ? '回看最早的 3 条记录，对照现在，写下一句「我变了 / 没变」的地方。'
        : 'Revisit your first 3 entries and write one line on what changed (or didn’t).',
      suggestedDuration: isZh ? '一次回看' : 'One review',
    });
  }

  return out;
}

export const FutureKleinView: React.FC<FutureKleinViewProps> = ({
  entries,
  language,
  theme,
  onNewEntry,
  illuminations,
}) => {
  const isZh = language === 'zh';
  const isLight = theme === 'light';

  const derived = useMemo(
    () => illuminations ?? deriveIlluminations(entries, isZh),
    [illuminations, entries, isZh],
  );

  const [experiments, setExperiments] = useState<Experiment[]>(
    () => getStoredJson<Experiment[]>(STORAGE_KEY) ?? [],
  );

  const persist = useCallback((next: Experiment[]) => {
    setExperiments(next);
    setStoredJson(STORAGE_KEY, next);
  }, []);

  const addExperiment = (illum: Illumination) => {
    const exp: Experiment = {
      id: 'exp-' + Date.now(),
      fromIllumination: illum.id,
      action: illum.suggestedAction,
      duration: illum.suggestedDuration,
      done: false,
      createdAt: Date.now(),
    };
    persist([exp, ...experiments]);
  };

  const toggle = (id: string) =>
    persist(experiments.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));

  const remove = (id: string) => persist(experiments.filter((e) => e.id !== id));

  const doneCount = experiments.filter((e) => e.done).length;

  const cardBase = isLight
    ? 'bg-white/80 border-slate-200 text-slate-700'
    : 'bg-black/30 border-cyan-900/40 text-cyan-100/85';
  const accentBtn = isLight
    ? 'bg-slate-900 text-white active:bg-slate-700'
    : 'bg-cyan-400/90 text-black active:bg-cyan-300';
  const ghostBtn = isLight
    ? 'border border-slate-300 text-slate-600 active:bg-slate-100'
    : 'border border-cyan-900/50 text-cyan-100/80 active:bg-cyan-900/20';

  // 空状态：还没有任何记录
  if (entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pt-10 pb-28 text-center">
        <div className="text-4xl mb-4">🔮</div>
        <div className={`text-base mb-2 ${isLight ? 'text-slate-700' : 'text-cyan-100/90'}`}>
          {isZh ? '未来从你的记录里生长出来' : 'The future grows from what you record'}
        </div>
        <p className={`text-sm mb-6 ${isLight ? 'text-slate-500' : 'text-cyan-100/50'}`}>
          {isZh
            ? '先去「现在」写下几条经验，这里就会照见你的模式，并孵化可验证的小实验。'
            : 'Capture a few entries in “Now”, then patterns will surface here and hatch tiny, testable experiments.'}
        </p>
        <button
          type="button"
          onClick={onNewEntry}
          className={`rounded-2xl px-5 py-3 text-sm font-medium ${accentBtn}`}
        >
          {isZh ? '去现在记录第一条' : 'Record your first entry'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-28">
      <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-cyan-100/55'}`}>
        {isZh
          ? '经验曲面 · 照见模式，孵化小实验'
          : 'Experience surface · see patterns, hatch tiny experiments'}
      </div>

      {/* 反馈层：成长脉冲（记录≥3条时显示） */}
      <GrowthPulseCard entries={entries} theme={theme} language={language} />

      {/* 照见层 */}
      <div
        className={`mb-2 text-xs font-mono uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-cyan-100/40'}`}
      >
        {isZh ? '照见' : 'Illuminations'}
      </div>
      {derived.length === 0 && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${cardBase}`}>
          {isZh
            ? '再多记录几条，这里就会浮现你反复出现的主题与节奏。'
            : 'Add a few more entries and your recurring themes & rhythm will surface here.'}
        </div>
      )}
      {derived.map((illum) => {
        const responded = experiments.some((e) => e.fromIllumination === illum.id && e.done);
        const used = experiments.some((e) => e.fromIllumination === illum.id);
        return (
          <div key={illum.id} className={`mb-4 rounded-2xl border p-4 ${cardBase}`}>
            {responded && (
              <span className="mb-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                {isZh ? '已回应' : 'responded'}
              </span>
            )}
            <div className="mb-3 text-[15px] leading-snug">{illum.observation}</div>
            {illum.quote && (
              <div
                className={`mb-2 inline-block rounded px-2 py-1 text-xs ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}
              >
                {illum.quote}
              </div>
            )}
            <div className="mb-3 flex flex-wrap gap-1">
              {illum.detections.map((d, i) => (
                <span
                  key={i}
                  className={`rounded px-2 py-0.5 text-[11px] ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-cyan-100/70'}`}
                >
                  {d}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addExperiment(illum)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${accentBtn}`}
            >
              {used
                ? isZh
                  ? '再生成一个实验'
                  : 'Add another experiment'
                : isZh
                  ? '生成实验（试探）'
                  : 'Make an experiment'}
            </button>
          </div>
        );
      })}

      {/* 转化层：轻量实验清单 */}
      <div
        className={`mt-6 mb-2 flex items-center justify-between text-xs font-mono uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-cyan-100/40'}`}
      >
        <span>{isZh ? '轻量实验清单' : 'Light experiments'}</span>
        {experiments.length > 0 && (
          <span>
            {isZh
              ? `${doneCount}/${experiments.length} 已完成`
              : `${doneCount}/${experiments.length} done`}
          </span>
        )}
      </div>
      {experiments.length === 0 ? (
        <div className={`rounded-xl border p-4 text-xs ${cardBase}`}>
          {isZh
            ? '从上方照见生成极小实验。它们是可验证、可撤回的探针，不是目标。'
            : 'Generate tiny experiments from an illumination above. They are reversible probes, not goals.'}
        </div>
      ) : (
        <>
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className={`mb-3 flex items-start gap-3 rounded-2xl border p-3 ${cardBase}`}
            >
              <input
                type="checkbox"
                checked={exp.done}
                onChange={() => toggle(exp.id)}
                className="mt-1 h-4 w-4 accent-emerald-500"
                aria-label={isZh ? '标记完成' : 'mark done'}
              />
              <div
                className={`flex-1 text-sm leading-snug ${exp.done ? 'line-through opacity-60' : ''}`}
              >
                {exp.action}
                <div
                  className={`mt-0.5 text-[11px] ${isLight ? 'text-slate-400' : 'text-cyan-100/40'}`}
                >
                  {exp.duration}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(exp.id)}
                className={`shrink-0 text-[11px] ${isLight ? 'text-slate-400 active:text-slate-600' : 'text-cyan-100/40 active:text-cyan-100/70'}`}
                aria-label={isZh ? '删除' : 'remove'}
              >
                {isZh ? '删除' : 'remove'}
              </button>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-cyan-100/40'}`}>
              {isZh
                ? '做完后把感受写回「现在」，会沉淀到「过去」。'
                : 'Write the result back to “Now”; it settles into “Past”.'}
            </span>
            <button
              type="button"
              onClick={onNewEntry}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${ghostBtn}`}
            >
              {isZh ? '把结果写到现在' : 'Write result to Now'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FutureKleinView;
