import React, { useMemo, useState } from 'react';
import { DiaryEntry, Language, Theme } from '../types';

/**
 * 「未来」克莱因空间（移动端 MVP：垂直流动版）。
 *
 * 三层自然衔接，无硬分区：
 *   照见层  —— AI 以「我注意到…」呈现模式与探测到的需求/张力（镜子，不下定义）
 *   转化层  —— 从某条照见生成「轻量实验清单」（可验证、可撤回的探针，不是目标）
 *   反馈层  —— 勾选实验后给出「已回应」反馈，结果回流到「现在/过去」
 *
 * 注意：本组件目前用本地占位逻辑生成照见，方便先打通界面流。
 * 接入真实 AI 时，把 `useMemo(buildIlluminations)` 替换为后端/服务返回的数据即可。
 */

export interface Illumination {
  id: string;
  observation: string;
  detections: string[];
  quote?: string;
}

export interface Experiment {
  id: string;
  fromIllumination: string;
  action: string;
  duration: string;
  done: boolean;
}

export interface FutureKleinViewProps {
  entries: DiaryEntry[];
  language: Language;
  theme: Theme;
  /** 进入「现在」记录（用于把实验结果写回去） */
  onNewEntry: () => void;
  /** 接入真实 AI 时由上层注入；不传则使用本地占位 */
  illuminations?: Illumination[];
  onGenerateExperiments?: (illuminationId: string) => Experiment[] | void;
}

const COPY: Partial<Record<Language, Record<string, string>>> = {
  zh: {
    subtitle: '经验曲面 · 照见模式，孵化小实验',
    empty: '还没有足够的记录。先去「现在」写几条，未来会从中照见你的模式。',
    illuminate: '照见',
    genExp: '生成实验（试探）',
    listTitle: '轻量实验清单',
    expHint: '勾选后，照见会显示「已回应」。结果可写回「现在」，沉淀到「过去」。',
    noExp: '从上方照见生成极小实验。它们是可验证、可撤回的探针，不是目标。',
    responded: '已回应',
    writeBack: '把结果写到现在',
  },
  en: {
    subtitle: 'Experience surface · see patterns, hatch tiny experiments',
    empty: 'Not enough entries yet. Capture a few in “Now” and patterns will surface here.',
    illuminate: 'Noticed',
    genExp: 'Make an experiment',
    listTitle: 'Light experiment list',
    expHint: 'Once checked, the illumination shows “responded”. Write the result back to Now.',
    noExp:
      'Generate tiny experiments from an illumination above. They are reversible probes, not goals.',
    responded: 'responded',
    writeBack: 'Write result to Now',
  },
};

/** 占位：从最近的记录里粗略提炼一条「照见」。真实版本由 AI 产出。 */
function buildIlluminations(entries: DiaryEntry[], lang: Language): Illumination[] {
  if (!entries.length) return [];
  const recent = [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  const sample = recent[0];
  const quote = sample.content.slice(0, 48).trim();
  if (lang === 'en') {
    return [
      {
        id: 'local-1',
        observation:
          'You’ve returned to a similar theme several times recently — it may be worth a closer look.',
        detections: ['Possible recurring need', 'Energy seems tied to certain moments'],
        quote: quote ? `“${quote}…”` : undefined,
      },
    ];
  }
  return [
    {
      id: 'local-1',
      observation: '你最近多次回到相似的主题，这背后可能藏着一个还没被命名的需求。',
      detections: ['可能的隐性需求', '能量似乎与某类情境相关'],
      quote: quote ? `「${quote}…」` : undefined,
    },
  ];
}

export const FutureKleinView: React.FC<FutureKleinViewProps> = ({
  entries,
  language,
  onNewEntry,
  illuminations,
  onGenerateExperiments,
}) => {
  const t = COPY[language] ?? COPY.zh;
  const derived = useMemo(
    () => illuminations ?? buildIlluminations(entries, language),
    [illuminations, entries, language],
  );
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [responded, setResponded] = useState<Set<string>>(new Set());

  const generate = (illumId: string) => {
    const fromHost = onGenerateExperiments?.(illumId);
    if (Array.isArray(fromHost)) {
      setExperiments((prev) => [...prev, ...fromHost]);
      return;
    }
    const fallback: Experiment = {
      id: 'exp-' + Date.now(),
      fromIllumination: illumId,
      action:
        language === 'en'
          ? 'This week, deliberately create one small moment around this theme and note how it feels.'
          : '这周围绕这个主题，主动制造一个很小的场景，记录下当时的感受。',
      duration: language === 'en' ? '1× this week' : '本周 1 次',
      done: false,
    };
    setExperiments((prev) => [...prev, fallback]);
  };

  const toggle = (exp: Experiment) => {
    setExperiments((prev) => prev.map((e) => (e.id === exp.id ? { ...e, done: !e.done } : e)));
    setResponded((prev) => {
      const next = new Set(prev);
      next.add(exp.fromIllumination);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-24">
      <div className="mb-4 text-sm text-[color:var(--foreground)]/60">{t.subtitle}</div>

      {derived.length === 0 && (
        <div className="py-16 text-center text-sm text-[color:var(--foreground)]/40">{t.empty}</div>
      )}

      {derived.map((illum) => (
        <div
          key={illum.id}
          className="mb-5 rounded-3xl border border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2 text-[13px] text-[color:var(--foreground)]/50">
            <span>{t.illuminate}</span>
            {responded.has(illum.id) && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                {t.responded}
              </span>
            )}
          </div>

          <div className="mb-3 text-[15px] leading-snug">{illum.observation}</div>

          {illum.quote && (
            <div className="mb-2 inline-block rounded bg-[color:var(--foreground)]/5 px-2 py-1 text-xs text-[color:var(--foreground)]/70">
              {illum.quote}
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-1">
            {illum.detections.map((d, i) => (
              <span
                key={i}
                className="rounded bg-[color:var(--foreground)]/10 px-2 py-0.5 text-[11px] text-[color:var(--foreground)]/70"
              >
                {d}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => generate(illum.id)}
            className="rounded-2xl bg-[color:var(--foreground)] px-4 py-2 text-sm text-[var(--background)] active:opacity-90"
          >
            {t.genExp}
          </button>
        </div>
      ))}

      {experiments.length > 0 ? (
        <div className="mt-2 mb-6">
          <div className="mb-2 pl-1 text-sm text-[color:var(--foreground)]/60">{t.listTitle}</div>
          {experiments.map((exp) => (
            <label
              key={exp.id}
              className="mb-3 flex items-start gap-3 rounded-2xl border border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/5 p-3 active:bg-[color:var(--foreground)]/10"
            >
              <input
                type="checkbox"
                checked={exp.done}
                onChange={() => toggle(exp)}
                className="mt-1 h-4 w-4 accent-[color:var(--foreground)]"
              />
              <div className={`text-sm leading-snug ${exp.done ? 'line-through opacity-60' : ''}`}>
                {exp.action}
                <div className="mt-0.5 text-[11px] text-[color:var(--foreground)]/40">
                  {exp.duration}
                </div>
              </div>
            </label>
          ))}
          <div className="flex items-center justify-between pl-1">
            <span className="text-[11px] text-[color:var(--foreground)]/40">{t.expHint}</span>
            <button
              type="button"
              onClick={onNewEntry}
              className="shrink-0 rounded-full border border-[color:var(--foreground)]/20 px-3 py-1.5 text-xs active:bg-[color:var(--foreground)]/10"
            >
              {t.writeBack}
            </button>
          </div>
        </div>
      ) : (
        derived.length > 0 && (
          <div className="pl-1 text-xs text-[color:var(--foreground)]/40">{t.noExp}</div>
        )
      )}
    </div>
  );
};

export default FutureKleinView;
