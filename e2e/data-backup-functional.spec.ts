import { expect, test, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const navigate = (page: Page, name: RegExp) =>
  page.getByRole('navigation', { name: '主页面导航' }).getByRole('button', { name }).click();

// Exercise the actual downloaded encrypted file in a separate browser profile.
test('数据备份可直接发现，并在全新资料库中恢复记录', async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await navigate(page, /^现在/);
  const content = '跨设备恢复演练：先澄清目标，再决定下一步行动。';
  await page.getByLabel('此刻发生了什么？').fill(content);
  await page.locator('input[type=file][accept="image/*"]').setInputFiles('public/icon-192.png');
  await page.getByLabel('保存到过去').click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  const record = page.locator('.past-record').filter({ hasText: content });
  await expect(record.locator('img')).toHaveCount(1);
  const recordedAt = await record.locator('.past-record__date').getAttribute('datetime');
  await record.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByLabel('补充内容').fill('备份补充：保留当时的判断和图片。');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page, /^分身/);
  await page.getByRole('button', { name: '备份', exact: true }).click();
  const panel = page.getByRole('region', { name: '备份与恢复' });
  await expect(panel.getByRole('heading', { name: '备份与恢复' })).toBeVisible();
  await expect(panel.getByText('带走完整资料，回到任何一台设备后继续使用。')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: '生成备份', exact: true }).click();
  const download = await downloadPromise;
  const backupPath = info.outputPath('encrypted-backup.json');
  await download.saveAs(backupPath);
  await page.screenshot({ path: info.outputPath('backup-mobile.png'), fullPage: true });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);

  const freshContext = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    const fresh = await freshContext.newPage();
    fresh.setDefaultTimeout(15_000);
    // A different password catches accidental dependence on the source vault's session key.
    await seedOnboardedApp(fresh, { password: 'FreshVector456!' });
    await navigate(fresh, /^分身/);
    await fresh.getByRole('button', { name: '备份', exact: true }).click();
    const restore = fresh.getByRole('region', { name: '备份与恢复' });
    await expect(restore.getByRole('heading', { name: '备份与恢复' })).toBeVisible();
    await restore.getByRole('button', { name: '恢复备份', exact: true }).click();
    await restore.locator('input[type=file]').setInputFiles(backupPath);
    await restore.getByLabel('备份密令', { exact: true }).fill('VectorVisual123!');
    await expect(restore.getByRole('button', { name: '合并恢复', exact: true })).toBeDisabled();
    await restore.getByRole('button', { name: '检查备份', exact: true }).click();
    const inspection = restore.getByLabel('备份检查结果');
    await expect(inspection).toContainText('备份资料范围');
    await expect(inspection).toContainText('经历 1 · 补充 1 · 素材 1');
    await expect(inspection).toContainText('已确认记忆');
    await expect(restore.getByRole('button', { name: '合并恢复', exact: true })).toBeEnabled();
    await restore.getByRole('button', { name: '合并恢复', exact: true }).click();
    await expect(restore.getByText('已选择：', { exact: false })).toHaveCount(0);
    await expect(restore.getByLabel('恢复结果')).toContainText('已完成合并恢复');
    await navigate(fresh, /^过去/);
    await expect(fresh.getByTestId('past-page')).toBeVisible();
    await expect(fresh.getByText(content, { exact: false }).first()).toBeVisible();
    await fresh.getByRole('searchbox', { name: '搜索记录' }).fill('澄清目标');
    await expect(fresh.getByText(content, { exact: false }).first()).toBeVisible();
    await fresh.reload();
    const password = fresh.locator('input[type=password]:visible');
    await password.fill('FreshVector456!');
    await password.press('Enter');
    await navigate(fresh, /^过去/);
    const restored = fresh.locator('.past-record').filter({ hasText: content });
    await expect(restored).toContainText('备份补充：保留当时的判断和图片。');
    await expect(restored.locator('img')).toHaveCount(1);
    await expect(restored.locator('img')).toHaveJSProperty('naturalWidth', 192);
    await expect(restored.locator('.past-record__date')).toHaveAttribute('datetime', recordedAt!);
  } finally {
    await freshContext.close();
  }
});
