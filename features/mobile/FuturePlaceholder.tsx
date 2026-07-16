import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, Sparkles, TrendingUp } from 'lucide-react';
import type { DiaryEntry, Language, Principle } from '../../types';

interface FuturePlaceholderProps {
  language: Language;
  entries?: DiaryEntry[];
  principles?: Principle[];
  onBack?: () => void;
  onOpenPast?: () => void;
  onOpenNow?: () => void;
}

const stripTagPrefix = (tag: string) => tag.replace(/^(心情|事件)\s*[:：]\s*/, '').trim();

const summarizeEntry = (entry: DiaryEntry) => {
  const compact = entry.content.replace(/\n素材:\n[\s\S]*$/m, '').replace(/\s+/g, ' ').trim();
  if (compact.length <= 58) return compact || entry.title;
  return `${compact.slice(0, 58)}…`;
};

const buildTopSignals = (entries: DiaryEntry[]) => {
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const label = stripTagPrefix(tag);
      if (!label) continue;
      tagCounts.set(label, (tagCounts.get(label) ?? 0) + 1);
    }
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));
};

export const FuturePlaceholder: React.FC<FuturePlaceholderProps> = ({
  language,
  entries = [],
  principles = [],
  onBack,
  onOpenPast,
  onOpenNow,
}) => {
  const isZh = language === 'zh';
  const activeEntries = useMemo(
    () =>
      entries
        .filter((entry) => !entry.unlockAt || entry.unlockAt <= Date.now())
        .sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );
  const topSignals = useMemo(() => buildTopSignals(activeEntries), [activeEntries]);
  const latestPrinciples = useMemo(
    () => [...principles].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
    [principles],
  );
  const latestEntries = activeEntries.slice(0, 3);
  const hasMaterial = activeEntries.length > 0 || principles.length > 0;
  const primaryPrinciple = latestPrinciples[0] ?? null;
  const primarySignal = topSignals[0] ?? null;

  return (
    <main className="mobile-future-page" data-testid="future-page">
      {onBack && (
        <button
          type="button"
          className="mobile-future-page__back"
          aria-label={isZh ? '返回过去' : 'Back to Past'}
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <header className="mobile-future-page__header">
        <p className="mobile-future-page__eyebrow">
          {isZh ? 'VECTOR · 未来' : 'VECTOR · Future'}
        </p>
        <h1>{isZh ? '分析转化' : 'Analysis & Transformation'}</h1>
        <p className="mobile-future-page__subtitle">
          {isZh
            ? '把过去的素材压缩为下一步行动。'
            : 'Turn past material into the next useful move.'}
        </p>
      </header>

      <section className="mobile-future-page__body">
        <div className="future-insight-grid">
          <article className="future-insight-card future-insight-card--hero">
            <div className="future-insight-card__icon">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span>{isZh ? '转化状态' : 'Transformation state'}</span>
              <strong>
                {hasMaterial
                  ? isZh
                    ? '可以开始提炼行动'
                    : 'Ready to distill action'
                  : isZh
                    ? '等待素材进入'
                    : 'Waiting for material'}
              </strong>
              <p>
                {hasMaterial
                  ? isZh
                    ? `已读取 ${activeEntries.length} 条记录、${principles.length} 条原则，优先给出少量可确认的方向。`
                    : `Reading ${activeEntries.length} records and ${principles.length} principles, with only a few confirmable directions.`
                  : isZh
                    ? '先在「现在」写入，再回到这里查看趋势与行动建议。'
                    : 'Write in Now first, then return here for trends and next actions.'}
              </p>
            </div>
          </article>

          <article className="future-insight-card">
            <div className="future-insight-card__icon">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span>{isZh ? '近期信号' : 'Recent signals'}</span>
            {topSignals.length > 0 ? (
              <div className="future-chip-list">
                {topSignals.map((signal) => (
                  <span key={signal.label}>
                    {signal.label} · {signal.count}
                  </span>
                ))}
              </div>
            ) : (
              <p>{isZh ? '暂无高频标签。' : 'No recurring tags yet.'}</p>
            )}
          </article>

          <article className="future-insight-card">
            <div className="future-insight-card__icon">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span>{isZh ? '可用原则' : 'Usable principles'}</span>
            {latestPrinciples.length > 0 ? (
              <ul className="future-compact-list">
                {latestPrinciples.map((principle) => (
                  <li key={principle.id}>{principle.text}</li>
                ))}
              </ul>
            ) : (
              <p>{isZh ? '过去页确认原则后，会在这里参与转化。' : 'Confirmed Past principles appear here.'}</p>
            )}
          </article>
        </div>

        <section className="future-action-panel" aria-label={isZh ? '下一步建议' : 'Next actions'}>
          <div className="future-action-panel__head">
            <Compass className="h-5 w-5" />
            <div>
              <h2>{isZh ? '下一步建议' : 'Next action'}</h2>
              <p>
                {isZh
                  ? '不堆信息，只保留最值得执行的一步。'
                  : 'Keep the surface low-noise: only the next useful step.'}
              </p>
            </div>
          </div>
          <div className="future-action-panel__body">
            {primaryPrinciple ? (
              <div className="future-action-item future-action-item--principle">
                <span>{isZh ? '基于已确认原则' : 'Based on confirmed principle'}</span>
                <strong>{primaryPrinciple.text}</strong>
                <p>
                  {isZh
                    ? primarySignal
                      ? `下一步：找一个与「${primarySignal.label}」相关的小场景，先按这条原则做一次低成本验证。`
                      : '下一步：选一个今天会发生的小场景，按这条原则做一次低成本验证。'
                    : primarySignal
                      ? `Next: choose one small "${primarySignal.label}" situation and test this principle with low cost.`
                      : 'Next: choose one small situation today and test this principle with low cost.'}
                </p>
              </div>
            ) : latestEntries.length > 0 ? (
              latestEntries.map((entry) => (
                <div key={entry.id} className="future-action-item">
                  <span>{new Date(entry.createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')}</span>
                  <strong>{entry.title}</strong>
                  <p>{summarizeEntry(entry)}</p>
                </div>
              ))
            ) : (
              <div className="future-action-item">
                <span>{isZh ? '启动建议' : 'Start here'}</span>
                <strong>{isZh ? '先记录一个真实片刻' : 'Record one real moment'}</strong>
                <p>
                  {isZh
                    ? '未来页的分析来自过去经验，不来自空想。先完成一条现在记录。'
                    : 'Future analysis comes from lived experience, not speculation. Add one Now record first.'}
                </p>
              </div>
            )}
          </div>
          <div className="future-action-panel__actions">
            {onOpenPast && (
              <button type="button" onClick={onOpenPast}>
                {isZh ? '回到过去确认' : 'Review Past'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {onOpenNow && (
              <button type="button" onClick={onOpenNow}>
                {isZh ? '记录现在' : 'Write Now'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
};
