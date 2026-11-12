import { useState, useSyncExternalStore } from 'react';
import { serviceWorkerStatus } from '../lib/pwaRegister';

export function AppUpdateNotice() {
  const available = useSyncExternalStore(
    serviceWorkerStatus.onUpdateAvailable,
    serviceWorkerStatus.isUpdateAvailable,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!available || dismissed) return null;
  return (
    <aside className="app-update-notice" aria-label="版本更新">
      <p role="status">新版本已就绪，请先保存正在编辑的内容。</p>
      {error && <p role="alert">{error}</p>}
      <div>
        <button type="button" disabled={busy} onClick={() => setDismissed(true)}>
          稍后
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('已保存当前内容？更新会重新载入页面，未保存内容可能丢失。')) return;
            setBusy(true);
            setError('');
            try {
              await serviceWorkerStatus.applyUpdate();
            } catch {
              setError('更新失败，请稍后重试。');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? '更新中…' : '保存好了，更新'}
        </button>
      </div>
    </aside>
  );
}
