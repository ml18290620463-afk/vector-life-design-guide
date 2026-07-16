import type { FC } from 'react';
import type { DiaryEntry, Language, Principle, Theme } from '../../../types';
import type { NowRoute } from '../types/now';
import { NowFlow } from '../nowLazyComponents';

type DesktopNowFrameProps = {
  language: Language;
  nowRoute: NowRoute;
  onExit: () => void;
  onPersistRecord: (payload: Omit<DiaryEntry, 'id' | 'createdAt' | 'isLocked'>) => Promise<string>;
  onRecordComplete: () => void;
  onRouteChange: (route: NowRoute) => void;
  pastEntries: DiaryEntry[];
  principles: Principle[];
  theme: Theme;
};

export const DesktopNowFrame: FC<DesktopNowFrameProps> = ({
  language,
  nowRoute,
  onExit,
  onPersistRecord,
  onRecordComplete,
  onRouteChange,
  pastEntries,
  principles,
  theme,
}) => (
  <div
    className={`desktop-main-module-frame desktop-main-module-frame--now ${
      nowRoute === 'avatar-chat' ? 'desktop-main-module-frame--avatar' : ''
    }`}
  >
    {nowRoute === 'avatar-chat' && (
      <section className="desktop-avatar-hero" aria-label="分身工作台说明">
        <span>VECTOR · 分身</span>
        <h1>{language === 'zh' ? '记忆协助与结构化对话' : 'Memory-assisted avatar'}</h1>
        <p>
          {language === 'zh'
            ? '分身会参考过去记录，顺着你的表达提炼事实、感受、想法、结果，并在你确认后保存为一条过去经验。'
            : 'The avatar recalls past records, extracts facts, feelings, thoughts, and outcomes, then saves only after confirmation.'}
        </p>
      </section>
    )}
    <NowFlow
      route={nowRoute}
      theme={theme}
      language={language}
      pastEntries={pastEntries}
      principles={principles}
      onRouteChange={onRouteChange}
      onExit={onExit}
      onPersistRecord={onPersistRecord}
      onRecordComplete={onRecordComplete}
    />
  </div>
);
