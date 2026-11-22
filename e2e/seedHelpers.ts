import type { Page } from '@playwright/test';

/**
 * Phase 3 §3.f — shared E2E onboarding helper.
 *
 * `useDiaryData` persists everything (password hash, salt, guiding
 * stars, customIdentity) through `idb-keyval`, not raw localStorage,
 * so a Playwright `page.addInitScript` shim cannot fast-forward us
 * past onboarding without re-implementing the entire
 * IndexedDB-keyed schema. Instead we walk the same onboarding flow
 * that `app.spec.ts` / `backup.spec.ts` already use, factored into
 * one helper so the visual baselines stay focused on the rendered
 * surface rather than the click sequence.
 *
 * Wall-clock cost: ~25 s per spec. The visual baselines all share a
 * single Playwright project so the suite total stays under 90 s
 * even with four post-onboarding screens.
 */

export interface SeedOnboardedAppOptions {
  /** Master password for the new vault. Stable so re-seeding the
   *  same machine produces identical hashes. */
  password?: string;
}

/**
 * Start a flow from the real first-run surface.
 *
 * The application deliberately persists vault state in IndexedDB.  Clearing
 * only cookies or localStorage leaves a previous onboarding session intact,
 * which makes entry-flow tests depend on execution order. Use Chromium's
 * storage protocol before opening the app, so React reads a clean state.
 */
export const resetPersistentAppState = async (page: Page): Promise<void> => {
  // Clear storage before the app opens IndexedDB.  Clearing after `goto()`
  // can be blocked by the vault's already-open database connection, leaving
  // the test on a later onboarding step.
  const port = process.env.E2E_PORT ?? '3710';
  const origin = `http://127.0.0.1:${port}`;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'all',
    });
  } finally {
    await client.detach();
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
};

export const seedOnboardedApp = async (
  page: Page,
  options: SeedOnboardedAppOptions = {},
): Promise<void> => {
  const password = options.password ?? 'VectorVisual123!';

  await resetPersistentAppState(page);

  await page.getByTestId('cover-initialize').click();
  await page.getByTestId('onboarding-skip').click();
  await page.getByLabel('此刻发生了什么？').fill('初始化草稿');
  await page.getByLabel('保存到过去').click();
  await page.getByTestId('onboarding-password').fill(password);
  await page.getByTestId('onboarding-password-confirm').fill(password);
  await page.getByTestId('onboarding-protect').click();
  await page.getByRole('navigation', { name: '主页面导航' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '清空草稿' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /清空/ }).click();
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^过去/ })
    .click();
};
