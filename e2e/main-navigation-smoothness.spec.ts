import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const loaderText = /正在恢复链路|Restoring your space/i;

test('主模块切换保留可用界面且不显示全屏恢复遮罩', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedOnboardedApp(page);

  // Allow the idle warm-up to complete. Subsequent navigations must not make
  // a user wait behind a module or vault loading mask.
  await page.waitForTimeout(800);
  const navigation = page.getByRole('navigation', { name: '主页面导航' });

  await navigation.getByRole('button', { name: '未来', exact: true }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.locator('.future-page')).toBeVisible();
  await expect(page.getByText(loaderText)).toHaveCount(0);

  await navigation.getByRole('button', { name: '现在', exact: true }).click();
  await expect(page).toHaveURL(/\/now$/);
  await expect(page.getByTestId('now-page')).toBeVisible();
  await expect(page.getByText(loaderText)).toHaveCount(0);

  await navigation.getByRole('button', { name: '分身', exact: true }).click();
  await expect(page).toHaveURL(/\/avatar$/);
  await expect(page.getByTestId('avatar-assist-page')).toBeVisible();
  await expect(page.getByText(loaderText)).toHaveCount(0);

  await navigation.getByRole('button', { name: '过去', exact: true }).click();
  await expect(page).toHaveURL(/\/past$/);
  await expect(page.getByTestId('past-page')).toBeVisible();
  await expect(page.getByText(loaderText)).toHaveCount(0);
});
