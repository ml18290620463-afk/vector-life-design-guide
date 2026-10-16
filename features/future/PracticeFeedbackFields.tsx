import type { ActionFeedbackNextStep, ActionFeedbackStatus } from '../../types/future';
import type { ExperienceFeedbackOutcome, Principle } from '../../types';

interface Props {
  status: ActionFeedbackStatus;
  nextStep: ActionFeedbackNextStep;
  setStatus: (status: ActionFeedbackStatus) => void;
  setNextStep: (step: ActionFeedbackNextStep) => void;
  principle?: Principle;
  principleOutcome?: ExperienceFeedbackOutcome | '';
  setPrincipleOutcome?: (outcome: ExperienceFeedbackOutcome | '') => void;
}

/** Feedback records an action's outcome; experiences are recorded in Past. */
export function PracticeFeedbackFields({
  status,
  nextStep,
  setStatus,
  setNextStep,
  principle,
  principleOutcome = '',
  setPrincipleOutcome,
}: Props) {
  return (
    <>
      <label>
        本次执行状态
        <select
          name="feedbackStatus"
          value={status}
          autoFocus
          onChange={(event) => {
            const next = event.target.value as ActionFeedbackStatus;
            setStatus(next);
            if (next === 'completed' || next === 'cancelled') setNextStep('end');
            else setNextStep('continue');
          }}
        >
          <option value="completed">已完成</option>
          <option value="partial">部分完成</option>
          <option value="not_completed">尚未完成</option>
          <option value="cancelled">停止这项行动</option>
        </select>
      </label>
      {status === 'completed' && (
        <label>
          完成后
          <select name="completionDestination" defaultValue="long_term">
            <option value="long_term">长期推进</option>
            <option value="past">存入过去</option>
          </select>
        </label>
      )}
      <label>
        反馈内容（可选）
        <textarea name="note" maxLength={2000} placeholder="记录结果、感受或遇到的情况" />
      </label>
      {principle && setPrincipleOutcome && (
        <details className="future-principle-feedback">
          <summary>评价这次行动（可选）</summary>
          <p>关联原则：{principle.text}</p>
          <label>
            我的判断
            <select
              name="principleOutcome"
              value={principleOutcome}
              onChange={(event) =>
                setPrincipleOutcome(event.target.value as ExperienceFeedbackOutcome | '')
              }
            >
              <option value="">暂不评价</option>
              <option value="helpful">结果支持这条原则</option>
              <option value="partial">部分支持：条件或结果有限</option>
              <option value="unhelpful">结果挑战这条原则</option>
              <option value="unrelated">本次不能据此评价</option>
            </select>
          </label>
        </details>
      )}
      {(status === 'partial' || status === 'not_completed') && (
        <details>
          <summary>下一步（默认继续完成）</summary>
          <label>
            下一步
            <select
              name="nextStep"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value as ActionFeedbackNextStep)}
            >
              <option value="continue">继续完成</option>
              <option value="adjust">调整后再做</option>
              <option value="pause">暂不安排</option>
              <option value="end">结束行动</option>
            </select>
          </label>
          {nextStep === 'adjust' && (
            <label>
              调整后的行动
              <input
                name="nextAction"
                required
                maxLength={500}
                placeholder="把下一步改小、改具体"
              />
            </label>
          )}
        </details>
      )}
    </>
  );
}
