import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { Language, Principle, Theme } from '../types';
import './CoverScreen.brush.css';

interface CoverScreenProps {
  onStart: () => void;
  language: Language;
  principles: Principle[];
  theme?: Theme;
  onMigrate?: () => void;
}

/** The cover delegates entry and recovery to the existing application gates. */
export const CoverScreen: React.FC<CoverScreenProps> = ({ onStart, language, onMigrate }) => {
  const zh = language === 'zh';
  const [entering, setEntering] = React.useState(false);
  const [paused, setPaused] = React.useState(() => document.hidden);
  React.useEffect(() => {
    const syncVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);
  const entryPending = React.useRef(false);
  const entryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (entryTimer.current !== null) clearTimeout(entryTimer.current);
    },
    [],
  );
  const handleEnter = () => {
    if (entryPending.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onStart();
      return;
    }
    entryPending.current = true;
    setEntering(true);
    entryTimer.current = setTimeout(() => {
      onStart();
      entryPending.current = false;
      setEntering(false);
    }, 250);
  };
  return (
    <main className="vector-brush-cover" data-entering={entering || undefined} data-paused={paused || undefined}>
      <header className="vector-brush-cover__header">
        <span className="vector-brush-cover__header-record">{zh ? '记录' : 'Record'}</span>
        <span className="vector-brush-cover__divider">||</span>
        <span className="vector-brush-cover__header-time">{zh ? '过去·此刻' : 'Past · Now'}</span>
        <span className="vector-brush-cover__symbol">⇌</span>
        <span className="vector-brush-cover__header-time">{zh ? '未来' : 'Future'}</span>
      </header>
      <section className="vector-brush-cover__hero" aria-label="VECTOR">
        <h1 className="vector-brush-cover__wordmark" aria-label="VECTOR">
          <span aria-hidden="true">V</span>
          <svg className="vector-brush-cover__e" viewBox="0 0 67 84" aria-hidden="true">
            <defs>
              <linearGradient
                id="vector-e-word-flow"
                x1="3"
                y1="12"
                x2="62"
                y2="72"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#203641" />
                <stop offset="0.5" stopColor="#2b4a55" />
                <stop offset="1" stopColor="#203641" />
              </linearGradient>
              {/* The present begins at the shared spine and rises by one quiet degree. */}
              <linearGradient
                id="vector-e-present-flow"
                x1="2"
                y1="40"
                x2="62.8"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="var(--cover-present-base)" />
                <stop offset="0.18" stopColor="rgb(var(--cover-present-mid))" />
                <stop offset="0.58" stopColor="rgb(var(--cover-present-light))" />
                <stop offset="1" stopColor="rgb(var(--cover-present-tip))" />
              </linearGradient>
            </defs>
            <path fill="url(#vector-e-word-flow)" d="M2 0H59V8.2H11V75.8H59V84H2Z" />
            <path
              className="vector-brush-cover__e-bar"
              fill="url(#vector-e-present-flow)"
              d="M2 35H40C48.5 35 55.5 33.8 61 31.5C59.8 35 57.2 38 53.5 40C49.8 42 45.4 43 40 43H2Z"
            />
          </svg>
          <span aria-hidden="true">CTOR</span>
        </h1>
        <p className="vector-brush-cover__tagline">
          {zh
            ? '记录此刻，让经历创造方向。'
            : 'Record the present. Let experience shape direction.'}
        </p>
        <button
          className="vector-brush-cover__entry"
          type="button"
          onClick={handleEnter}
          data-entering={entering || undefined}
          aria-disabled={entering || undefined}
          data-testid="cover-initialize"
          aria-label={zh ? '点击进入下一个界面' : 'Click to enter the next screen'}
        >
          <span className="vector-brush-cover__entry-label">{zh ? '进入' : 'Enter'}</span>
          <span className="vector-brush-cover__entry-mark" aria-hidden="true">
            <ArrowRight />
          </span>
        </button>
      </section>
      <div className="vector-brush-cover__art" aria-hidden="true">
        <img src="/vector-brush-arrow-ink-depth.png" alt="" />
        {/* The masked wash preserves the original brush texture as light moves toward its tip. */}
        <span className="vector-brush-cover__rising-wash" />
      </div>
      <footer className="vector-brush-cover__footer">
        {onMigrate && (
          <button type="button" onClick={onMigrate} className="vector-brush-cover__migrate">
            {zh ? '恢复备份' : 'Restore backup'}
          </button>
        )}
      </footer>
    </main>
  );
};
