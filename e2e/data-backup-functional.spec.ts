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
  await page.getByLabel('保存到过去').click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await navigate(page, /^分身/);
  const panel = page.locator('.avatar-data-tools');
  await panel.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByText('恢复凭证用于找回访问权限', { exact: false })).toBeVisible();
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
    const restore = fresh.locator('.avatar-data-tools');
    await restore.locator('summary').click();
    await restore.locator('input[type=file]').setInputFiles(backupPath);
    await restore.getByLabel('备份密令', { exact: true }).fill('VectorVisual123!');
    await restore.getByRole('button', { name: '合并恢复', exact: true }).click();
    await expect(restore.getByText('已选择：', { exact: false })).toHaveCount(0);
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
    await expect(fresh.getByText(content, { exact: false }).first()).toBeVisible();
  } finally {
    await freshContext.close();
  }
});
