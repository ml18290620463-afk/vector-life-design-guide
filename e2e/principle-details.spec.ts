import { test, expect } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';
for (const width of [320, 390, 600, 1440]) {
  test(`principle optional details ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    await page.locator('.now-editor textarea').waitFor();
    const nowFontSize = await page
      .locator('.now-editor textarea')
      .evaluate((el) => getComputedStyle(el).fontSize);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^过去/ })
      .click();
    await page.getByRole('tab', { name: '沉淀', exact: true }).click();
    await page.getByRole('button', { name: '写原则', exact: true }).click();
    await page.getByRole('textbox', { name: '刻录新原则' }).fill('先澄清目标再行动');
    await expect(page.getByRole('textbox', { name: '刻录新原则' })).toHaveCSS(
      'font-size',
      nowFontSize,
    );
    if (width <= 600) {
      const canvas = await page.locator('.principle-editor-canvas').boundingBox();
      expect(canvas!.x).toBe(0);
      expect(canvas!.width).toBe(width);
      await expect(page.locator('.principle-editor-canvas')).toHaveCSS('padding-left', '16px');
    }
    await expect(page.getByLabel('适用时刻', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /补充说明/ }).click();
    await page.getByLabel('适用时刻', { exact: true }).fill('开始新项目时');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '书写原则', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /补充说明/ })).toBeFocused();
    await page.getByRole('button', { name: /补充说明/ }).click();
    await expect(page.getByLabel('适用时刻', { exact: true })).toHaveValue('开始新项目时');
    const bounds = await page.getByRole('dialog', { name: '补充说明', exact: true }).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.height).toBeLessThan(600);
    await page.screenshot({ path: `/private/tmp/principle-details-${width}.png` });
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await page.screenshot({ path: `/private/tmp/principle-writing-${width}.png` });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('先澄清目标再行动', { exact: true }).first()).toBeVisible();
  });
}
