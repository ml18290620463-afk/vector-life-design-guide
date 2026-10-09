import type { ActionFeedbackNextStep, ActionFeedbackStatus } from '../../types/future';
import type { ExperienceFeedbackOutcome, Principle } from '../../types';
import { actionExecutionStatusHint } from '../../services/actionPracticeSemantics';

interface Props {
  status: ActionFeedbackStatus;
  nextStep: ActionFeedbackNextStep;
  setStatus: (status: ActionFeedbackStatus) => void;
  setNextStep: (step: ActionFeedbackNextStep) => void;
  principle?: Principle;
  principleOutcome?: ExperienceFeedbackOutcome | '';
  setPrincipleOutcome?: (outcome: ExperienceFeedbackOutcome | '') => void;
}
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
            const status = event.target.value as ActionFeedbackStatus;
            setStatus(status);
            if (status === 'completed' || status === 'cancelled') setNextStep('end');
            else setNextStep('continue');
          }}
        >
          <option value="completed">已完成</option>
          <option value="partial">部分完成</option>
          <option value="not_completed">尚未完成</option>
          <option value="cancelled">停止这项行动</option>
        </select>
      </label>
      <p className="future-feedback-status-hint">{actionExecutionStatusHint[status]}</p>
      <label>
        实际发生了什么（可选）
        <textarea name="note" />
      </label>
      {principle && setPrincipleOutcome && (
        <fieldset className="future-principle-feedback">
          <legend>这次实践与当前理解的关系（可选）</legend>
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
        </fieldset>
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
                placeholder="把下一步改小、改具体，例如：明天先核对一份材料"
              />
            </label>
          )}
        </details>
      )}
    </>
  );
}
