import type { Language, Principle, Theme } from '../types';
import './cover/cover.css';
import { RibbonFabric } from './cover/RibbonFabric';
import { RibbonCurrent } from './cover/RibbonCurrent';

interface CoverScreenProps {
  onStart: () => void;
  language: Language;
  principles: Principle[];
  theme?: Theme;
  onMigrate?: () => void;
}
export const CoverScreen = ({ onStart }: CoverScreenProps) => {
  return (
    <main
      className="vector-light-home"
      data-testid="vector-home"
    >
      <div className="vector-home-stage">
        <p className="vector-home-time">{'记录 ‖ 过去·此刻 ⇌ 未来'}</p>
        <div className="vector-home-copy">
          <h1 className="vector-home-brand" aria-label="VECTOR">
            <img src="/assets/vector-home/vector-wordmark-clear.png" alt="" aria-hidden="true" width="648" height="119" />
          </h1>
          <p className="vector-home-message">记录此刻，让经历创造方向。</p>
          <button
            className="vector-home-enter"
            data-testid="cover-initialize"
            type="button"
            onClick={onStart}
          >
            <span>进入</span>
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
          <img src="/assets/vector-home/ribbon-clear.png" alt="" aria-hidden="true" width="1672" height="941" />
          <RibbonCurrent />
          <RibbonFabric />
        </div>
      </div>
    </main>
  );
};
