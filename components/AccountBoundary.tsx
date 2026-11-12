import React, { lazy, Suspense, useEffect, useState } from 'react';
import { accountsEnabled, accountsRequired, clearSavedSession, logoutAccount, resumeAccount, sendEmailCode, verifyEmailCode, type AccountSession } from '../services/account/auth';
import { initializeAccountScope, accountLocalStorage } from '../services/accountScope';
import { holdAccountTab } from '../services/account/tabLock';
import { readCloudRevision, type CloudRevision } from '../services/account/cloud';
import { applySnapshot, captureSnapshot, fingerprint, hasVault, openSnapshot, readSyncBase, recoverSnapshotRestore } from '../services/account/snapshot';
import { RECOVERY_SELECTION, readRecoveryCopy } from '../services/account/recovery';
import { saveSyncBase } from '../services/account/snapshot';
import './account.css';
const App = lazy(() => import('../App'));
const AccountSyncStatus = lazy(() => import('./AccountSyncStatus').then((module) => ({ default: module.AccountSyncStatus })));
let resume: ReturnType<typeof resumeAccount> | undefined;
export function AccountBoundary() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState('');
  const [remote, setRemote] = useState<CloudRevision | null>(null);
  const [expectedHash, setExpectedHash] = useState('');
  const [ready, setReady] = useState(!accountsEnabled && !accountsRequired);
  const [busy, setBusy] = useState(accountsEnabled);
  const [message, setMessage] = useState('');
  async function prepare(account: AccountSession) {
    initializeAccountScope(account.user.id);
    setSession(account);
    await holdAccountTab();
    await recoverSnapshotRestore();
    const local = await captureSnapshot();
    const hash = await fingerprint(local);
    const base = readSyncBase();
    const selectedRecovery = accountLocalStorage.getItem(RECOVERY_SELECTION);
    if (selectedRecovery) {
      setRemote({ revision: base.revision, payload: await readRecoveryCopy(selectedRecovery), created_at: '' });
      setExpectedHash(hash);
      return;
    }
    const cloud = await readCloudRevision();
    if (cloud && (!hasVault(local) || (cloud.revision !== base.revision && (base.fingerprint === hash || accountLocalStorage.getItem('vector-accept-cloud-once') === 'true')))) {
      setRemote(cloud); setExpectedHash(hash);
    } else setReady(true);
  }
  useEffect(() => {
    if (!accountsEnabled) return;
    let active = true;
    resume ??= resumeAccount();
    void resume.then(async (account) => { if (active && account) await prepare(account); }).catch((error) => { if (active) setMessage(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== 'vector-account-logout' || !event.newValue || !session) return;
      try { if (JSON.parse(event.newValue).id === session.user.id) { clearSavedSession(); location.reload(); } } catch { /* Ignore malformed unrelated storage events. */ }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [session]);
  async function logout() {
    setReady(false); setBusy(true); setPassword('');
    // Immediately unmount the diary before attempting remote revocation.
    const { useAppStore } = await import('../stores/appStore');
    useAppStore.setState({ masterPassword: null, isUnlocked: false, selectedEntry: null, avatarLaunchContext: null });
    await logoutAccount(); location.reload();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (remote) {
        const snapshot = await openSnapshot(remote.payload, password);
        await applySnapshot(snapshot, remote.revision, expectedHash, password);
        if (accountLocalStorage.getItem(RECOVERY_SELECTION)) {
          saveSyncBase({ revision: remote.revision, fingerprint: '' });
          accountLocalStorage.removeItem(RECOVERY_SELECTION);
        }
        accountLocalStorage.removeItem('vector-accept-cloud-once');
        setPassword(''); setRemote(null); setReady(true);
      } else if (!sent) { await sendEmailCode(email); setSent(true); setMessage('登录邮件已发送。请在这台电脑打开最新邮件中的链接；若邮件提供数字验证码，也可在下方输入。'); }
      else { await prepare(await verifyEmailCode(email, code)); }
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作未完成，请重试'); }
    finally { setBusy(false); }
  }
  if (ready) return <Suspense fallback={<div className="account-screen">正在打开资料库…</div>}><App />{session && <AccountSyncStatus email={session.user.email ?? '当前账号'} onLogout={() => void logout()} />}</Suspense>;
  return <main className="account-screen"><section className="account-form">
    <h1>{remote ? '打开你的资料库' : '登录 VECTOR'}</h1>
    <p>{remote ? '已找到加密资料。输入该版本的资料库密码，在这台设备上恢复。' : '使用邮箱确认身份，让每个人拥有独立的记录空间。'}</p>
    {!accountsEnabled ? <p role="alert">账号服务尚未配置，暂不能开放多人使用。</p> : <form onSubmit={(event) => void submit(event)}>
      {remote ? <label>资料库密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label> : <><label>邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent || Boolean(session)} required /></label>{sent && <label>邮箱验证码<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" value={code} onChange={(event) => setCode(event.target.value)} required /></label>}</>}
      <button type="submit" disabled={busy || Boolean(session && !remote)}>{busy ? '正在处理…' : remote ? '解密并恢复' : sent ? '验证并登录' : '发送登录邮件'}</button>
      {sent && !session && <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); }}>重新发送或更换邮箱</button>}
    </form>}
    {message && <p role="status">{message}</p>}
    {session && <button disabled={busy} onClick={() => void logout()}>退出账号</button>}
    {message && <button disabled={busy} onClick={() => location.reload()}>重新加载</button>}
    <p className="account-help">邮件链接或验证码用于登录；资料库密码用于加密。旧版本地资料需由本人导出加密备份，再登录账号导入。</p>
  </section></main>;
}
