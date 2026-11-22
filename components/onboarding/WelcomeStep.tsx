import type { Language } from '../../types';

export function WelcomeStep({
  language,
  onSetLanguage,
  onContinue,
}: {
  language: Language;
  onSetLanguage: (language: Language) => void;
  onContinue: () => void;
}) {
  const zh = language === 'zh';
  return (
    <section className="onboarding-simple-card" aria-labelledby="onboarding-title">
      <p>VECTOR</p>
      <h1 id="onboarding-title">{zh ? '从此刻的一条记录开始' : 'Start with a moment'}</h1>
      <p>
        {zh
          ? '记下经历，让下一次选择更清晰。'
          : 'Capture an experience. Find clarity for your next choice.'}
      </p>
      <label>
        {zh ? '语言' : 'Language'}
        <select
          value={language === 'zh' ? 'zh' : 'en'}
          onChange={(event) => onSetLanguage(event.target.value as Language)}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <button type="button" onClick={onContinue}>
        {zh ? '写下第一条记录' : 'Write your first entry'}
      </button>
      <button
        type="button"
        className="onboarding-secondary"
        data-testid="onboarding-skip"
        onClick={onContinue}
      >
        {zh ? '跳过介绍' : 'Skip introduction'}
      </button>
    </section>
  );
}
