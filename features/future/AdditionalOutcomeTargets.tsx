import { useState } from 'react';
import type { Goal, OutcomeTarget } from '../../types/future';

/** Additional targets are opt-in; no amount or measurement is copied across goals. */
export function AdditionalOutcomeTargets({ goals }: { goals: Goal[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  if (!goals.length) return null;
  return (
    <details>
      <summary>同时计入其他推进（可选）</summary>
      {goals.map((goal) => (
        <div className="future-additional-target" key={goal.id}>
          <label className="future-check">
            <input
              type="checkbox"
              name="additionalGoalId"
              value={goal.id}
              checked={selected.includes(goal.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, goal.id]
                    : current.filter((id) => id !== goal.id),
                )
              }
            />
            {goal.title}
          </label>
          {selected.includes(goal.id) && (
            <label>
              {goal.measurement.kind === 'narrative'
                ? '进展'
                : goal.measurement.distinctItems
                  ? '成果名称'
                  : `本次增加（${goal.measurement.unit}）`}
              {goal.measurement.kind === 'narrative' ? (
                <textarea name={`target:${goal.id}`} required />
              ) : goal.measurement.distinctItems ? (
                <input name={`target:${goal.id}`} required />
              ) : (
                <input
                  name={`target:${goal.id}`}
                  type="number"
                  required
                  min={10 ** -goal.measurement.precision}
                  step={10 ** -goal.measurement.precision}
                />
              )}
            </label>
          )}
        </div>
      ))}
    </details>
  );
}

export function readAdditionalTargets(data: FormData, goals: Goal[]): OutcomeTarget[] {
  return data.getAll('additionalGoalId').map((id) => {
    const goal = goals.find((candidate) => candidate.id === id);
    if (!goal || goal.status !== 'active') throw new Error('推进状态已改变，请重新选择');
    const value = String(data.get(`target:${goal.id}`) ?? '').trim();
    return {
      goalId: goal.id,
      expectedRevision: goal.revision,
      itemLabel: value,
      value:
        goal.measurement.kind === 'narrative'
          ? { kind: 'narrative', note: value }
          : { kind: 'quantity', amount: goal.measurement.distinctItems ? 1 : Number(value) },
    };
  });
}
