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
  await expect(page.getByText(/矢量空间|VECTOR LIFE/i).first()).toBeVisible();
  await expect(
    page.getByText(/记录 \|\| 过去·此刻 ⇌ 未来|Record \|\| Past · Now ⇌ Future/i).first(),
  ).toBeVisible();
  await expect(page.getByTestId('cover-initialize')).toBeVisible();
  await expect(page.getByLabel(/点击进入下一个界面|Click to enter the next screen/i)).toBeVisible();
});

test('completes mobile onboarding and reaches the main shell', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?preview=mobile', { waitUntil: 'domcontentloaded' });

  // W4.1 — every selector below is testid-anchored. Visible labels
  // can change (i18n / copy edits) without breaking the spec; only
  // an intentional change to a data-testid does.
  await page.getByTestId('cover-initialize').click();
  await expect(page.getByTestId('onboarding-password')).toBeVisible();

  await page.getByTestId('onboarding-password').fill('Vector123!');
  await page.getByTestId('onboarding-password-confirm').fill('Vector123!');
  await page.getByTestId('onboarding-issue-key').click();
  await page.getByTestId('onboarding-backup-phase').waitFor({ state: 'visible' });

  await page.getByTestId('onboarding-save-png').click();
  await page.getByTestId('onboarding-recovery-saved').waitFor({ state: 'visible' });
  await expect(page.getByTestId('onboarding-recovery-saved')).toContainText('进入主界面');
  await page.getByTestId('onboarding-recovery-saved').click();

  await expect(page.getByRole('navigation', { name: '主框架导航' })).toBeVisible();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: '过去' })).toBeVisible();
  await expect(page.getByRole('button', { name: /过去 素材、复盘、原则/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /现在 记录此刻与行动/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /未来 目标、推演、转化/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /分身 记忆协助与对话/ })).toBeVisible();
});
