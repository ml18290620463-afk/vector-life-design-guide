import { expect, test, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

async function enterFuture(page: Page) {
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();
}
async function addAction(page: Page, title: string) {
  await page.getByRole('button', { name: '添加行动', exact: true }).click();
  await page.getByLabel('行动内容').fill(title);
  await page.getByRole('button', { name: '确定', exact: true }).click();
}
async function reloadAndUnlock(page: Page) {
  await page.reload();
  const password = page.locator('input[type="password"]:visible');
  await password.fill('VectorVisual123!');
  await password.press('Enter');
  await enterFuture(page);
}

for (const width of [390, 1440]) {
  test(`未来：反馈单条删除、行动批量删除在刷新后保持 ${width}px`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await enterFuture(page);
    const first = '核对旅行证件';
    const second = '整理出行装备';
    await addAction(page, first);
    await addAction(page, second);
    await page.getByRole('tab', { name: '反馈', exact: true }).click();
    const list = page.getByRole('list', { name: '行动列表' });
    await list.getByRole('button', { name: first }).click();
    const dialog = page.getByRole('dialog', { name: first });
    await dialog.getByRole('button', { name: '更新进展', exact: true }).click();
    await dialog.getByLabel('本次执行状态').selectOption('partial');
    await dialog.getByLabel('反馈内容（可选）').fill('证件核对完成，还需要准备签证材料');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await list.getByRole('button', { name: first }).click();
    await expect(
      dialog.getByText('证件核对完成，还需要准备签证材料', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: '删除此条', exact: true }).click();
    await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(dialog.getByText('证件核对完成，还需要准备签证材料', { exact: true })).toHaveCount(
      0,
    );
    await dialog.getByRole('button', { name: '返回', exact: true }).click();
    await reloadAndUnlock(page);
    await page.getByRole('tab', { name: '反馈', exact: true }).click();
    await list.getByRole('button', { name: first }).click();
    await expect(dialog.getByText('证件核对完成，还需要准备签证材料', { exact: true })).toHaveCount(
      0,
    );
    await dialog.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '选择', exact: true }).click();
    await page.getByRole('checkbox', { name: `选择行动：${first}` }).check();
    await page.getByRole('checkbox', { name: `选择行动：${second}` }).check();
    await page.getByRole('button', { name: '删除 2 项', exact: true }).click();
    await page
      .getByRole('dialog', { name: '确认删除行动' })
      .getByRole('button', { name: '确认删除', exact: true })
      .click();
    await expect(page.getByText('暂无行动。', { exact: true })).toBeVisible();
    await reloadAndUnlock(page);
    await page.getByRole('tab', { name: '反馈', exact: true }).click();
    await expect(page.getByText('暂无行动。', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('未来：删除目标会持久清理关联行动并保留愿景', async ({ page }) => {
  test.setTimeout(180000);
  await seedOnboardedApp(page);
  await enterFuture(page);
  const vision = '持续学习';
  const goal = '完成阅读计划';
  const action = '阅读第一章';
  await page.getByRole('button', { name: '添加愿景', exact: true }).click();
  await page.getByLabel('愿景内容').fill(vision);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: '添加目标', exact: true }).click();
  await page.getByLabel('目标内容').fill(goal);
  await page.getByLabel('所属愿景（可选）').selectOption({ label: vision });
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: '添加行动', exact: true }).click();
  await page.getByLabel('行动内容').fill(action);
  await page.getByText('可选设置', { exact: true }).click();
  await page.getByLabel('所属目标（可选）').selectOption({ label: goal });
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`查看目标：.*${goal}`) }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByRole('button', { name: '删除目标', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`查看目标：.*${goal}`) })).toHaveCount(
    0,
  );
  await reloadAndUnlock(page);
  await expect(
    page.getByRole('button', { name: new RegExp(`查看愿景：.*${vision}`) }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`查看目标：.*${goal}`) })).toHaveCount(
    0,
  );
  await page.getByRole('tab', { name: '反馈', exact: true }).click();
  await expect(page.getByText('暂无行动。', { exact: true })).toBeVisible();
});

test('完成行动：长期推进留在未来，存入过去成为普通经历', async ({ page }) => {
  test.setTimeout(180000);
  await seedOnboardedApp(page);
  await enterFuture(page);
  await addAction(page, '持续阅读');
  await addAction(page, '完成访谈');
  await page.getByRole('tab', { name: '反馈', exact: true }).click();
  const list = page.getByRole('list', { name: '行动列表' });
  for (const [title, destination] of [['持续阅读', 'long_term'], ['完成访谈', 'past']]) {
    await list.getByRole('button', { name: title }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await dialog.getByRole('button', { name: '更新进展', exact: true }).click();
    await dialog.getByLabel('本次执行状态').selectOption('completed');
    await dialog.getByRole('combobox', { name: '完成后', exact: true }).selectOption(destination);
    await dialog.getByLabel('反馈内容（可选）').fill('明确三个需求');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(list.getByRole('button', { name: '持续阅读' })).toBeVisible();
  await expect(list.getByRole('button', { name: '完成访谈' })).toHaveCount(0);
  await reloadAndUnlock(page);
  await page.getByRole('tab', { name: '反馈', exact: true }).click();
  await expect(list.getByRole('button', { name: '完成访谈' })).toHaveCount(0);
  await page.getByRole('navigation', { name: '主页面导航' }).getByRole('button', { name: /^过去/ }).click();
  await expect(page.getByText('完成访谈', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.mobile-past-goal-summary')).toHaveCount(0);
});
