import { currentAccountId } from '../accountScope';
let held: Promise<void> | undefined;
/** One writer tab per account prevents stale in-memory editors after a cloud restore. */
export function holdAccountTab() {
  held ??= new Promise<void>((resolve, reject) => {
    if (!navigator.locks) { reject(new Error('请使用支持安全存储的新版浏览器，并通过 HTTPS 打开')); return; }
    void navigator.locks.request(`vector-account-tab:${currentAccountId()}`, { ifAvailable: true }, async (lock) => {
      if (!lock) { reject(new Error('此账号已在另一个标签页打开，请关闭该标签页后重试')); return; }
      resolve();
      await new Promise<void>(() => { /* Released by the browser when this page closes. */ });
    }).catch(reject);
  });
  return held;
}
