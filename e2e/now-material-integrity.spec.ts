import { test, expect } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

test('混合素材经过草稿恢复后完整保存到过去', async ({ page }) => {
  test.setTimeout(120_000);
  await seedOnboardedApp(page);
  const openNow = () =>
    page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
  await openNow();
  await page.getByLabel('此刻发生了什么？').fill('展览照片与参考网页');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({
    name: 'exhibition.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('.now-material')).toHaveCount(1);
  for (const url of ['https://example.com/exhibition', 'https://example.org/artist']) {
    await page.getByRole('button', { name: '添加素材' }).click();
    await page.getByRole('button', { name: '链接', exact: true }).click();
    await page.getByLabel('网页链接', { exact: true }).fill(url);
    await page.getByRole('button', { name: '确定', exact: true }).click();
  }
  await expect(page.locator('.now-material')).toHaveCount(3);
  await page.getByRole('button', { name: /^(返回|返回过去)$/ }).click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await openNow();
  await expect(page.getByLabel('此刻发生了什么？')).toHaveValue('展览照片与参考网页');
  await expect(page.locator('.now-material')).toHaveCount(3);
  await expect(page.locator('.now-material img')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByLabel('保存到过去').click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await expect(page.getByText('展览照片与参考网页', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="https://example.com/exhibition"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://example.org/artist"]')).toHaveCount(1);
  await expect(page.locator('img[src^="data:image/png"]')).toHaveCount(1);
  await page.reload();
  const password = page.locator('input[type="password"]:visible');
  await expect(password).toHaveCount(1);
  await password.fill('VectorVisual123!');
  await password.press('Enter');
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^过去/ })
    .click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await expect(page.getByText('展览照片与参考网页', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="https://example.com/exhibition"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://example.org/artist"]')).toHaveCount(1);
  await expect(page.locator('img[src^="data:image/png"]')).toHaveCount(1);
  await openNow();
  await expect(page.getByLabel('此刻发生了什么？')).toHaveValue('');
  await expect(page.locator('.now-material')).toHaveCount(0);
});
