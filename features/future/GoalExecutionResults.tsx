import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ActionItem } from '../../types';
import type { ActionFeedbackStatus, ActionPracticeRecord } from '../../types/future';

export const executionStatusLabel: Record<ActionFeedbackStatus, string> = {
  completed: '已完成',
  partial: '部分完成',
  not_completed: '尚未完成',
  cancelled: '已停止',
};

/** Legacy feedback uses the action's goal; new records retain their original goal. */
export const goalExecutionRecords = (
  goalId: string,
  records: ActionPracticeRecord[],
  actions: ActionItem[],
) =>
  records
    .filter((record) =>
      record.goalId === undefined
        ? actions.some((action) => action.id === record.actionId && action.goalId === goalId)
        : record.goalId === goalId,
    )
    .sort((left, right) => right.createdAt - left.createdAt);

export const executionTitle = (record: ActionPracticeRecord, actions: ActionItem[]) =>
  record.actionTitle ?? actions.find((action) => action.id === record.actionId)?.title ?? '行动';

export function GoalExecutionResults({
  records,
  actions,
  compact = false,
  initiallyExpanded = false,
  onDelete,
}: {
  records: ActionPracticeRecord[];
  actions: ActionItem[];
  compact?: boolean;
  initiallyExpanded?: boolean;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const withoutFeedback = actions.filter(
    (action) =>
      (action.status === 'completed' || action.status === 'abandoned') &&
      !records.some((record) => record.actionId === action.id),
  );
  return (
    <section className="future-execution-results" aria-labelledby="execution-results-heading">
      <h3 id="execution-results-heading">{compact ? '阶段结果' : '执行反馈'}</h3>
      {records.length ? (
        <>
          <ol className="future-execution-history">
            {(expanded ? records : records.slice(0, 3)).map((record) => (
              <li key={record.id}>
                <div className="future-execution-heading">
                  {!compact && <strong>{executionTitle(record, actions)}</strong>}
                  <small>{executionStatusLabel[record.status]}</small>
                  <time dateTime={record.occurredOn}>{record.occurredOn.replaceAll('-', '.')}</time>
                </div>
                {record.note && <p>{record.note}</p>}
                {record.nextAction && (
                  <p className="future-execution-next">调整为：{record.nextAction}</p>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="future-entry-delete"
                    aria-label="删除此条"
                    title="删除此条"
                    onClick={() => onDelete(record.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          {records.length > 3 && (
            <button
              type="button"
              className="future-history-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '收起反馈' : `查看其余 ${records.length - 3} 条反馈`}
            </button>
          )}
        </>
      ) : (
        <p className="future-empty">暂无执行反馈。</p>
      )}
      {withoutFeedback.length > 0 && (
        <details className="future-goal-ended-actions">
          <summary>其他已结束行动（{withoutFeedback.length}）</summary>
          <div>
            {withoutFeedback.map((action) => (
              <p key={action.id}>
                <span>{action.title}</span>
                <small>{action.status === 'completed' ? '已完成' : '已结束'}</small>
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
