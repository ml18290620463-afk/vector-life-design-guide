import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

for (const width of [1440, 390]) {
  test(`未来：独立行动可完成践行闭环 ${width}`, async ({ page }, info) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    // A full navigation intentionally locks the encrypted vault again. Use
    // the product navigation here to exercise the active-user journey.
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^未来/ })
      .click();
    await expect(page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ })).toBeVisible();

    await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
    await page.getByRole('button', { name: '行动规划', exact: true }).click();
    const action = `未来测试${width}：整理旅行证件`;
    await page.getByLabel('行动内容').fill(action);
    await page.getByLabel('计划日期（可选）').fill(new Date().toISOString().slice(0, 10));
    // Keep the default “不关联”: this is a valid preparation action.
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByText(action, { exact: false }).first()).toBeVisible();

    await page.getByRole('tab', { name: '践行', exact: true }).click();
    await expect(page.getByRole('button', { name: /待检视 1/ })).toBeVisible();
    await page.getByRole('button', { name: /待检视 1/ }).click();
    await expect(page.getByRole('dialog', { name: '待检视' })).toBeVisible();
    await page.getByRole('button', { name: action, exact: false }).click();
    await expect(page.getByRole('heading', { name: '行动记录' })).toBeVisible();
    await page.getByRole('button', { name: '‹ 返回待检视' }).click();
    await expect(page.getByRole('heading', { name: '待检视' })).toBeVisible();
    await page.getByRole('button', { name: action, exact: false }).click();
    await page.getByLabel('状态').selectOption('partial');
    await page.getByLabel('实际情况').fill('证件已核对，签证材料明天补齐。');
    await page.getByLabel('下一步').selectOption('continue');
    await page.getByRole('button', { name: '保存记录' }).click();
    await expect(page.getByRole('dialog', { name: '本次践行已记录' })).toBeVisible();
    await page.getByRole('button', { name: '返回践行' }).click();
    await expect(page.getByText('证件已核对，签证材料明天补齐。')).toBeVisible();
    await expect(page.getByRole('button', { name: /待检视/ })).toHaveCount(0);

    // A reload intentionally locks the encrypted vault. Re-entering the
    // master password must restore the saved plan and its practice record.
    await page.reload();
    const password = page.locator('input[type="password"]:visible');
    await expect(password).toHaveCount(1);
    await password.fill('VectorVisual123!');
    await password.press('Enter');
    const navigation = page.getByRole('navigation', { name: '主页面导航' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('button', { name: /^未来/ }).click();
    await page.getByRole('tab', { name: '践行', exact: true }).click();
    await expect(page.getByText('证件已核对，签证材料明天补齐。')).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: info.outputPath(`future-practice-${width}.png`),
      fullPage: true,
    });
    const accessibility = await new AxeBuilder({ page })
      .include('.future-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  });
}

test('未来：相似愿景先确认，并可回到原有愿景编辑', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  const openEditor = page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ });
  const original = '在自然中保持长期探索的生活';
  await openEditor.click();
  await page.getByLabel('愿景内容').fill(original);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText(original, { exact: true })).toBeVisible();

  await openEditor.click();
  await page.getByLabel('愿景内容').fill('在自然中保持长期探索的生活！');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText('发现相似愿景', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续已有愿景', exact: true }).click();
  await expect(page.getByLabel('愿景内容')).toHaveValue(original);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(openEditor).toBeFocused();
  await expect(page.getByText('1 条记录', { exact: true }).first()).toBeVisible();
});

test('未来：待检视支持明确的键盘返回与关闭', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  const action = '未来键盘测试：整理下周会议资料';
  await page.getByLabel('行动内容').fill(action);
  await page.getByLabel('计划日期（可选）').fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('tab', { name: '践行', exact: true }).click();
  const pending = page.getByRole('button', { name: /待检视 1/ });
  await pending.click();
  const dialog = page.getByRole('dialog', { name: '待检视' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeFocused();

  await page.getByRole('button', { name: action, exact: false }).click();
  await expect(page.getByRole('heading', { name: '行动记录' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '待检视' })).toBeVisible();
  await expect(page.getByRole('button', { name: action, exact: false })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '待检视' })).toHaveCount(0);
  await expect(pending).toBeFocused();
});

test('未来：继续完成的行动可追加践行，且刷新后保留完整记录', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  const action = '未来续记测试：完成三次西语练习';
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  await page.getByLabel('行动内容').fill(action);
  await page.getByLabel('计划日期（可选）').fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('tab', { name: '践行', exact: true }).click();
  await page.getByRole('button', { name: /待检视 1/ }).click();
  await page.getByRole('button', { name: action, exact: false }).click();
  await page.getByLabel('状态').selectOption('partial');
  await page.getByLabel('实际情况').fill('完成两次练习。');
  await page.getByLabel('下一步').selectOption('continue');
  await page.getByRole('button', { name: '保存记录' }).click();
  await page.getByRole('button', { name: '返回践行' }).click();

  await expect(page.getByRole('button', { name: '继续记录' })).toBeVisible();
  await expect(page.getByRole('button', { name: /待检视/ })).toHaveCount(0);
  await page.getByRole('button', { name: '继续记录' }).click();
  await expect(page.getByRole('button', { name: '‹ 返回践行' })).toBeVisible();
  await page.getByLabel('实际情况').fill('完成第三次练习。');
  await page.getByRole('button', { name: '保存记录' }).click();
  await page.getByRole('button', { name: '关闭完成结果' }).click();

  await expect(page.getByText('完成两次练习。')).toBeVisible();
  await expect(page.getByText('完成第三次练习。')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续记录' })).toHaveCount(0);
  await page.reload();
  const password = page.locator('input[type="password"]:visible');
  await password.fill('VectorVisual123!');
  await password.press('Enter');
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();
  await page.getByRole('tab', { name: '践行', exact: true }).click();
  await expect(page.getByText('完成两次练习。')).toBeVisible();
  await expect(page.getByText('完成第三次练习。')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('未来：草稿行动可在确认后删除，已有下级记录的目标受到保护', async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  const draft = '未来删除测试：清理临时草稿';
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  await page.getByLabel('行动内容').fill(draft);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  const draftEditor = page.getByRole('button', { name: `编辑行动规划：计划「${draft}」` });
  await draftEditor.click();
  await page.getByRole('button', { name: '删除行动规划', exact: true }).click();
  await expect(page.getByText('删除后无法恢复，确定删除吗？')).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByLabel('行动内容')).toHaveValue(draft);
  await page.getByRole('button', { name: '删除行动规划', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: `编辑行动规划：计划「${draft}」` })).toHaveCount(0);

  const vision = '未来关联删除测试：持续学习';
  const goal = '未来关联删除测试：完成阅读计划';
  const action = '未来关联删除测试：阅读第一章';
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByLabel('愿景内容').fill(vision);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '目标', exact: true }).click();
  await page.getByLabel('目标内容').fill(goal);
  await page.getByLabel('所属愿景（可选）').selectOption({ label: vision });
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  await page.getByLabel('行动内容').fill(action);
  await page.getByLabel('所属目标（可选）').selectOption({ label: goal });
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('button', { name: new RegExp(`编辑目标：.*${goal}`) }).click();
  await page.getByRole('button', { name: '删除目标', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('目标已有关联行动，不能删除', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回', exact: true }).click();
});

test('未来：愿景、目标、行动规划与践行记录保持关联且互不改写', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  const vision = '未来全链路：成为稳定的创作者';
  const goal = '未来全链路：十月完成作品集';
  const action = '未来全链路：今天整理三个案例';
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByLabel('愿景内容').fill(vision);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '目标', exact: true }).click();
  await page.getByLabel('目标内容').fill(goal);
  await page.getByLabel('完成时间（可选）').fill('2026-10-31');
  await page.getByLabel('所属愿景（可选）').selectOption({ label: vision });
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  await page.getByLabel('行动内容').fill(action);
  await page.getByLabel('计划日期（可选）').fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('所属目标（可选）').selectOption({ label: goal });
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await expect(page.getByText(vision, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(goal, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(action, { exact: false }).first()).toBeVisible();
  await page.getByRole('tab', { name: '践行', exact: true }).click();
  await page.getByRole('button', { name: /待检视 1/ }).click();
  await page.getByRole('button', { name: action, exact: false }).click();
  await expect(page.getByText(`所属目标 · ${goal}`)).toBeVisible();
  await page.getByLabel('状态').selectOption('completed');
  await page.getByLabel('实际情况').fill('三个案例已整理完成，准备开始写说明。');
  await page.getByRole('button', { name: '保存记录' }).click();
  await page.getByRole('button', { name: '关闭完成结果' }).click();
  await expect(page.getByText('三个案例已整理完成，准备开始写说明。')).toBeVisible();

  await page.getByRole('tab', { name: '设计', exact: true }).click();
  await expect(page.getByText(vision, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(goal, { exact: false }).first()).toBeVisible();
  await page.reload();
  await page.locator('input[type="password"]:visible').fill('VectorVisual123!');
  await page.locator('input[type="password"]:visible').press('Enter');
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();
  await page.getByRole('tab', { name: '践行', exact: true }).click();
  await expect(page.getByText('三个案例已整理完成，准备开始写说明。')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('未来：320px 小屏幕的长规划可保存，编辑器不横向溢出且关闭可返回入口', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 568 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();
  const entry = page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ });
  await entry.click();
  const longVision =
    '未来小屏测试：在有限时间里持续积累可复用的创作能力，并把每次选择沉淀为下一次行动的清晰依据';
  await page.getByLabel('愿景内容').fill(longVision);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(entry).toBeFocused();

  await entry.click();
  await page.getByLabel('愿景内容').fill(longVision);
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText(longVision, { exact: false }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('未来：完成行动可带着上下文主动进入过去沉淀，但不会自动生成原则', async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  const action = '未来沉淀测试：整理本周创作素材';
  const result = '已完成素材归档，也发现了命名规则需要统一。';
  await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  await page.getByLabel('行动内容').fill(action);
  await page.getByLabel('计划日期（可选）').fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await page.getByRole('tab', { name: '践行', exact: true }).click();
  await page.getByRole('button', { name: /待检视 1/ }).click();
  await page.getByRole('button', { name: action, exact: false }).click();
  await page.getByLabel('状态').selectOption('completed');
  await page.getByLabel('实际情况').fill(result);
  await expect(page.getByLabel('下一步')).toHaveValue('end');
  await expect(page.getByLabel('下一步')).toBeDisabled();
  await page.getByRole('button', { name: '保存记录' }).click();

  await expect(page.getByRole('dialog', { name: '行动已完成' })).toBeVisible();
  await page.getByRole('button', { name: '去沉淀这次行动' }).click();
  await expect(page.getByText('我的原则', { exact: true })).toBeVisible();
  const context = page.getByLabel('行动沉淀提示');
  await expect(context).toContainText(action);
  await expect(context).toContainText(result);

  await page.getByRole('button', { name: '写原则', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '书写原则' });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('textbox')).toHaveValue('');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(context).toBeVisible();
  await page.getByRole('button', { name: '关闭行动提示' }).click();
  await expect(context).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});
