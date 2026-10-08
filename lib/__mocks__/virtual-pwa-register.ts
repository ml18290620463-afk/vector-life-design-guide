/**
 * Vitest stub for the `virtual:pwa-register` module that
 * `vite-plugin-pwa` provides at build time. The plugin isn't loaded
 * inside the vitest pipeline, so we ship a tiny no-op shim here that
 * exposes the same `registerSW` shape `lib/pwaRegister.ts` consumes.
 *
 * Production code never reaches this file — see
 * `vitest.config.ts > resolve.alias` for the alias.
 */

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
}

export const registerSW = (_options?: RegisterSWOptions) => {
  // No-op in tests. Returns the canonical "update" callback shape so
  // future tests can call it without smoke-throwing.
  return (_reload?: boolean): Promise<void> => Promise.resolve();
};
