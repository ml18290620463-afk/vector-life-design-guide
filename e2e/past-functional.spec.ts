import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

for (const width of [1440, 390]) {
  test(`过去回看可搜索并安全进入批量删除 ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    const content = `过去测试${width}：主动澄清会议目标，讨论更加聚焦。`;
    await page.getByLabel('此刻发生了什么？').fill(content);
    await page.getByLabel('心情与事件').click();
    await page.getByRole('button', { name: '职业发展', exact: true }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await page.getByLabel('保存到过去').click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect(page.getByText(content, { exact: false }).first()).toBeVisible();

    const search = page.getByRole('searchbox', { name: '搜索记录' });
    await search.fill('不存在的测试');
    await expect(page.getByText('没有找到相关记录。', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '清除搜索' }).click();
    await search.fill('职业发展');
    await expect(page.getByText(content, { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: '清除搜索' }).click();

    await page.getByRole('button', { name: '选择', exact: true }).click();
    await page.getByRole('button', { name: '全选', exact: true }).click();
    await page.getByRole('button', { name: /删除 \d+ 条/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '管理记录', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '返回回看', exact: true }).click();
    await expect(search).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });

  test(`过去沉淀可书写、放弃、编辑与删除原则 ${width}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^过去/ })
      .click();
    await page.getByRole('tab', { name: /沉淀/ }).click();
    await page.getByRole('button', { name: '写原则', exact: true }).click();
    const input = page.getByRole('textbox', { name: '刻录新原则' });
    await expect(input).toBeFocused();
    await input.fill('先澄清目标再行动');
    const principleDialog = page.getByRole('dialog', { name: '书写原则', exact: true });
    const bounds = await principleDialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(width - 2);
    if (width >= 1000) expect(bounds!.height).toBeGreaterThanOrEqual(898);
    await page.screenshot({ path: info.outputPath('principle-editor.png'), fullPage: true });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '放弃未保存的修改？' })).toBeVisible();
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await expect(input).toHaveValue('先澄清目标再行动');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByText('先澄清目标再行动', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '写原则', exact: true })).toBeFocused();

    await page.getByRole('button', { name: '编辑原则：先澄清目标再行动', exact: true }).click();
    const editor = page.getByRole('textbox', { name: '编辑原则：先澄清目标再行动' });
    await editor.fill('取消的修改');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    await expect(page.getByText('先澄清目标再行动', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '编辑原则：先澄清目标再行动', exact: true }).click();
    await editor.fill('先明确目标，再选择行动');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByText('先明确目标，再选择行动', { exact: true })).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .include('[data-testid="past-page"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);

    await page.getByRole('button', { name: '编辑原则：先明确目标，再选择行动', exact: true }).click();
    await page.getByRole('button', { name: /抹除原则/ }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.getByText('先明确目标，再选择行动', { exact: true })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

for (const width of [1440, 390]) {
  test(`逐条删除可见选框与保留未选记录 ${width}`, async ({ page }, info) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(10000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    const contents = ['删除测试：这一条应删除', '删除测试：这一条必须保留'];
    for (const content of contents) {
      await page
        .getByRole('navigation', { name: '主页面导航' })
        .getByRole('button', { name: /^现在/ })
        .click();
      await page.getByLabel('此刻发生了什么？').fill(content);
      await page.getByLabel('心情与事件').click();
      await page.getByRole('button', { name: '职业发展', exact: true }).click();
      await page.getByRole('button', { name: '确定', exact: true }).click();
      await page.getByLabel('保存到过去').click();
      await expect(page.getByTestId('past-page')).toBeVisible();
    }
    await page.getByRole('button', { name: '选择', exact: true }).click();
    const checks = page.getByRole('checkbox');
    await expect(checks).toHaveCount(2);
    const remove = page.getByRole('button', { name: /删除 \d+ 条/ });
    await expect(remove).toBeDisabled();
    // An empty 44px button is technically visible but not a visible checkbox.
    for (const check of await checks.all()) {
      await expect(check).toBeVisible();
      const shape = await check.evaluate((el) => {
        const css = getComputedStyle(el, '::before');
        return {
          content: css.content,
          border: parseFloat(css.borderTopWidth),
          width: parseFloat(css.width),
        };
      });
      expect(shape.content).not.toBe('none');
      expect(shape.border).toBeGreaterThanOrEqual(2);
      expect(shape.width).toBeGreaterThanOrEqual(24);
    }
    await page.screenshot({ path: info.outputPath('selection-none.png'), fullPage: true });
    const first = page
      .locator('.past-record')
      .filter({ hasText: contents[0] })
      .getByRole('checkbox');
    const other = page
      .locator('.past-record')
      .filter({ hasText: contents[1] })
      .getByRole('checkbox');
    await first.click();
    await expect(first).toBeChecked();
    await expect(other).not.toBeChecked();
    await expect(page.getByText('已选 1 条', { exact: true })).toBeVisible();
    await first.focus();
    await page.keyboard.press('Space');
    await expect(first).not.toBeChecked();
    await expect(remove).toBeDisabled();
    await page.getByRole('button', { name: '全选', exact: true }).click();
    await expect(page.getByText('已选 2 条', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '取消全选', exact: true }).click();
    await expect(remove).toBeDisabled();
    await first.click();
    await page.getByRole('button', { name: '返回回看', exact: true }).click();
    await expect(checks).toHaveCount(0);
    await page.getByRole('button', { name: '选择', exact: true }).click();
    await expect(remove).toBeDisabled();
    await first.click();
    const lastRecord = await page.locator('.past-record').last().boundingBox();
    const actionBar = await page.locator('.past-bulk-editor-screen__footer').boundingBox();
    expect(lastRecord).not.toBeNull();
    expect(actionBar).not.toBeNull();
    expect(actionBar!.y).toBeGreaterThanOrEqual(lastRecord!.y + lastRecord!.height);
    await page.screenshot({ path: info.outputPath('selection-one.png'), fullPage: true });
    await remove.click();
    await page.screenshot({ path: info.outputPath('selection-confirm.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(first).toBeChecked();
    await remove.click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator('.past-record').filter({ hasText: contents[0] })).toHaveCount(0);
    await expect(page.locator('.past-record').filter({ hasText: contents[1] })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}
