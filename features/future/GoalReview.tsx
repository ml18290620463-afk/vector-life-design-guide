import type { GoalFeedbackDecision, GoalFeedbackRecord } from '../../types/future';

const decisionLabel: Record<GoalFeedbackDecision, string> = {
  continue: '继续推进',
  adjust: '调整',
  pause: '暂停',
  complete: '已完成',
  end: '结束',
};

export function GoalReview({
  records,
  onEdit,
}: {
  records: GoalFeedbackRecord[];
  onEdit: () => void;
}) {
  const latest = records.at(-1);
  return (
    <section className="future-goal-review" aria-label="目标判断">
      <h3>目标判断</h3>
      {latest && <p>最近判断：{decisionLabel[latest.decision]}</p>}
      {latest?.note && <p className="future-goal-review-result">{latest.note}</p>}
      {latest?.nextStep && <p className="future-goal-review-next">下一步：{latest.nextStep}</p>}
      {records.length > 0 && (
        <details className="future-goal-decision-history">
          <summary>查看阶段判断（{records.length}）</summary>
          <p>{records.map((record) => decisionLabel[record.decision]).join(' → ')}</p>
          <ol className="future-execution-history">
            {[...records].reverse().map((record) => (
              <li key={record.id}>
                <strong>{decisionLabel[record.decision]}</strong>
                {record.note && <p>{record.note}</p>}
                {record.nextStep && <p>下一步：{record.nextStep}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      <button type="button" className="future-reading-edit" onClick={onEdit}>
        对这个目标的判断
      </button>
    </section>
  );
}
