import { test, expect } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`现在实际记录闭环 ${viewport.width}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await seedOnboardedApp(page);
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect(page.getByRole('button', { name: '写下第一条记录' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('first-entry.png'), fullPage: true });
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    await expect(page.getByTestId('now-page')).toBeVisible();
    const emptyCard = page.locator('.now-card');
    await expect(emptyCard).toHaveClass(/now-card--empty/);
    await expect(page.locator('#now-record-guide, #now-materials-hint')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('now-minimal.png'), fullPage: true });
    const emptyCardHeight = (await emptyCard.boundingBox())!.height;
    await page.getByLabel('保存到过去').click();
    await expect(page.getByText('请先输入内容或添加素材', { exact: true })).toBeVisible();
    const message = `模拟测试${viewport.width}：今天主动澄清会议目标，讨论更聚焦。`;
    await page.getByLabel('此刻发生了什么？').fill(message);
    await expect(emptyCard).not.toHaveClass(/now-card--empty/);
    if (viewport.width >= 1000) {
      // The first-use state stays compact; once a person is actually writing,
      // the document opens into the normal, longer writing surface.
      expect((await emptyCard.boundingBox())!.height).toBeGreaterThan(emptyCardHeight + 60);
    }
    await page.getByLabel('保存到过去').click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect(page.getByText(message, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '写下第一条记录' })).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: '搜索记录' })).toHaveValue('');
    await page.getByRole('searchbox', { name: '搜索记录' }).fill('模拟测试');
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    await page.getByLabel('此刻发生了什么？').fill(message + ' 再补充一条带标签的记录。');
    await page.getByLabel('心情与事件').click();
    await page.getByRole('button', { name: '工作事业', exact: true }).click();
    await page.getByRole('button', { name: '平静', exact: true }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByLabel('此刻发生了什么？')).toHaveValue(
      message + ' 再补充一条带标签的记录。',
    );
    await expect(page.getByLabel('心情与事件')).toContainText('工作事业 · 平静');
    await expect(page.getByLabel('心情与事件')).not.toContainText('2/2');
    await page.getByRole('button', { name: /^(返回|返回过去)$/ }).click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    await page.getByRole('button', { name: '清空草稿' }).click();
    await expect(page.getByRole('dialog', { name: '清空草稿？' })).toBeVisible();
    await expect(page.getByRole('button', { name: '继续编辑', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('draft-exit.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('此刻发生了什么？')).toHaveValue(
      message + ' 再补充一条带标签的记录。',
    );

    await page.locator('input[type=file][accept="image/*"]').setInputFiles({
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.getByLabel('删除素材')).toBeVisible();
    await page.getByLabel('删除素材').click();
    await expect(page.getByLabel('删除素材')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath('now-filled.png'), fullPage: true });
    await page.getByLabel('保存到过去').click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: '搜索记录' })).toHaveValue('');
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(
      page.getByText(message + ' 再补充一条带标签的记录。', { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('past-saved.png'), fullPage: true });
  });
}

test('链接输入支持取消、校验和替换', async ({ page }) => {
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^现在/ })
    .click();
  await page.getByRole('button', { name: '添加素材' }).click();
  await page.getByRole('button', { name: '链接', exact: true }).click();
  await expect(page.getByLabel('网页链接', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.now-material')).toHaveCount(0);
  await page.getByRole('button', { name: '添加素材' }).click();
  await page.getByRole('button', { name: '链接', exact: true }).click();
  await page.getByLabel('网页链接', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '添加链接' })).toBeVisible();
  await page.getByLabel('网页链接', { exact: true }).fill('example.com');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.locator('.now-material')).toHaveCount(1);
  await page.locator('.now-material__replace-link').click();
  await expect(page.getByLabel('网页链接', { exact: true })).toHaveValue('https://example.com/');
  await page.getByLabel('网页链接', { exact: true }).fill('https://example.org');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.locator('.now-material')).toHaveCount(1);
  await expect(page.locator('.now-material')).toContainText('example.org');
});
