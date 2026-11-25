import type { Language, Principle, Theme } from '../types';
import './cover/cover.css';
import { SilkVideo } from './cover/SilkVideo';
import { VectorWordmark } from './cover/VectorWordmark';

interface CoverScreenProps {
  onStart: () => void;
  language: Language;
  onSetLanguage: (language: Language) => void;
  principles: Principle[];
  theme?: Theme;
  onMigrate?: () => void;
}
export const CoverScreen = ({ onStart, language, onSetLanguage }: CoverScreenProps) => {
  const english = language === 'en';
  return (
    <main className="vector-light-home" data-testid="vector-home" lang={english ? 'en' : 'zh-CN'}>
      <div className="vector-home-stage">
        <div
          className="vector-home-language"
          role="group"
          aria-label={english ? 'Language' : '语言切换'}
        >
          <button
            type="button"
            lang="zh-CN"
            aria-pressed={!english}
            onClick={() => onSetLanguage('zh')}
          >
            中文
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            lang="en"
            aria-pressed={english}
            onClick={() => onSetLanguage('en')}
          >
            EN
          </button>
        </div>
        <p className="vector-home-time">
          {english ? 'Record ‖ Past · Present ⇌ Future' : '记录 ‖ 过去·此刻 ⇌ 未来'}
        </p>
        <div className="vector-home-copy">
          <h1 className="vector-home-brand" aria-label="VECTOR">
            <VectorWordmark />
          </h1>
          <p className="vector-home-message">
            {english ? 'Capture the present, let experience guide you' : '记录此刻，让经历创造方向'}
          </p>
          <button
            className="vector-home-enter"
            data-testid="cover-initialize"
            type="button"
            onClick={onStart}
          >
            <span>{english ? 'Enter' : '进入'}</span>
            <svg viewBox="0 0 28 24" fill="none" aria-hidden="true">
              <path
                d="M2 12H24M16 4L24 12 16 20"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="vector-home-art">
          <SilkVideo />
        </div>
      </div>
    </main>
  );
};
