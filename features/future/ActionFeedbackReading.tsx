import type { ActionItem } from '../../types';
import type { ActionPracticeRecord, Goal, GoalFeedbackRecord, Vision } from '../../types/future';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { executionStatusLabel, GoalExecutionResults } from './GoalExecutionResults';

const goalStatus = { active: '进行中', paused: '已暂停', completed: '已完成', ended: '已结束' };
const goalDecision = {
  continue: '继续推进',
  adjust: '调整',
  pause: '暂停',
  complete: '已完成',
  end: '结束',
};
const feedbackDate = (value: string) => value.replaceAll('-', '.');

export function ActionFeedbackReading({
  action,
  records,
  goal,
  vision,
  goalRecords,
  canUpdate,
  onUpdate,
  onDeletePractice,
  onDeleteGoalFeedback,
}: {
  action: ActionItem;
  records: ActionPracticeRecord[];
  goal?: Goal;
  vision?: Vision;
  goalRecords: GoalFeedbackRecord[];
  canUpdate: boolean;
  onUpdate: () => void;
  onDeletePractice: (id: string) => void;
  onDeleteGoalFeedback: (id: string) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'practice'; id: string } | { kind: 'goal'; id: string } | null
  >(null);
  const latest = records[0];
  const confirmDeletion = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'practice') onDeletePractice(deleteTarget.id);
    else onDeleteGoalFeedback(deleteTarget.id);
    setDeleteTarget(null);
  };
  return (
    <article className="future-reading-view future-action-reading">
      <header className="future-action-reading-header">
        <h2>{action.title}</h2>
        <span className="future-action-reading-status">
          {
            { pending: '未开始', active: '进行中', completed: '已完成', abandoned: '已结束' }[
              action.status
            ]
          }
        </span>
      </header>
      {canUpdate && (
        <button
          type="button"
          className="future-reading-edit future-action-reading-update"
          onClick={onUpdate}
        >
          更新进展 <span aria-hidden="true">→</span>
        </button>
      )}
      {goal && (
        <details className="future-action-drawer future-action-goal-drawer">
          <summary>
            <span className="future-action-drawer-summary-text">
              <span className="future-action-drawer-label">方向</span>
              <span role="heading" aria-level={3}>
                目标 · {goal.title}
              </span>
              {vision && <span className="future-feedback-vision">愿景 · {vision.text}</span>}
            </span>
            <span className="future-action-drawer-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="future-action-drawer-body" role="region" aria-label="关联目标">
            <p className="future-reading-context">目标状态 · {goalStatus[goal.status]}</p>

            {goalRecords.length > 0 && (
              <details className="future-action-history">
                <summary>目标阶段记录（{goalRecords.length}）</summary>
                <ol className="future-execution-history">
                  {goalRecords.map((record) => (
                    <li key={record.id}>
                      <time dateTime={record.occurredOn}>{feedbackDate(record.occurredOn)}</time>
                      <strong>{goalDecision[record.decision]}</strong>
                      {record.note && <p>{record.note}</p>}
                      <button
                        type="button"
                        className="future-entry-delete"
                        aria-label="删除此条"
                        title="删除此条"
                        onClick={() => setDeleteTarget({ kind: 'goal', id: record.id })}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </details>
      )}
      {latest && (
        <section className="future-action-latest future-action-surface" aria-label="最近结果">
          <h3>最近进展</h3>
          <time dateTime={latest.occurredOn}>{feedbackDate(latest.occurredOn)}</time>
          {latest.note ? (
            <p>{latest.note}</p>
          ) : (
            <p className="future-reading-context">{executionStatusLabel[latest.status]}</p>
          )}
          {latest.nextAction && (
            <p className="future-reading-context">下一步 · {latest.nextAction}</p>
          )}
          <button
            type="button"
            className="future-entry-delete"
            aria-label="删除此条"
            title="删除此条"
            onClick={() => setDeleteTarget({ kind: 'practice', id: latest.id })}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </section>
      )}
      {records.length > 1 && (
        <details className="future-action-drawer future-action-history-drawer">
          <summary>
            <span>历史反馈（{records.length - 1}）</span>
            <span className="future-action-drawer-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="future-action-drawer-body">
            <GoalExecutionResults
              compact
              initiallyExpanded
              records={records.slice(1)}
              actions={[action]}
              onDelete={(id) => setDeleteTarget({ kind: 'practice', id })}
            />
          </div>
        </details>
      )}
      {deleteTarget && (
        <div className="future-history-delete-confirm" role="alert">
          <p>删除后无法恢复，确定删除吗？</p>
          <div className="future-toolbar">
            <button type="button" onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button type="button" className="future-danger" onClick={confirmDeletion}>
              确认删除
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
