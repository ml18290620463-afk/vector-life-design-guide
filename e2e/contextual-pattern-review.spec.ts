import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

async function record(page: Page, text: string) {
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^现在/ })
    .click();
  await page.getByLabel('此刻发生了什么？').fill(text);
  await page.getByLabel('保存到过去').click();
}

for (const width of [1440, 390]) {
  test(`模式在当下确认、暂缓后恢复、分身举证和纠正 ${width}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    await record(page, '我今天又拖延了任务，下午才动手。');
    await expect(page.getByTestId('past-page')).toBeVisible();
    await record(page, '我今天拖延了另一项任务，一直放着。');
    const dialog = page.getByRole('dialog', { name: '这像是你的一个模式吗？' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(Math.min(520, width - 32));
    expect(bounds!.height).toBeLessThan(650);
    expect(bounds!.y).toBeGreaterThan(24);
    await expect(dialog.getByText(/条依据|查看依据/)).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page })
      .include('.pattern-review-dialog')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      accessibility.violations.filter((issue) =>
        ['serious', 'critical'].includes(issue.impact ?? ''),
      ),
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('contextual-dialog.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('past-page')).toBeVisible();
    await page.getByRole('tab', { name: /^沉淀/ }).click();
    await page.getByRole('button', { name: '提炼模式', exact: true }).click();
    await expect(dialog).toBeVisible();
    await page
      .getByLabel('用你的话描述')
      .fill('任务不够明确时，我会延后开始；明确第一步后就能行动。');
    await dialog.getByRole('button', { name: '保存修正' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: '不认可', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '与分身聊聊', exact: true }).click();
    await page.getByRole('textbox', { name: '对话内容' }).fill('我的模式有哪些关联经历？');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    const messages = page.getByRole('region', { name: '对话记录' });
    await expect(messages).toContainText('任务不够明确时，我会延后开始');
    await expect(messages).toContainText('我今天又拖延了任务，下午才动手。');
    await expect(messages).toContainText('我今天拖延了另一项任务，一直放着。');
    await page.getByRole('textbox', { name: '对话内容' }).fill('修正我的模式');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '不认可', exact: true }).click();
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^过去/ })
      .click();
    await page.getByRole('button', { name: '提炼模式', exact: true }).click();
    await expect(page.getByText('暂时没有需要确认的新模式')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath('distillation.png'), fullPage: true });
  });
}
