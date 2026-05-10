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
  await expect(page.getByText(/矢量人生|VECTOR LIFE/i).first()).toBeVisible();
  await expect(page.getByText(/记录 \|\| 此刻|Record \|\| Now/i).first()).toBeVisible();
  await expect(page.getByText(/抵达未来|Reach the future/i).first()).toBeVisible();
  await expect(page.getByTestId('cover-initialize')).toBeVisible();
  await expect(page.getByText(/起航|Launch/i).first()).toBeVisible();
});

test('completes onboarding and creates a journal entry', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // W4.1 — every selector below is testid-anchored. Visible labels
  // can change (i18n / copy edits) without breaking the spec; only
  // an intentional change to a data-testid does.
  await page.getByTestId('cover-initialize').click();
  await expect(page.getByTestId('onboarding-next')).toBeVisible();

  await page.getByTestId('onboarding-next').click();

  await page.getByTestId('onboarding-password').fill('Vector123!');
  await page.getByTestId('onboarding-password-confirm').fill('Vector123!');
  await page.getByTestId('onboarding-next').click();

  await page.getByTestId('onboarding-recovery-saved').click();
  await page.getByTestId('onboarding-next').click();

  await page.getByTestId('onboarding-star-musk').first().click();
  await page.getByTestId('onboarding-star-laozi').first().click();
  await page.getByTestId('onboarding-star-camus').first().click();
  await page.getByTestId('onboarding-finish').click();

  // The "default first entry" still uses an i18n locator because it's
  // a localised piece of copy injected by `useDiaryData.seedDefaults`,
  // not a button — adding a testid would require threading it through
  // multiple components for one assertion.
  await expect(page.getByText('矢量人生启航日志').first()).toBeVisible();

  await page.getByTestId('dashboard-new-entry').click();
  await page.getByTestId('editor-title').fill('E2E 自动化航迹');
  await page.getByTestId('editor-content').fill('这是一条由 Playwright 创建的端到端验证记录。');
  await page.getByTestId('editor-save').click();

  await expect(page.getByText('E2E 自动化航迹').first()).toBeVisible();
});
