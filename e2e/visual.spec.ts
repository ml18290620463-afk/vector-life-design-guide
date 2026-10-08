import { expect, test } from '@playwright/test';

/**
 * Visual regression baseline for the public entry surface. Product workspaces
 * are exercised through the core experience suite after onboarding; this file
 * deliberately contains no retired Dashboard or Settings surface.
 */
test.describe('@visual cover screen', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });

  test.beforeEach(async ({ page }) => {
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
