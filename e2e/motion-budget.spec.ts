import { expect, test } from '@playwright/test';
for (const mode of ['mobile', 'disabled'] as const) {
  test(`${mode} cover does not download or mount heavy visuals`, async ({ page }) => {
    await page.setViewportSize({ width: mode === 'mobile' ? 390 : 1440, height: 900 });
    await page.addInitScript((disabled) => {
      localStorage.clear();
      if (disabled) localStorage.setItem('vector-reduce-motion', 'true');
    }, mode === 'disabled');
    const heavy: string[] = [];
    page.on('request', (request) => {
      if (
        /RibbonFabric|RibbonCurrent|SpaceTimeBackground|CoverParticleArrow|CoverIceFlow/.test(
          request.url(),
        )
      )
        heavy.push(request.url());
    });
    await page.goto('/');
    await expect(page.getByTestId('vector-home')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(heavy).toEqual([]);
  });
}
