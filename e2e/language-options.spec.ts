import { test, expect } from '@playwright/test';

test('first-run language picker offers complete English and Chinese introductions', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cover-initialize').click();
  const picker = page.getByRole('combobox');
  await expect(picker.locator('option')).toHaveCount(2);
  await picker.selectOption('en');
  await expect(page.getByRole('heading', { name: 'Start with a moment' })).toBeVisible();
  await expect(page.getByTestId('onboarding-skip')).toHaveText('Skip introduction');
  await picker.selectOption('zh');
  await expect(page.getByRole('heading', { name: '从此刻的一条记录开始' })).toBeVisible();
  await expect(page.getByTestId('onboarding-skip')).toHaveText('跳过介绍');
});
