import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('行动详情显示目标关系并同步目标完成情况', async ({ page }, info) => {
      test.setTimeout(180000);
      await seedOnboardedApp(page);
      await page
        .getByRole('navigation', { name: '主页面导航' })
        .getByRole('button', { name: /^未来/ })
        .click();
      await page.getByRole('button', { name: '添加愿景', exact: true }).click();
      await page.getByLabel('愿景内容').fill('保持健康');
      await page.getByRole('button', { name: '确定', exact: true }).click();
      await page.getByRole('button', { name: '添加目标', exact: true }).click();
      await page.getByLabel('目标内容').fill('完成年度登山');
      await page.getByLabel('所属愿景（可选）').selectOption({ label: '保持健康' });
      await page.getByRole('button', { name: '确定', exact: true }).click();
      await page.getByRole('button', { name: '添加行动', exact: true }).click();
      await page.getByLabel('行动内容').fill('登顶黄山');
      await page.getByText('可选设置', { exact: true }).click();
      await page.getByLabel('所属目标（可选）').selectOption({ label: '完成年度登山' });
      await page.getByRole('button', { name: '确定', exact: true }).click();
      await page.getByRole('tab', { name: '反馈', exact: true }).click();
      await page
        .getByRole('list', { name: '行动列表' })
        .getByRole('button', { name: '登顶黄山' })
        .click();
      const dialog = page.getByRole('dialog', { name: '登顶黄山' });
      await expect(dialog.getByText('愿景 · 保持健康')).toBeVisible();
      await expect(dialog.getByRole('heading', { name: '目标 · 完成年度登山' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath(`action-overview-${width}.png`),
        fullPage: true,
      });
      await dialog.getByRole('button', { name: '更新进展', exact: true }).click();
      await expect(dialog.getByLabel('同步目标完成情况')).toHaveValue('');
      await dialog.getByLabel('同步目标完成情况').selectOption('complete');
      await dialog.getByLabel('目标进展（可选）').fill('完成年度登山目标');
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await dialog.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: info.outputPath(`linked-goal-${width}.png`), fullPage: true });
      await dialog.getByRole('button', { name: '保存', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page
        .getByRole('list', { name: '行动列表' })
        .getByRole('button', { name: '登顶黄山' })
        .click();
      await dialog.getByText('方向', { exact: true }).click();
      await expect(
        dialog.getByRole('region', { name: '关联目标' }).getByText('目标状态 · 已完成'),
      ).toBeVisible();
      await dialog.getByText('目标阶段记录（1）', { exact: true }).click();
      await expect(dialog.getByText('完成年度登山目标', { exact: true })).toBeVisible();
      await expect(dialog.getByLabel('同步目标完成情况')).toHaveCount(0);
    });
    test('行动搜索、状态分类、直接填写与历史回看', async ({ page }, info) => {
      test.setTimeout(180000);
      await seedOnboardedApp(page);
      await page
        .getByRole('navigation', { name: '主页面导航' })
        .getByRole('button', { name: /^未来/ })
        .click();
      await page.getByRole('button', { name: '添加行动', exact: true }).click();
      await page.getByLabel('行动内容').fill('核对路线与装备');
      await page.getByRole('button', { name: '确定', exact: true }).click();
      await page.getByRole('tab', { name: '反馈', exact: true }).click();
      const filters = page.getByRole('group', { name: '行动状态' });
      const list = page.getByRole('list', { name: '行动列表' });
      await page.getByRole('searchbox', { name: '搜索行动' }).fill('路线');
      await filters.getByRole('button', { name: '未开始', exact: true }).click();
      await expect(list.getByRole('button', { name: '核对路线与装备' })).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`feedback-list-${width}.png`),
        fullPage: true,
      });
      for (let index = 1; index <= 5; index++) {
        await list.getByRole('button', { name: '核对路线与装备' }).click();
        const dialog = page.getByRole('dialog', { name: '核对路线与装备' });
        await expect(dialog.getByLabel('反馈内容（可选）')).toHaveCount(0);
        if (index > 1) {
          if (index > 2) await expect(dialog.getByText(`历史反馈（${index - 2}）`)).toBeVisible();
          await expect(
            dialog
              .getByRole('region', { name: '最近结果' })
              .getByText(`第${index - 1}次核对`, { exact: true }),
          ).toBeVisible();
          await expect(
            dialog.locator('details').getByText(`第${index - 1}次核对`, { exact: true }),
          ).not.toBeVisible();
        }
        await dialog.getByRole('button', { name: '更新进展', exact: true }).click();
        await dialog.getByLabel('本次执行状态').selectOption(index === 5 ? 'completed' : 'partial');
        await dialog.getByLabel('反馈内容（可选）').fill(`第${index}次核对`);
        expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({
          path: info.outputPath(`feedback-editor-${width}.png`),
          fullPage: true,
        });
        await dialog.getByRole('button', { name: '保存', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText('行动反馈已保存')).toBeVisible();
        await filters
          .getByRole('button', { name: index === 5 ? '已结束' : '进行中', exact: true })
          .click();
        await expect(page.getByRole('searchbox')).toHaveValue('路线');
        await expect(list.getByRole('button', { name: '核对路线与装备' })).toBeVisible();
      }
      await list.getByRole('button', { name: '核对路线与装备' }).click();
      const dialog = page.getByRole('dialog', { name: '核对路线与装备' });
      await expect(dialog.getByLabel('反馈内容（可选）')).toHaveCount(0);
      await expect(
        dialog.getByRole('region', { name: '最近结果' }).getByText('第5次核对', { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`action-results-${width}.png`),
        fullPage: true,
      });
      await dialog.getByText('历史反馈（4）', { exact: true }).click();
      await expect(dialog.getByText('第1次核对', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '收起反馈', exact: true }).click();
      await expect(dialog.getByText('第1次核对', { exact: true })).toHaveCount(0);
      await dialog.getByRole('button', { name: '查看其余 1 条反馈' }).click();
      await expect(dialog.getByText('第1次核对', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '返回', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(await page.locator('body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`feedback-completed-${width}.png`),
        fullPage: true,
      });
    });
  });
}
