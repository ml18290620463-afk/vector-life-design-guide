import { useEffect, useState } from 'react';
import type { Language, Theme } from '../types';
import { NowPage } from '../features/now/components/NowPage';
import { TagSelectPage } from '../features/now/components/TagSelectPage';
import { createEmptyDraft, isDraftEmpty } from '../features/now/state/nowRules';
import type { NowDraft } from '../features/now/types/now';
import { ProtectionStep } from './onboarding/ProtectionStep';
import './onboarding/onboarding.css';

interface OnboardingProps {
  language: Language;
  onSetLanguage: (language: Language) => void;
  theme?: Theme;
  onComplete: (
    password: string,
    directory: string[],
    selection: string[],
    draft?: NowDraft,
  ) => void | Promise<void>;
  onCancel?: () => void;
}

export const Onboarding = ({ language, theme = 'dark', onComplete, onCancel }: OnboardingProps) => {
  const [step, setStep] = useState<'write' | 'protect'>('write');
  // No draft repository or autosave until the vault has been protected.
  const [draft, setDraft] = useState(createEmptyDraft);
  const [tags, setTags] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (isDraftEmpty(draft)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);
  const protect = () => {
    setNotice('');
    setStep('protect');
  };
  return (
    <main
      className={`onboarding-simple now-shell ${theme === 'light' ? 'now-shell--light' : ''}`}
      data-testid="onboarding"
    >
      {step === 'write' && (
        <>
          {tags ? (
            <TagSelectPage
              draft={draft}
              setDraft={setDraft}
              onBack={() => setTags(false)}
              showToast={setNotice}
              allowCustomTags={false}
            />
          ) : (
            <NowPage
              draft={draft}
              setDraft={setDraft}
              sending={false}
              onSend={protect}
              onSaveDraft={async () => {
                protect();
                return false;
              }}
              onDiscardDraft={async () => {
                setDraft(createEmptyDraft());
                return true;
              }}
              onExit={() => {
                onCancel?.();
              }}
              onRouteChange={(route) => {
                if (route === 'tags') setTags(true);
                else
                  setNotice(
                    language === 'zh'
                      ? '保存第一条草稿后，即可使用分身。'
                      : 'Save your first draft to use Avatar.',
                  );
              }}
              showToast={setNotice}
            />
          )}
        </>
      )}
      {step === 'protect' && (
        <ProtectionStep
          language={language}
          onBack={() => setStep('write')}
          onSave={async (password) => {
            await onComplete(password, [], [], draft);
          }}
        />
      )}
      {notice && step === 'write' && (
        <p role="status" className="now-toast">
          {notice}
        </p>
      )}
    </main>
  );
};
