import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

/**
 * Visual regression baseline — Phase 3 §3.f.
 *
 * Captures screenshots of stable surfaces and compares them against
 * committed baselines. The first run on any machine writes the
 * baseline to `e2e/visual.spec.ts-snapshots/`; subsequent runs diff
 * against that baseline.
 *
 *  - We disable animations via `prefers-reduced-motion: reduce` and the
 *    Playwright `animations: 'disabled'` flag so the diffs aren't
 *    fragile to hover/twinkle motion.
 *  - We pin the viewport to `1280×800` so screenshots are
 *    machine-portable.
 *  - The screenshot tolerance defaults to `maxDiffPixelRatio: 0.02`
 *    (2 %), which is enough to absorb subpixel font rendering between
 *    macOS / Linux CI without losing meaningful regressions.
 *
 * Scenarios (Phase 3 §3.f checklist target — core screens):
 *   ✓ Cover screen
 *   ✓ Dashboard (post-onboarding, vault locked)
 *   ✓ Settings panel (open over Dashboard)
 *
 * Post-onboarding baselines walk the actual onboarding flow via
 * `e2e/seedHelpers.ts::seedOnboardedApp` rather than mocking the
 * IndexedDB persistence layer; the wall-clock cost (~25 s per spec)
 * is acceptable for visual-regression cadence.
 */
test.describe('@visual cover screen', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });

  test.beforeEach(async ({ page }) => {
    // `prefers-reduced-motion` collapses our `<MotionConfig>` so star
    // twinkles / fades freeze, making the screenshots deterministic
    // across CI runs.
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('default cover mode matches baseline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('cover-default.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});

test.describe('@visual post-onboarding surfaces', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('dashboard renders the launchpad header + filter bar', async ({ page }) => {
    test.setTimeout(90_000);
    await seedOnboardedApp(page);
    await page.goto('/?preview=web&screen=dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-system-hub')).toBeVisible();
    // Let any post-onboarding fade-in settle before the snapshot.
    await page.waitForTimeout(700);
    await expect(page).toHaveScreenshot('dashboard-default.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.04,
      fullPage: false,
    });
  });

  test('settings panel renders open over the dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await seedOnboardedApp(page);
    await page.goto('/?preview=web&screen=dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-system-hub')).toBeVisible();
    await page.getByRole('button', { name: /系统设置|System settings/i }).click();
    // Wait for the modal entry animation to settle.
    await page.waitForTimeout(700);
    await expect(page).toHaveScreenshot('settings-panel.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.04,
      fullPage: false,
    });
  });

});
