import { test, expect } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

for (const width of [390, 1440]) {
  test(`补充保留原记录与时间，图片可查看，刷新可恢复 ${width}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    const navigation = page.getByRole('navigation', { name: '主页面导航' });
    await navigation.getByRole('button', { name: /^现在/ }).click();
    await page.getByLabel('此刻发生了什么？').fill('原始记录：今天参观展览');
    await page.locator('input[type=file][accept="image/*"]').setInputFiles({
      name: 'exhibition.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(page.locator('.now-material')).toHaveCount(1);
    await page.getByLabel('心情与事件').click();
    await page.getByRole('button', { name: '工作事业', exact: true }).click();
    await expect(page.getByRole('button', { name: '工作事业', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByLabel('保存到过去').click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    const original = page.locator('.past-record').filter({ hasText: '原始记录：今天参观展览' });
    const timestamp = await original.locator('.past-record__date').getAttribute('datetime');
    expect(timestamp).toBeTruthy();
    const imageButton = original.getByRole('button', { name: /^查看图片/ });
    await imageButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '放大', exact: true }).click({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '适应窗口' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(imageButton).toBeFocused();

    await navigation.getByRole('button', { name: /^现在/ }).click();
    await page.getByLabel('此刻发生了什么？').fill('第二条记录：保留历史顺序');
    await page.getByLabel('保存到过去').click();
    await expect(page.locator('.past-record').first()).toContainText('第二条记录');
    await original.getByRole('button', { name: '补充', exact: true }).click();
    await page.getByLabel('补充内容').fill('后来想起：摄影师是林先生');
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(original.getByText('后来想起：摄影师是林先生', { exact: true })).toBeVisible();
    await expect(original.locator('.past-record__date')).toHaveAttribute('datetime', timestamp!);
    await expect(page.locator('.past-record').first()).toContainText('第二条记录');
    expect(
      Date.parse((await original.locator('.past-supplement time').getAttribute('datetime'))!),
    ).toBeGreaterThan(Date.parse(timestamp!));
    const search = page.getByRole('searchbox', { name: '搜索记录' });
    await search.fill('工作事业 林先生');
    await expect(page.locator('.past-record')).toHaveCount(1);
    await expect(original).toBeVisible();
    await search.fill('');
    await page.screenshot({ path: info.outputPath('past-supplement.png'), fullPage: true });

    await page.reload();
    const password = page.locator('input[type="password"]:visible');
    await expect(password).toHaveCount(1);
    await password.fill('VectorVisual123!');
    await password.press('Enter');
    await expect(navigation).toBeVisible();
    await navigation.getByRole('button', { name: /^过去/ }).click();
    await expect(original).toBeVisible();
    await expect(original.locator('.past-record__date')).toHaveAttribute('datetime', timestamp!);
    await expect(original.locator('.past-supplement')).toHaveCount(1);
    await expect(original).toContainText('后来想起：摄影师是林先生');
    await expect(original.locator('img')).toHaveCount(1);
    await expect(page.locator('.past-record').first()).toContainText('第二条记录');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
