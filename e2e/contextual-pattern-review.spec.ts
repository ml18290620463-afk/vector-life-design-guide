import { expect, test, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

async function record(page: Page, text: string) {
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^现在/ })
    .click();
  await page.getByLabel('此刻发生了什么？').fill(text);
  await page.getByLabel('保存到过去').click();
}

// Past intentionally keeps user-maintained principles separate from avatar patterns.
for (const width of [1440, 390]) {
  test(`相似记录保存不中断，沉淀保留手写原则入口 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    const records = ['我今天又拖延了任务，下午才动手。', '我今天拖延了另一项任务，一直放着。'];
    for (const content of records) {
      await record(page, content);
      await expect(page.getByTestId('past-page')).toBeVisible();
      await expect(page.getByText(content, { exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: '这像是你的一个模式吗？' })).toHaveCount(0);
    }
    await page.getByRole('tab', { name: '沉淀', exact: true }).click();
    await expect(page.getByRole('button', { name: '提炼模式', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '写原则', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '书写原则' })).toBeVisible();
    await expect(page.getByLabel('关联模式（可选）')).toHaveCount(0);
  });
}
