import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const password = 'VectorVisual123!';

async function openAvatar(page: import('@playwright/test').Page) {
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^分身/ })
    .click();
  await expect(page.getByTestId('avatar-assist-page')).toBeVisible();
}

async function unlockAfterRefresh(page: import('@playwright/test').Page) {
  const passwordInput = page.locator('input[type="password"]:visible');
  await expect(passwordInput).toHaveCount(1);
  await passwordInput.fill(password);
  await passwordInput.press('Enter');
  await expect(page.getByRole('navigation', { name: '主页面导航' })).toBeVisible();
}

test('分身模型设置会校验、保留服务商草稿并在解锁后恢复已记住配置', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/avatar/model/list', (route) =>
    route.fulfill({ json: { models: ['gpt-4.1', 'deepseek-chat'] } }),
  );
  await page.route('**/api/v1/avatar/model/test', async (route) => {
    const body = route.request().postDataJSON() as { modelConfig?: { apiKey?: string } };
    if (body.modelConfig?.apiKey === 'invalid-replacement-key') {
      await route.fulfill({ status: 401, json: { error: 'model_auth_failed' } });
      return;
    }
    await route.fulfill({ json: { ok: true } });
  });
  await seedOnboardedApp(page);
  await openAvatar(page);

  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await page.getByRole('button', { name: '验证并保存', exact: true }).click();
  await expect(page.getByText('请填写 API Key。', { exact: true })).toBeVisible();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('API Key', { exact: true }).fill('test-openai-key');
  await page.getByLabel('记住 API Key，下次自动使用').check();
  await page.getByLabel('服务商', { exact: true }).selectOption('1');
  await page.getByLabel('API Key', { exact: true }).fill('test-deepseek-key');
  await page.getByRole('button', { name: '手动输入', exact: true }).click();
  await page.getByLabel('模型名称', { exact: true }).fill('my-account-model');
  await page.getByLabel('服务商', { exact: true }).selectOption('0');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('test-openai-key');
  await page.getByLabel('服务商', { exact: true }).selectOption('1');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('test-deepseek-key');
  await expect(page.getByLabel('模型名称', { exact: true })).toHaveValue('my-account-model');
  await page.screenshot({ path: testInfo.outputPath('model-settings-mobile.png'), fullPage: true });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);

  await page.getByRole('button', { name: '验证并保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A failed replacement must remain only a form draft: it must never overwrite
  // the previously verified, remembered configuration.
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).fill('invalid-replacement-key');
  await page.getByRole('button', { name: '验证并保存', exact: true }).click();
  await expect(page.locator('.avatar-model-alert')).toHaveText(
    'API Key 无效、已过期，或没有调用这个模型的权限。',
  );
  await expect(page.getByRole('dialog', { name: '分身设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回分身', exact: true }).click();
  await page.reload();
  await unlockAfterRefresh(page);
  await openAvatar(page);
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await expect(page.getByLabel('服务商', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('test-deepseek-key');
  await expect(page.getByLabel('模型名称', { exact: true })).toHaveValue('my-account-model');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('分身只在确认后保存提炼信息，档案支持修改、撤销删除、删除与刷新恢复', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/avatar/chat', (route) =>
    route.fulfill({ json: { reply: '安静的环境似乎能帮助你进入更专注的思考状态。' } }),
  );
  await page.route('**/api/v1/avatar/memory/extract', (route) =>
    route.fulfill({
      json: {
        candidate: {
          statement: '我更喜欢在安静的环境中思考。',
          kind: 'preference',
          sourceIndex: 0,
        },
      },
    }),
  );
  await seedOnboardedApp(page);
  await openAvatar(page);
  const chat = '我更喜欢在安静的地方思考，嘈杂环境会让我很难集中。';
  await page.getByLabel('对话内容', { exact: true }).fill(chat);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('安静的环境似乎能帮助你进入更专注的思考状态。')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '记住这条关于你的信息？' })).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('提炼的信息', { exact: true })).toHaveValue(
    '我更喜欢在安静的环境中思考。',
  );
  await page
    .getByRole('dialog')
    .getByLabel('提炼的信息', { exact: true })
    .fill('我在安静环境中更容易专注思考。');
  await page.getByRole('button', { name: '确认记住', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '记忆档案', exact: true }).click();
  await page.getByRole('button', { name: /^偏好与边界/ }).click();
  const saved = page.getByRole('button', { name: /我在安静环境中更容易专注思考/ });
  await expect(saved).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('archive-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: /我在安静环境中更容易专注思考/ }).click();
  await page.getByRole('button', { name: '需要调整', exact: true }).click();
  await page.getByLabel('记忆内容', { exact: true }).fill('我在安静环境中更容易进入深度思考。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /我在安静环境中更容易进入深度思考/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: /我在安静环境中更容易进入深度思考/ }).click();
  await page.getByRole('button', { name: '暂不采用', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂不采用这条理解？' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('heading', { name: '记忆详情' })).toBeVisible();
  await page.getByRole('button', { name: '暂不采用', exact: true }).click();
  await page.getByRole('button', { name: '暂不采用', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /我在安静环境中更容易进入深度思考/ })).toHaveCount(
    0,
  );

  await page.reload();
  await unlockAfterRefresh(page);
  await openAvatar(page);
  await page.getByRole('button', { name: '记忆档案', exact: true }).click();
  await page.getByRole('button', { name: /^偏好与边界/ }).click();
  await expect(page.getByRole('button', { name: /我在安静环境中更容易进入深度思考/ })).toHaveCount(
    0,
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('分身取消提炼和各层返回不会写入记忆，窄屏仍可继续对话', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/avatar/chat', (route) =>
    route.fulfill({ json: { reply: '我记住了这段交流。' } }),
  );
  await page.route('**/api/v1/avatar/memory/extract', (route) =>
    route.fulfill({
      json: {
        candidate: {
          statement: '我偏好在清晨处理需要专注的工作。',
          kind: 'preference',
          sourceIndex: 0,
        },
      },
    }),
  );
  await seedOnboardedApp(page);
  await openAvatar(page);

  await page.getByLabel('对话内容', { exact: true }).fill('我喜欢清晨安静地完成重要工作。');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '记住这条关于你的信息？' })).toBeVisible();
  await page.getByRole('button', { name: '暂不记住', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '提炼记忆', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '记住这条关于你的信息？' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('对话内容', { exact: true }).fill('取消后我仍然可以继续聊天。');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: '记忆档案', exact: true }).click();
  await page.getByRole('button', { name: /^偏好与边界/ }).click();
  await expect(page.getByText('暂无已确认记忆', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.getByRole('button', { name: /^偏好与边界/ })).toBeVisible();
  await page.getByLabel('返回对话', { exact: true }).click();
  await expect(page.getByLabel('对话内容', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('avatar-cancel-mobile.png'), fullPage: true });
});

test('记忆删除确认按 Escape 会返回详情而非关闭整个窗口', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/api/v1/avatar/chat', (route) =>
    route.fulfill({ json: { reply: '好的。' } }),
  );
  await page.route('**/api/v1/avatar/memory/extract', (route) =>
    route.fulfill({
      json: {
        candidate: { statement: '我喜欢先写下想法再讨论。', kind: 'habit', sourceIndex: 0 },
      },
    }),
  );
  await seedOnboardedApp(page);
  await openAvatar(page);
  await page.getByLabel('对话内容', { exact: true }).fill('我习惯先写下想法再讨论。');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('button', { name: '确认记住', exact: true }).click();
  await page.getByRole('button', { name: '记忆档案', exact: true }).click();
  await page.getByRole('button', { name: '我的模式', exact: true }).click();
  await page.getByRole('button', { name: /^选择与取舍/ }).click();
  await page.getByRole('button', { name: /我喜欢先写下想法再讨论/ }).click();
  await page.getByRole('button', { name: '暂不采用', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂不采用这条理解？' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '记忆详情' })).toBeVisible();
  await expect(
    page.getByLabel('记忆详情').getByText('我喜欢先写下想法再讨论。', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
});

test('分身对话失败后重试只补充回复，不重复写入用户消息', async ({ page }) => {
  test.setTimeout(120_000);
  let attempts = 0;
  await page.route('**/api/v1/avatar/chat', (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 429, json: { error: 'model_rate_limited' } })
      : route.fulfill({ json: { reply: '这次回复已经顺利抵达。' } });
  });
  await page.route('**/api/v1/avatar/memory/extract', (route) =>
    route.fulfill({ json: { candidate: null } }),
  );
  await seedOnboardedApp(page);
  await openAvatar(page);
  const message = '请帮我看看这一步该怎么安排。';
  await page.getByLabel('对话内容', { exact: true }).fill(message);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('模型服务额度不足或请求过于频繁');
  await expect(page.getByText(message, { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '重试回复', exact: true }).click();
  await expect(page.getByText('这次回复已经顺利抵达。', { exact: true })).toBeVisible();
  await expect(page.getByText(message, { exact: true })).toHaveCount(1);
  expect(attempts).toBe(2);
});
