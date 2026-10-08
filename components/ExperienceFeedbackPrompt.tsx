import type { FC } from 'react';
import { CheckCircle2, CircleDot, Unlink, XCircle } from 'lucide-react';
import type { DiaryEntry, ExperienceFeedbackOutcome, Language, Principle, Theme } from '../types';

type ExperienceFeedbackPromptProps = {
  entry: DiaryEntry;
  language: Language;
  principle: Principle;
  theme: Theme;
  onFeedback: (entry: DiaryEntry, principle: Principle, outcome: ExperienceFeedbackOutcome) => void;
};

const FEEDBACK_OPTIONS = [
  { outcome: 'helpful', zh: '有效', en: 'Helpful', Icon: CheckCircle2 },
  { outcome: 'partial', zh: '部分有效', en: 'Partly', Icon: CircleDot },
  { outcome: 'unhelpful', zh: '无效', en: 'Not helpful', Icon: XCircle },
  { outcome: 'unrelated', zh: '无关', en: 'Unrelated', Icon: Unlink },
] as const;

export const ExperienceFeedbackPrompt: FC<ExperienceFeedbackPromptProps> = ({
  entry,
  language,
  principle,
  theme,
  onFeedback,
}) => {
  const isZh = language === 'zh';

  return (
    <section
      className={`experience-feedback ${theme === 'light' ? 'experience-feedback--light' : ''}`}
      aria-labelledby={`experience-feedback-title-${entry.id}`}
    >
      <div className="experience-feedback__copy">
        <span>{isZh ? '记录反馈' : 'Record feedback'}</span>
        <strong id={`experience-feedback-title-${entry.id}`}>
          {isZh
            ? '这次经历似乎关联到一条过去原则'
            : 'This experience may relate to a past principle'}
        </strong>
        <blockquote>“{principle.text}”</blockquote>
        <p>
          {isZh
            ? '它在这次经历中有帮助吗？你的选择只会调整这条原则的可信度。'
            : 'Was it useful this time? Your choice only adjusts this principle’s reliability.'}
        </p>
      </div>
      <div
        className="experience-feedback__actions"
        role="group"
        aria-label={isZh ? '评价原则效果' : 'Rate principle usefulness'}
      >
        {FEEDBACK_OPTIONS.map(({ outcome, zh, en, Icon }) => (
          <button key={outcome} type="button" onClick={() => onFeedback(entry, principle, outcome)}>
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span>{isZh ? zh : en}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
