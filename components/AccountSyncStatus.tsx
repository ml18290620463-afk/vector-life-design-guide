import { isSyncPaused, resumeSync } from '../services/account/syncPause';
import {
  listRecoveryCopies,
  exportRecoveryCopy,
  importRecoveryCopy,
  RECOVERY_SELECTION,
} from '../services/account/recovery';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  synchronizeAccount,
  publishLocalConflict,
  eraseAccountCloud,
} from '../services/account/sync';
import { SyncConflictError } from '../services/account/cloud';
import { captureSnapshot, sealSnapshot } from '../services/account/snapshot';
import { accountLocalStorage } from '../services/accountScope';
export function AccountSyncStatus({ email, onLogout }: { email: string; onLogout: () => void }) {
  const password = useAppStore((s) => (s.isUnlocked ? s.masterPassword : null));
  const [status, setStatus] = useState('解锁资料库后同步');
  const [conflict, setConflict] = useState(false);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [remote, setRemote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [eraseConfirmation, setEraseConfirmation] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [copies, setCopies] = useState<string[]>([]);
  useEffect(() => {
    void listRecoveryCopies()
      .then(setCopies)
      .catch(() => setStatus('无法读取恢复副本'));
  }, []);
  const mounted = useRef(true);
  const check = useCallback(async () => {
    if (!password || !navigator.onLine) {
      setStatus(password ? '离线 · 修改保存在本机' : '解锁资料库后同步');
      return;
    }
    try {
      const result = await synchronizeAccount(password);
      if (!mounted.current) return;
      if (result === 'current' || result === 'uploaded') setLastChecked(Date.now());
      setRemote(result === 'remote');
      setConflict(false);
      setStatus(
        result === 'paused'
          ? '自动同步已暂停 · 本机资料保留'
          : result === 'remote'
            ? '其他设备有更新'
            : result === 'locked'
              ? '创建资料库后同步'
              : '已与云端同步',
      );
    } catch (error) {
      if (!mounted.current) return;
      setConflict(error instanceof SyncConflictError);
      setConflictRevision(error instanceof SyncConflictError ? (error.revision ?? null) : null);
      setStatus(error instanceof Error ? error.message : '同步失败，本机资料已保留');
    }
  }, [password]);
  useEffect(() => {
    mounted.current = true;
    void check();
    const interval = window.setInterval(() => void check(), 15000);
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('focus', check);
    };
  }, [check]);
  async function importCopy(file: File) {
    setBusy(true);
    try {
      await importRecoveryCopy(file, recoveryPassword);
      setCopies(await listRecoveryCopies());
      setRecoveryPassword('');
      setStatus('副本已验证并导入，尚未替换本机资料。请在恢复副本中选择恢复。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '副本导入失败');
    } finally {
      setBusy(false);
    }
  }
  async function keepLocal() {
    if (!password || conflictRevision === null) return;
    setBusy(true);
    try {
      await publishLocalConflict(password, conflictRevision);
      setConflict(false);
      await check();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '同步失败');
    } finally {
      setBusy(false);
    }
  }
  async function loadCloud() {
    if (!password) return;
    setBusy(true);
    try {
      const local = await sealSnapshot(await captureSnapshot(), password);
      // Retain a durable encrypted local copy before accepting any replacement.
      const { set } = await import('../services/accountIdb');
      await set(`vector-sync-conflict-copy:${Date.now()}`, local);
      accountLocalStorage.setItem('vector-accept-cloud-once', 'true');
      location.reload();
    } catch {
      setStatus('无法保存本机冲突副本，未替换资料');
      setBusy(false);
    }
  }
  return (
    <details className="account-status">
      <summary>{status}</summary>
      <div className="account-status-panel">
        <p>{email}</p>
        <p role="status">{status}</p>
        {lastChecked && (
          <p>
            最近同步确认：{new Date(lastChecked).toLocaleString()}（之后的编辑需等待下一次同步）
          </p>
        )}
        <p>每 15 秒检查更新。退出前请确认已同步；资料库密码不会上传。</p>
        {isSyncPaused() && (
          <button
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  '恢复同步会尝试上传当前本机版本；若云端已变化，将进入冲突处理。确认继续？',
                )
              ) {
                resumeSync();
                void check();
              }
            }}
          >
            确认当前版本并恢复同步
          </button>
        )}
        <button onClick={() => void check()} disabled={busy}>
          立即同步
        </button>
        {remote && <button onClick={() => location.reload()}>加载其他设备的更新</button>}
        {conflict && (
          <>
            <p>请选择最新版本。云端保留历史版本；加载云端前会在本机保存加密冲突副本。</p>
            <button
              disabled={busy || !password || conflictRevision === null}
              onClick={() => void keepLocal()}
            >
              将本机内容设为最新版本
            </button>
            <button disabled={busy || !password} onClick={() => void loadCloud()}>
              保存本机副本并加载云端
            </button>
          </>
        )}
        <details>
          <summary>导入账号恢复副本</summary>
          <p>仅接受属于当前账号的加密副本。导入先验证，不会立即覆盖资料；恢复前会保留本机版本。</p>
          <label>
            副本的资料库密码
            <input
              type="password"
              autoComplete="off"
              value={recoveryPassword}
              onChange={(event) => setRecoveryPassword(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            选择恢复文件
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy || !recoveryPassword}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importCopy(file);
              }}
            />
          </label>
        </details>
        {copies.length > 0 && (
          <details>
            <summary>本机恢复副本（{copies.length}）</summary>
            <p>恢复后仍需使用原版本的资料库密码解锁。恢复不会立即覆盖云端。</p>
            {copies.map((key) => (
              <div key={key}>
                <p>{new Date(Number(key.split(':').pop())).toLocaleString()}</p>
                <button
                  disabled={busy}
                  onClick={() => {
                    accountLocalStorage.setItem(RECOVERY_SELECTION, key);
                    location.reload();
                  }}
                >
                  恢复此版本
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    void exportRecoveryCopy(key).catch(() => setStatus('副本导出失败'));
                  }}
                >
                  导出加密副本
                </button>
              </div>
            ))}
          </details>
        )}
        <details>
          <summary>删除云端资料</summary>
          <p>
            删除当前账号的全部云端版本，保留本机资料与已导出的文件。云端删除后将阻止旧设备自动重新上传；不能通过“恢复同步”重新启用。服务商的备份保留期仍适用。
          </p>
          <label>
            输入「删除云端资料」确认
            <input
              value={eraseConfirmation}
              onChange={(event) => setEraseConfirmation(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            disabled={busy || !password || eraseConfirmation !== '删除云端资料'}
            onClick={() => {
              setBusy(true);
              void eraseAccountCloud()
                .then(() => {
                  setStatus('云端全部版本已删除，自动同步已暂停。本机资料保留。');
                  setEraseConfirmation('');
                  setLastChecked(null);
                })
                .catch((error) =>
                  setStatus(error instanceof Error ? error.message : '未确认删除，请重试'),
                )
                .finally(() => setBusy(false));
            }}
          >
            确认删除云端全部版本
          </button>
        </details>
        <button disabled={busy} onClick={onLogout}>
          退出账号
        </button>
      </div>
    </details>
  );
}
