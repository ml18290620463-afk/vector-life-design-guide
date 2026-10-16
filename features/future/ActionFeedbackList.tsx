import { useState } from 'react';
import type { ActionItem } from '../../types';
import type { Goal } from '../../types/future';

const statuses = ['全部', '未开始', '进行中', '已结束'] as const;
export function feedbackActionStatus(action: ActionItem) {
  if (action.status === 'completed' || action.status === 'abandoned') return '已结束';
  if (action.status === 'pending') return '未开始';
  return '进行中';
}

export function ActionFeedbackList({
  actions,
  goals = [],
  onOpen,
  onDelete,
}: {
  actions: ActionItem[];
  goals?: Goal[];
  onOpen: (id: string) => void;
  onDelete: (actions: ActionItem[]) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('全部');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const visible = actions.filter(
    (action) =>
      [action.title, goals.find((goal) => goal.id === action.goalId)?.title ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (status === '全部' || feedbackActionStatus(action) === status),
  );
  const allVisibleSelected =
    visible.length > 0 && visible.every((action) => selectedIds.has(action.id));
  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((action) => next.delete(action.id));
      else visible.forEach((action) => next.add(action.id));
      return next;
    });
  };
  const exitSelection = () => {
    if (deleting) return;
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirming(false);
  };
  const deleteSelected = async () => {
    const selected = actions.filter((action) => selectedIds.has(action.id));
    setDeleting(true);
    const deleted = await onDelete(selected);
    setDeleting(false);
    if (deleted) exitSelection();
  };
  return (
    <div className="future-action-feedback">
      <div className="future-action-feedback-search">
        <input
          type="search"
          aria-label="搜索行动"
          placeholder="搜索行动或目标"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {!selecting ? (
          <button type="button" className="future-action-select" onClick={() => setSelecting(true)}>
            选择
          </button>
        ) : (
          <button
            type="button"
            className="future-action-select"
            disabled={deleting}
            onClick={exitSelection}
          >
            取消
          </button>
        )}
      </div>
      <div className="future-action-statuses" role="group" aria-label="行动状态">
        {statuses.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {selecting && (
        <div className="future-action-selection-bar">
          <span aria-live="polite">已选 {selectedIds.size} 项</span>
          <button type="button" disabled={!visible.length || deleting} onClick={toggleAll}>
            {allVisibleSelected ? '取消全选' : '全选'}
          </button>
        </div>
      )}
      <ul className="future-action-feedback-list" aria-label="行动列表">
        {visible.map((action) => (
          <li key={action.id}>
            {selecting ? (
              <label className="future-action-selection-row">
                <input
                  type="checkbox"
                  aria-label={`选择行动：${action.title}`}
                  checked={selectedIds.has(action.id)}
                  disabled={deleting}
                  onChange={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(action.id)) next.delete(action.id);
                      else next.add(action.id);
                      return next;
                    })
                  }
                />
                <strong>{action.title}</strong>
              </label>
            ) : (
              <button
                type="button"
                className="future-feedback-row"
                onClick={() => onOpen(action.id)}
              >
                <strong>{action.title}</strong>
                <span aria-hidden="true">›</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="future-empty">{actions.length ? '没有匹配的行动。' : '暂无行动。'}</p>
      )}
      {selecting && selectedIds.size > 0 && (
        <div className="future-action-bulk-footer">
          <button type="button" disabled={deleting} onClick={() => setConfirming(true)}>
            删除 {selectedIds.size} 项
          </button>
        </div>
      )}
      {confirming && (
        <div
          className="future-action-delete-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="确认删除行动"
        >
          <div>
            <h3>删除 {selectedIds.size} 项行动？</h3>
            <p>删除后无法恢复。相关的行动反馈与成果记录也会一并删除。</p>
            <div>
              <button type="button" disabled={deleting} onClick={() => setConfirming(false)}>
                取消
              </button>
              <button type="button" disabled={deleting} onClick={() => void deleteSelected()}>
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
