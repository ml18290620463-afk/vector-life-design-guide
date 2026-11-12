import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';
for (const width of [390, 1440]) {
  test(`future consent preserves draft and saves ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^未来/ })
      .click();
    await page.getByRole('button', { name: '添加行动', exact: true }).click();
    await page.getByLabel('行动内容').fill('私密的未来计划');
    const editor = page.getByRole('dialog', { name: '行动规划' });
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    const consent = page.getByRole('dialog', { name: '是否允许 AI 可见？' });
    await expect(consent).toBeVisible();
    await consent.getByRole('button', { name: '返回编辑' }).click();
    await expect(page.getByLabel('行动内容')).toHaveValue('私密的未来计划');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(consent).toBeVisible();
    await page.screenshot({ path: `/private/tmp/vector-future-consent-${width}.png` });
    await consent.getByRole('button', { name: /仅自己可见/ }).click();
    await expect(editor).toHaveCount(0);
    for (const kind of ['愿景', '目标']) {
      await page.getByRole('button', { name: `添加${kind}`, exact: true }).click();
      await page.getByLabel(`${kind}内容`, { exact: true }).fill(`授权的${kind}`);
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(consent).toBeVisible();
      await consent.getByRole('button', { name: /允许 AI 可见/ }).click();
      await expect(consent).toHaveCount(0);
      await expect(page.getByLabel(`${kind}内容`, { exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
