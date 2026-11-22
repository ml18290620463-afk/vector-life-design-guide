import { useState } from 'react';
import type { Language } from '../../types';

export function ProtectionStep({
  language,
  onSave,
  onBack,
}: {
  language: Language;
  onSave: (password: string) => Promise<void>;
  onBack: () => void;
}) {
  const zh = language === 'zh';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="onboarding-simple-card"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
          setError(
            zh
              ? '请使用至少 8 位字母和数字。'
              : 'Use at least 8 characters including letters and numbers.',
          );
          return;
        }
        if (password !== confirmation) {
          setError(zh ? '两次密码不一致。' : 'Passwords do not match.');
          return;
        }
        setBusy(true);
        setError('');
        try {
          await onSave(password);
        } catch {
          setError(
            zh
              ? '未能保存，内容仍保留在此页，请重试。'
              : 'Could not save. Your draft is still here. Please retry.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>{zh ? '保存前，保护这条记录' : 'Protect your first entry'}</h1>
      <p>
        {zh
          ? '设置本机解锁密码后，草稿将加密保存。请牢记密码；恢复密钥与备份可稍后在设置中管理。'
          : 'Your draft will be encrypted with your device password. Remember it; recovery and backups are available in settings.'}
      </p>
      <label>
        {zh ? '密码（至少 8 位字母和数字）' : 'Password (8+ characters, letters and numbers)'}
        <input
          data-testid="onboarding-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          required
        />
      </label>
      <label>
        {zh ? '确认密码' : 'Confirm password'}
        <input
          data-testid="onboarding-password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={busy}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" data-testid="onboarding-protect" disabled={busy}>
        {busy ? (zh ? '正在加密…' : 'Encrypting…') : zh ? '加密保存草稿' : 'Save encrypted draft'}
      </button>
      <button type="button" className="onboarding-secondary" disabled={busy} onClick={onBack}>
        {zh ? '返回编辑' : 'Back to writing'}
      </button>
    </form>
  );
}
