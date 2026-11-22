import { expect, test } from '@playwright/test';

test('serves the app shell and health endpoint', async ({ page, request }) => {
  const health = await request.get('/api/health');
  await expect(health).toBeOK();
  expect(health.headers()['x-content-type-options']).toBe('nosniff');

  await page.goto('/');
  await expect(page).toHaveTitle(/VECTOR/);
});

test('renders the cover experience', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'VECTOR' })).toBeVisible();
  await expect(
    page.getByText(/让经历创造方向|Let experience shape direction/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/记录 ‖ 过去·此刻 ⇌ 未来|Record ‖ Past · Now ⇌ Future/i).first(),
  ).toBeVisible();
  await expect(page.getByTestId('cover-initialize')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(进入|Enter)$/i })).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`first entry is available before password setup (${width})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByTestId('cover-initialize').click();
    const start = Date.now();
    await page.getByTestId('onboarding-skip').click();
    await page.getByLabel('此刻发生了什么？').fill('首次私密草稿');
    expect(Date.now() - start).toBeLessThan(10_000);
    await expect(page.getByTestId('onboarding-password')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('首次私密草稿');
    await page.screenshot({ path: testInfo.outputPath('onboarding-editor.png') });
    await page.getByLabel('保存到过去').click();
    await page.getByTestId('onboarding-password').fill('Vector123!');
    await page.getByTestId('onboarding-password-confirm').fill('Vector123!');
    await page.getByTestId('onboarding-protect').click();
    await expect(page.getByRole('navigation', { name: '主页面导航' })).toBeVisible();
    await expect(page.getByLabel('此刻发生了什么？')).toHaveValue('首次私密草稿');
    await page.getByLabel('保存到过去').click();
    await expect(page.getByRole('dialog', { name: '是否允许 AI 可见？' })).toBeVisible();
    await page.getByRole('button', { name: /仅自己可见/ }).click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect(page.getByText('首次私密草稿', { exact: false }).first()).toBeVisible();
  });
}
