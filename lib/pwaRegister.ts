/** Register updates without interrupting a writing session. */
let updateAvailable = false;
const subscribers = new Set<() => void>();
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

export interface ServiceWorkerStatus {
  /** True once an updated SW is waiting for the user to confirm. */
  isUpdateAvailable: () => boolean;
  applyUpdate: () => Promise<void>;
  /**
   * Subscribe to updates. The callback fires once when an update is
   * detected. Returns an unsubscribe function.
   */
  onUpdateAvailable: (cb: () => void) => () => void;
}

const status: ServiceWorkerStatus = {
  isUpdateAvailable: () => updateAvailable,
  applyUpdate: async () => {
    if (!updateSW) throw new Error('更新尚未就绪，请稍后重试');
    await updateSW(true);
  },
  onUpdateAvailable: (cb) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
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
      updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          updateAvailable = true;
          subscribers.forEach((notify) => notify());
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
