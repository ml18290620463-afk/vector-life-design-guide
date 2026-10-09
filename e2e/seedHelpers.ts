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

  // Cover screen → Onboarding intro.
  // W4.1 — keep the cover entry anchored on the initialize testid so
  // copy changes on the homepage do not break all onboarding specs.
  const coverEntry = page.getByTestId('cover-initialize');
  const passwordEntry = page.getByTestId('onboarding-password');
  await coverEntry.or(passwordEntry).first().waitFor({ state: 'visible' });
  // The cover entry starts a decorative launch animation. Dispatch the
  // activation directly so E2E setup exercises the same handler without
  // intermittently waiting for a moving visual layer to become actionable.
  if (await coverEntry.isVisible()) await coverEntry.dispatchEvent('click');
  await page.getByTestId('onboarding-password').waitFor({ state: 'visible' });

  // Calibration: master password (twice) then issue recovery key.
  await page.getByTestId('onboarding-password').fill(password);
  await page.getByTestId('onboarding-password-confirm').fill(password);
  await page.getByTestId('onboarding-issue-key').click();
  await page.getByTestId('onboarding-backup-phase').waitFor({ state: 'visible' });

  // Backup: save offline PNG, then enter the app directly.
  // PNG rendering can synchronously disable this control while the browser
  // serializes the credential card. Dispatch the same activation directly so
  // setup does not race Playwright's actionability retry with that transient
  // disabled state.
  await page.getByTestId('onboarding-save-png').dispatchEvent('click');
  await page.getByTestId('onboarding-recovery-saved').waitFor({ state: 'visible' });
  await page.getByTestId('onboarding-recovery-saved').click();
  // Completing onboarding persists an encrypted vault asynchronously.  Do not
  // navigate away before the main shell is visible, otherwise the route change
  // can interrupt the persistence and leave the test on the setup screen.
  await page.getByRole('navigation', { name: '主页面导航' }).waitFor({ state: 'visible' });
};
