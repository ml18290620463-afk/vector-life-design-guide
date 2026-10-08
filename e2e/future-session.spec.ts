import { expect, test } from '@playwright/test';

test('one login allows future editing and all module navigation without another password', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?preview=mobile');
  await page.getByTestId('cover-initialize').click();
  await page.getByTestId('onboarding-password').fill('Vector123!');
  await page.getByTestId('onboarding-password-confirm').fill('Vector123!');
  await page.getByTestId('onboarding-issue-key').click();
  await page.getByTestId('onboarding-backup-phase').waitFor();
  await page.getByTestId('onboarding-save-png').click();
  await page.getByTestId('onboarding-recovery-saved').click();
  const navigation = page.getByRole('navigation', { name: '主页面导航' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: /未来/ }).click();
  await page.getByRole('button', { name: '愿景', exact: true }).click();
  await page.getByRole('button', { name: '写愿景', exact: true }).click();
  await page.getByLabel('我想靠近的生活').fill('保持探索的生活');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('保持探索的生活', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑愿景', exact: true }).click();
  await page.getByLabel('我想靠近的生活').fill('保持探索、亲近自然的生活');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('保持探索、亲近自然的生活', { exact: true })).toBeVisible();
  // Existing encrypted vault: refresh must show unified login, not a fatal
  // action-read error that makes authentication impossible.
  await page.reload();
  const password = page.locator('input[type="password"]:visible');
  await expect(password).toHaveCount(1);
  await expect(page.getByText('暂时无法打开资料库', { exact: true })).toHaveCount(0);
  await password.fill('Vector123!');
  await password.press('Enter');
  await expect(navigation).toBeVisible();
  await page.getByRole('button', { name: '愿景', exact: true }).click();
  await expect(page.getByText('保持探索、亲近自然的生活', { exact: true })).toBeVisible();
  for (const module of ['现在', '过去', '分身', '未来']) {
    await navigation.getByRole('button', { name: new RegExp(module) }).click();
    await expect(navigation).toBeVisible();
    await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
    await expect(page.getByText('资料库已锁定', { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: '愿景', exact: true }).click();
  await expect(page.getByText('保持探索、亲近自然的生活', { exact: true })).toBeVisible();
});
