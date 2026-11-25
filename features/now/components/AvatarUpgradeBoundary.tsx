import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Language } from '../../../types';
import { useAppStore } from '../../../stores/appStore';
import { ProtectionStep } from '../../../components/onboarding/ProtectionStep';
import {
  AvatarUpgradeRequiredError,
  initializeAvatarOntology,
  settleExpiredAvatarOntology,
} from '../../../services/avatarOntologyStore';
import { VaultLockedError } from '../../../services/vaultTransaction';

// Track every protection transition, even when React batches lock/unlock into one render.
let protectionGeneration = 0;
useAppStore.subscribe((next, previous) => {
  if (
    next.masterPassword !== previous.masterPassword ||
    next.isUnlocked !== previous.isUnlocked ||
    next.userId !== previous.userId
  )
    protectionGeneration++;
});
const readProtectionGeneration = () => protectionGeneration;
const subscribeProtection = (notify: () => void) => useAppStore.subscribe(notify);

type Result = {
  identity: object;
  kind: 'ready' | 'upgrade' | 'locked' | 'error';
  message?: string;
};

/** Mount no avatar consumers until the protected graph and recovery checkpoint are verified. */
export function AvatarUpgradeBoundary({
  children,
  language,
  onSetPassword,
  onUnlock,
  onBack,
}: {
  children: ReactNode;
  language: Language;
  onSetPassword?: (password: string) => Promise<void>;
  onUnlock?: () => void;
  onBack: () => void;
}) {
  const password = useAppStore((s) => s.masterPassword);
  const unlocked = useAppStore((s) => s.isUnlocked);
  const userId = useAppStore((s) => s.userId);
  const generation = useSyncExternalStore(subscribeProtection, readProtectionGeneration);
  const [attempt, setAttempt] = useState(0);
  // A store transition invalidates readiness during render, before child effects can run.
  const [identity, setIdentity] = useState({ password, unlocked, userId, attempt, generation });
  if (
    identity.password !== password ||
    identity.unlocked !== unlocked ||
    identity.userId !== userId ||
    identity.attempt !== attempt ||
    identity.generation !== generation
  )
    setIdentity({ password, unlocked, userId, attempt, generation });
  const [result, setResult] = useState<Result | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);
  const zh = language === 'zh';
  useEffect(() => {
    let active = true;
    setSettingPassword(false);
    void initializeAvatarOntology().then(() => settleExpiredAvatarOntology()).then(
      () => {
        if (active && generation === readProtectionGeneration())
          setResult({ identity, kind: 'ready' });
      },
      (error: unknown) => {
        if (!active) return;
        setResult({
          identity,
          kind:
            error instanceof AvatarUpgradeRequiredError
              ? 'upgrade'
              : error instanceof VaultLockedError
                ? 'locked'
                : 'error',
          message: error instanceof Error ? error.message : undefined,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [identity, generation]);
  if (result?.identity !== identity)
    return (
      <div className="now-shell" role="status" aria-busy="true">
        {zh ? '正在核验分身资料…' : 'Verifying avatar data…'}
      </div>
    );
  if (result.kind === 'ready') return children;
  if (result.kind === 'upgrade' && settingPassword && onSetPassword)
    return (
      <ProtectionStep
        language={language}
        purpose="avatar-upgrade"
        onSave={async (nextPassword) => {
          const before = readProtectionGeneration();
          await onSetPassword(nextPassword);
          // A key transition already schedules verification; do not race a second migration.
          if (before === readProtectionGeneration()) setAttempt((value) => value + 1);
        }}
        onBack={() => setSettingPassword(false)}
      />
    );
  return (
    <section
      className="onboarding-simple-card"
      aria-label={zh ? '分身资料保护' : 'Avatar protection'}
    >
      <h1>
        {result.kind === 'upgrade'
          ? zh
            ? '设置密码后继续使用分身'
            : 'Protect your avatar to continue'
          : result.kind === 'locked'
            ? zh
              ? '请先解锁资料库'
              : 'Unlock your vault first'
            : zh
              ? '分身资料核验未完成'
              : 'Avatar verification incomplete'}
      </h1>
      <p>
        {zh
          ? '分身已暂停读取、提炼和保存，旧资料保持原样。核验加密快照后将自动恢复。'
          : 'Avatar reading, extraction and saving are paused. Existing data is preserved. Access resumes after the encrypted snapshot is verified.'}
      </p>
      {result.kind === 'error' && <p role="alert">{result.message}</p>}
      {result.kind === 'upgrade' && onSetPassword && (
        <button onClick={() => setSettingPassword(true)}>
          {zh ? '设置密码并升级' : 'Set password and upgrade'}
        </button>
      )}
      {result.kind === 'locked' && onUnlock && (
        <button onClick={onUnlock}>{zh ? '解锁资料库' : 'Unlock vault'}</button>
      )}
      {result.kind === 'error' && (
        <button onClick={() => setAttempt((value) => value + 1)}>
          {zh ? '重新核验' : 'Retry verification'}
        </button>
      )}
      <button onClick={onBack}>{zh ? '返回' : 'Back'}</button>
    </section>
  );
}
