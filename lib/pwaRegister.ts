/**
 * W3.2 — Service worker registration glue.
 *
 * `injectRegister: 'auto'` in vite-plugin-pwa would already insert
 * a basic registration script for us, but doing it by hand here
 * gives us:
 *   1. A typed entry point (`registerVectorServiceWorker`) so the
 *      bootstrap call from `index.tsx` is greppable.
 *   2. A console-only "update available" hook today; trivial to
 *      promote into a UI banner later (W4 / post-launch) by
 *      surfacing the `updateSW` callback through React context.
 *   3. A clean no-op when running under `vite dev` without
 *      `VITE_PWA_DEV=1` (the `virtual:pwa-register` import returns
 *      a stub in that mode).
 *
 * We intentionally do NOT auto-update — the `'prompt'` register type
 * means a new SW waits until the user accepts. This avoids
 * surprising layout / behaviour changes mid-session on long-lived
 * tabs (a common journaling pattern for VECTOR users).
 */

let updateAvailable = false;
let updateCallback: (() => void) | null = null;

export interface ServiceWorkerStatus {
  /** True once an updated SW is waiting for the user to confirm. */
  isUpdateAvailable: () => boolean;
  /**
   * Subscribe to updates. The callback fires once when an update is
   * detected. Returns an unsubscribe function.
   */
  onUpdateAvailable: (cb: () => void) => () => void;
}

const status: ServiceWorkerStatus = {
  isUpdateAvailable: () => updateAvailable,
  onUpdateAvailable: (cb) => {
    updateCallback = cb;
    return () => {
      if (updateCallback === cb) updateCallback = null;
    };
  },
};

/**
 * Wired in `index.tsx` AFTER React renders. Lazy-imports the virtual
 * register module so the workbox-window blob (~12 kB gzip) doesn't
 * land in the critical bundle.
 *
 * Returns the status singleton so callers can later wire a UI banner.
 */
export const registerVectorServiceWorker = (): ServiceWorkerStatus => {
  // SW is a no-op in test environments and in browsers without it.
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return status;
  }
  // Don't register from the inline dev server unless the operator
  // explicitly opted in via VITE_PWA_DEV=1 (matches the gate in
  // vite.config.ts).
  if (import.meta.env.DEV && import.meta.env.VITE_PWA_DEV !== '1') {
    return status;
  }

  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          updateAvailable = true;
          if (updateCallback) updateCallback();
          // Console hint for the developer in this release; a UI
          // banner is on the post-launch list.
          console.info('[VECTOR SW] A new version is available — refresh to apply.');
        },
        onOfflineReady() {
          console.info('[VECTOR SW] Cached for offline use.');
        },
        onRegisterError(error) {
          console.warn('[VECTOR SW] Registration failed:', error);
        },
      });
    })
    .catch((error) => {
      // The virtual module isn't available in some test runners or
      // when the plugin is intentionally disabled — degrade silently.
      if (import.meta.env.DEV) {
        console.debug('[VECTOR SW] register skipped:', error);
      }
    });

  return status;
};

export const serviceWorkerStatus = status;
