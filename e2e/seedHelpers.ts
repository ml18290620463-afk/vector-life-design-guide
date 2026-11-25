import type { Page } from '@playwright/test';

/** Tests for protected-vault features use a fixture created through the real
 * storage API. First-run UX is tested separately without this fixture. */
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
  await page.getByRole('navigation', { name: '主页面导航' }).waitFor({ state: 'visible' });
  await page.evaluate(async (password) => {
    const securityPath = '/services/securityService.ts';
    const vaultPath = '/services/vaultTransaction.ts';
    const { SecurityService } = await import(/* @vite-ignore */ securityPath);
    const { changeFutureProtection } = await import(/* @vite-ignore */ vaultPath);
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const hash = await SecurityService.hashPassword(password, salt);
    await changeFutureProtection(password, hash, salt);
  }, password);
  await page.reload();
  const input = page.locator('input[type="password"]:visible');
  await input.fill(password);
  await input.press('Enter');
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^过去/ })
    .click();
};

export async function choosePrivateVisibility(page: Page) {
  await page
    .getByRole('dialog', { name: '是否允许 AI 可见？' })
    .getByRole('button', { name: /^仅自己可见/ })
    .click();
}
