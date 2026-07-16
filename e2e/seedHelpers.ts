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

export const seedOnboardedApp = async (
  page: Page,
  options: SeedOnboardedAppOptions = {},
): Promise<void> => {
  const password = options.password ?? 'VectorVisual123!';

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Cover screen → Onboarding intro.
  // W4.1 — keep the cover entry anchored on the initialize testid so
  // copy changes on the homepage do not break all onboarding specs.
  const coverEntry = page.getByTestId('cover-initialize');
  await coverEntry.waitFor({ state: 'visible' });
  await coverEntry.click();
  await page.getByTestId('onboarding-password').waitFor({ state: 'visible' });

  // Calibration: master password (twice) then issue recovery key.
  await page.getByTestId('onboarding-password').fill(password);
  await page.getByTestId('onboarding-password-confirm').fill(password);
  await page.getByTestId('onboarding-issue-key').click();
  await page.getByTestId('onboarding-backup-phase').waitFor({ state: 'visible' });

  // Backup: save offline PNG, then enter the app directly.
  await page.getByTestId('onboarding-save-png').click();
  await page.getByTestId('onboarding-recovery-saved').waitFor({ state: 'visible' });
  await page.getByTestId('onboarding-recovery-saved').click();
};
