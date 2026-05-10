import { describe, expect, it } from 'vitest';
import { registerVectorServiceWorker, serviceWorkerStatus } from './pwaRegister';

describe('registerVectorServiceWorker', () => {
  it('returns the singleton status object', () => {
    const status = registerVectorServiceWorker();
    expect(status).toBe(serviceWorkerStatus);
    expect(typeof status.isUpdateAvailable).toBe('function');
    expect(typeof status.onUpdateAvailable).toBe('function');
  });

  it('isUpdateAvailable defaults to false', () => {
    expect(serviceWorkerStatus.isUpdateAvailable()).toBe(false);
  });

  it('onUpdateAvailable returns an unsubscribe function', () => {
    const unsubscribe = serviceWorkerStatus.onUpdateAvailable(() => {});
    expect(typeof unsubscribe).toBe('function');
    // Should not throw on second call.
    unsubscribe();
    unsubscribe();
  });

  it('does NOT throw when called in a happy-dom environment without service worker support', () => {
    // happy-dom does not implement navigator.serviceWorker, so the
    // early-return branch fires and the function silently no-ops.
    expect(() => registerVectorServiceWorker()).not.toThrow();
  });
});
