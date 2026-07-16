import type { FC } from 'react';
import { Suspense } from 'react';
import type { Language, Principle, Theme } from '../types';
import { AppState } from '../types';
import { CoverScreen, MasterLock, Onboarding } from './appLazyComponents';
import { ScreenLoader } from './ScreenLoader';

type AppEntryGateScreensProps = {
  appState: AppState;
  homePrinciples: Principle[];
  language: Language;
  onCancelToCover: () => void;
  onMigrate?: () => void;
  onOnboardingComplete: (password: string, directory: string[], selection: string[]) => void | Promise<void>;
  onRecoveryPasswordReset: (password: string) => void | Promise<void>;
  onReturningUserUnlock: (password: string) => void;
  onSetLanguage: (language: Language) => void;
  onStartFromCover: () => void;
  passwordHash: string | null;
  passwordSalt: string | null;
  theme: Theme;
};

export const AppEntryGateScreens: FC<AppEntryGateScreensProps> = ({
  appState,
  homePrinciples,
  language,
  onCancelToCover,
  onMigrate,
  onOnboardingComplete,
  onRecoveryPasswordReset,
  onReturningUserUnlock,
  onSetLanguage,
  onStartFromCover,
  passwordHash,
  passwordSalt,
  theme,
}) => (
  <>
    {appState === AppState.COVER && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <CoverScreen
          onStart={onStartFromCover}
          language={language}
          principles={homePrinciples}
          theme={theme}
          onMigrate={onMigrate}
        />
      </Suspense>
    )}

    {appState === AppState.ONBOARDING && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <Onboarding
          language={language}
          onSetLanguage={onSetLanguage}
          theme={theme}
          onComplete={onOnboardingComplete}
          onCancel={onCancelToCover}
        />
      </Suspense>
    )}

    {appState === AppState.LOGIN && passwordHash && (
      <Suspense fallback={<ScreenLoader language={language} />}>
        <MasterLock
          language={language}
          onSetLanguage={onSetLanguage}
          theme={theme}
          passwordHash={passwordHash}
          passwordSalt={passwordSalt}
          onUnlock={onReturningUserUnlock}
          onResetPassword={onRecoveryPasswordReset}
          onCancel={onCancelToCover}
        />
      </Suspense>
    )}
  </>
);
