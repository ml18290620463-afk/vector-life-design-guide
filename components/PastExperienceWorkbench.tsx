import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Eye, FileText, Layers3, Sparkles, X } from 'lucide-react';
import type { DiaryEntry, Language, Principle, PrincipleApplication, Theme } from '../types';

interface PastExperienceWorkbenchProps {
  language: Language;
  theme: Theme;
  entries: DiaryEntry[];
  principles: Principle[];
  now: number;
  onAddPrinciple: (
    text: string,
    year: number,
    showOnHome: boolean,
    derivedFromEntryIds?: string[],
    application?: PrincipleApplication,
  ) => void;
  onSelectEntry: (entry: DiaryEntry) => void;
}

type CandidateStatus = 'pending' | 'confirmed' | 'rejected' | 'needs_revision';

interface ExperienceCandidate {
  id: string;
  kind: 'pattern' | 'principle' | 'review';
  title: string;
  conclusion: string;
  principle: string;
  application: PrincipleApplication;
  evidence: DiaryEntry[];
  confidence: 'low' | 'medium' | 'high';
}

const summarize = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 72) return compact;
  return `${compact.slice(0, 72)}...`;
};

const buildCandidateId = (prefix: string, entries: DiaryEntry[]) =>
  `${prefix}-${entries.map((entry) => entry.id.slice(0, 6)).join('-')}`;

const getRepeatedTags = (entries: DiaryEntry[]) => {
  const tagCounts = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    for (const tag of entry.tags.slice(0, 4)) {
      const key = tag.replace(/^#/, '').trim();
      if (!key) continue;
      tagCounts.set(key, [...(tagCounts.get(key) ?? []), entry]);
    }
  }
  return [...tagCounts.entries()]
    .filter(([, taggedEntries]) => taggedEntries.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2);
};

const buildCandidates = (
  entries: DiaryEntry[],
  principles: Principle[],
  language: Language,
): ExperienceCandidate[] => {
  const isZh = language === 'zh';
  const unlockedEntries = entries
    .filter((entry) => !entry.unlockAt || entry.unlockAt <= Date.now())
    .slice(0, 12);
  const candidates: ExperienceCandidate[] = [];

  for (const [tag, taggedEntries] of getRepeatedTags(unlockedEntries)) {
    const evidence = taggedEntries.slice(0, 3);
    candidates.push({
      id: buildCandidateId(`tag-${tag}`, evidence),
      kind: 'pattern',
      title: isZh ? `重复模式：${tag}` : `Repeated pattern: ${tag}`,
      conclusion: isZh
        ? `你最近多次遇到与「${tag}」相关的经验，适合先提炼成一个可验证的行动原则。`
        : `Several recent entries cluster around "${tag}", which is ready to become a testable action principle.`,
      principle: isZh
        ? `遇到${tag}场景，先定义目标再行动`
        : `Define the goal before acting in ${tag} situations`,
      application: {
        trigger: isZh ? `再次遇到${tag}相关场景` : `When a ${tag} situation appears again`,
        action: isZh ? '先写下这次唯一目标，再开始行动' : 'Write the single goal before taking action',
      },
      evidence,
      confidence: evidence.length >= 3 ? 'high' : 'medium',
    });
  }

  const reflectedEntries = unlockedEntries.filter((entry) => entry.reflection);
  if (reflectedEntries.length > 0) {
    const evidence = reflectedEntries.slice(0, 3);
    candidates.push({
      id: buildCandidateId('reviewed', evidence),
      kind: 'review',
      title: isZh ? '复盘已足够沉淀' : 'Reflections ready to distill',
      conclusion: isZh
        ? '这些素材已经带有复盘痕迹，可以从“发生了什么”推进到“下次怎么做”。'
        : 'These entries already contain reflection traces, so they can move from what happened to what to do next.',
      principle: isZh
        ? '有复盘痕迹的经验，转成下一次动作'
        : 'Turn reflected experiences into next actions',
      application: {
        trigger: isZh ? '一条经验已经完成复盘时' : 'When an experience has been reflected on',
        action: isZh ? '提取一个下次可直接尝试的动作' : 'Extract one action to try next time',
      },
      evidence,
      confidence: 'medium',
    });
  }

  if (unlockedEntries.length > 0) {
    const evidence = unlockedEntries.slice(0, Math.min(3, unlockedEntries.length));
    candidates.push({
      id: buildCandidateId('structure', evidence),
      kind: 'principle',
      title: isZh ? '结构化入口' : 'Structuring gateway',
      conclusion: isZh
        ? '当前最值得确认的不是更多分类，而是把素材压缩成“场景、目标、动作、结果、机制、原则”。'
        : 'The next useful move is not more folders, but compressing material into scene, goal, action, result, mechanism, principle.',
      principle: isZh
        ? '重要经验先写场景目标动作结果'
        : 'Write scene goal action result for important experiences',
      application: {
        trigger: isZh ? '记录一次重要经验时' : 'When recording an important experience',
        action: isZh ? '补齐场景、目标、动作和结果' : 'Capture scene, goal, action, and result',
      },
      evidence,
      confidence: 'low',
    });
  }

  return candidates
    .filter(
      (candidate) =>
        !principles.some((principle) => principle.text.trim() === candidate.principle.trim()),
    )
    .slice(0, 3);
};

export const PastExperienceWorkbench: React.FC<PastExperienceWorkbenchProps> = ({
  language,
  theme,
  entries,
  principles,
  now,
  onAddPrinciple,
  onSelectEntry,
}) => {
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const isZh = language === 'zh';
  const candidates = useMemo(
    () => buildCandidates(entries, principles, language),
    [entries, principles, language],
  );
  const pendingCandidates = candidates.filter(
    (candidate) => (statuses[candidate.id] ?? 'pending') === 'pending',
  );
  const lockedCount = entries.filter((entry) => entry.unlockAt && entry.unlockAt > now).length;
  const confirmedCount = Object.values(statuses).filter((status) => status === 'confirmed').length;

  const confirmCandidate = (candidate: ExperienceCandidate) => {
    onAddPrinciple(
      candidate.principle,
      new Date().getFullYear(),
      true,
      candidate.evidence.map((entry) => entry.id),
      candidate.application,
    );
    setStatuses((prev) => ({ ...prev, [candidate.id]: 'confirmed' }));
  };

  const setCandidateStatus = (candidate: ExperienceCandidate, status: CandidateStatus) => {
    setStatuses((prev) => ({ ...prev, [candidate.id]: status }));
  };

  return (
    <section
      className="past-workbench"
      aria-label={isZh ? '过去经验蒸馏台' : 'Past experience workbench'}
    >
      <div
        className="past-workbench__summary"
        aria-label={isZh ? '经验处理状态' : 'Experience processing status'}
      >
        <div>
          <span>{isZh ? '待确认结论' : 'Pending insights'}</span>
          <strong>{pendingCandidates.length}</strong>
        </div>
        <div>
          <span>{isZh ? '原始素材' : 'Raw materials'}</span>
          <strong>{entries.length}</strong>
        </div>
        <div>
          <span>{isZh ? '已确认原则' : 'Confirmed principles'}</span>
          <strong>{principles.length + confirmedCount}</strong>
        </div>
      </div>

      <div className="past-workbench__layout">
        <div className="past-workbench__main">
          <div className="past-workbench__section-head">
            <Sparkles className="h-5 w-5" />
            <div>
              <h2>{isZh ? '把记录变成原则' : 'Turn records into principles'}</h2>
              <p>
                {isZh
                  ? '系统只给出少量候选结论；你确认后，Future 才会把它当作行动依据。'
                  : 'Only a few candidate insights appear here. Future uses them as action inputs only after you confirm.'}
              </p>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="past-workbench__empty">
              <Layers3 className="h-8 w-8" />
              <p>
                {isZh
                  ? '还没有新的候选结论。继续积累素材，系统会再尝试萃取。'
                  : 'No new candidate insights yet. Keep collecting material and the system will distill again.'}
              </p>
            </div>
          ) : (
            <div className="past-workbench__queue">
              {candidates.map((candidate) => {
                const status = statuses[candidate.id] ?? 'pending';
                const expanded = expandedEvidenceId === candidate.id;
                return (
                  <article
                    key={candidate.id}
                    className={`past-workbench__candidate past-workbench__candidate--${status}`}
                  >
                    <div className="past-workbench__candidate-top">
                      <span>{candidate.title}</span>
                      <small>
                        {isZh
                          ? `置信度 ${candidate.confidence}`
                          : `Confidence ${candidate.confidence}`}
                      </small>
                    </div>
                    <p className="past-workbench__conclusion">{candidate.conclusion}</p>
                    <div className="past-workbench__principle">
                      <FileText className="h-4 w-4" />
                      <span>{candidate.principle}</span>
                    </div>

                    <div className="past-workbench__actions">
                      <button
                        type="button"
                        onClick={() => confirmCandidate(candidate)}
                        disabled={status === 'confirmed'}
                      >
                        <Check className="h-4 w-4" />
                        {isZh ? '确认记忆' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCandidateStatus(candidate, 'needs_revision')}
                      >
                        <Eye className="h-4 w-4" />
                        {isZh ? '部分准确' : 'Partial'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCandidateStatus(candidate, 'rejected')}
                      >
                        <X className="h-4 w-4" />
                        {isZh ? '否定' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        className="past-workbench__evidence-toggle"
                        onClick={() => setExpandedEvidenceId(expanded ? null : candidate.id)}
                        aria-expanded={expanded}
                      >
                        <ChevronDown className="h-4 w-4" />
                        {isZh ? '依据' : 'Evidence'}
                      </button>
                    </div>

                    {expanded && (
                      <div className="past-workbench__evidence">
                        {candidate.evidence.map((entry) => (
                          <button key={entry.id} type="button" onClick={() => onSelectEntry(entry)}>
                            <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                            <strong>{entry.title}</strong>
                            <small>{summarize(entry.content)}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="past-workbench__side">
          <div className="past-workbench__section-head past-workbench__section-head--compact">
            <Layers3 className="h-5 w-5" />
            <div>
              <h2>{isZh ? '低拥挤素材池' : 'Low-noise material pool'}</h2>
              <p>
                {isZh
                  ? '默认只看摘要，需要时再进入原文。'
                  : 'Summaries first, source text only when needed.'}
              </p>
            </div>
          </div>
          <div className="past-workbench__raw-list">
            {entries.slice(0, 5).map((entry) => (
              <button key={entry.id} type="button" onClick={() => onSelectEntry(entry)}>
                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                <strong>{entry.title}</strong>
                <small>{summarize(entry.content)}</small>
              </button>
            ))}
            {entries.length === 0 && <p>{isZh ? '暂无过去素材。' : 'No archived material yet.'}</p>}
          </div>
          {lockedCount > 0 && (
            <div
              className={`past-workbench__note ${theme === 'light' ? 'past-workbench__note--light' : ''}`}
            >
              {isZh
                ? `${lockedCount} 条时间锁素材暂不参与提炼。`
                : `${lockedCount} time-locked entries are excluded from distillation.`}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
