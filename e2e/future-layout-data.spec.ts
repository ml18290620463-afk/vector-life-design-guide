import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const longVision =
  '在持续学习、稳定关系与自由探索之间，建立一条能够长期行走、也能照顾好自己的生活路径';
const longGoal = '在今年十二月前完成十二次有准备的山野行走，并形成一份属于自己的路线笔记';
const longAction = '在十月前完成黄山路线、装备与同行安排，留出天气变化时可以调整的余地';

async function openPlanningEditor(
  page: import('@playwright/test').Page,
  kind: '愿景' | '目标' | '行动规划',
) {
  await page.getByRole('button', { name: '编辑未来规划', exact: true }).click();
  await page.getByRole('button', { name: kind, exact: true }).click();
}

test('未来设计：真实长规划在手机与宽屏中保持可读', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOnboardedApp(page);
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^未来/ })
    .click();

  await page.getByRole('button', { name: '从愿景开始', exact: true }).click();
  await page.getByLabel('愿景内容').fill(longVision);
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await openPlanningEditor(page, '愿景');
  await page.getByLabel('愿景内容').fill('让每周都保留一段安静阅读与整理想法的时间');
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await openPlanningEditor(page, '目标');
  await page.getByLabel('目标内容').fill(longGoal);
  await page.getByLabel('完成时间（可选）').fill('2026-12-31');
  await page.getByLabel('所属愿景（可选）').selectOption({ index: 1 });
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await openPlanningEditor(page, '目标');
  await page.getByLabel('目标内容').fill('完成六本值得反复阅读的书，并写下自己的理解');
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await openPlanningEditor(page, '行动规划');
  await page.getByLabel('行动内容').fill(longAction);
  await page.getByLabel('计划日期（可选）').fill('2026-10-01');
  await page.getByLabel('所属目标（可选）').selectOption({ index: 1 });
  await page.getByRole('button', { name: '确定', exact: true }).click();

  await openPlanningEditor(page, '行动规划');
  await page.getByLabel('行动内容').fill('周日晚上列出下一周最重要的一次练习');
  await page.getByRole('button', { name: '确定', exact: true }).click();

  const cards = page.locator('.future-design-summary-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('查看其余 1 条', { exact: true })).toHaveCount(3);
  await expect(page.getByText('完成两次练习。', { exact: true })).toHaveCount(0);
  await expect(page.getByText('行动结果', { exact: true })).toHaveCount(0);

  for (const width of [320, 390, 430, 1280, 1440, 2048]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(cards.first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const measurements = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const primary = element.querySelector<HTMLElement>('.future-summary-result__primary');
        const context = element.querySelector<HTMLElement>('.future-summary-result__context');
        return {
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          width: box.width,
          primaryBottom: primary?.getBoundingClientRect().bottom ?? 0,
          contextTop: context?.getBoundingClientRect().top ?? 0,
          hasContext: Boolean(context),
        };
      }),
    );
    for (const item of measurements) {
      expect(item.left).toBeGreaterThanOrEqual(-1);
      expect(item.right).toBeLessThanOrEqual(width + 1);
      if (item.hasContext) expect(item.contextTop).toBeGreaterThanOrEqual(item.primaryBottom);
    }
    if (width >= 1280) {
      expect(measurements.every((item) => item.width >= 280 && item.width <= 410)).toBe(true);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('查看其余 1 条', { exact: true }).first().click();
  await expect(page.getByText(longVision, { exact: true })).toBeVisible();
});
