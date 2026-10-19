import { expect, test, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const entries = [
  {
    text: '周一项目会议前，我列出三个待决定的问题。会后明确了负责人和下一步，提出异议后事情反而更清楚。',
    tag: '工作事业',
  },
  {
    text: '周二收到方案退回意见，第一反应是觉得自己做得不够好。暂停后核对意见，两条可以立即修改，一条需要澄清。',
    tag: '工作事业',
  },
  {
    text: '周三与朋友约周末见面时发现时间冲突。我说明已有安排，一起改到周日下午，双方确认了新时间。',
    tag: '人际交往',
  },
];

async function addEntry(page: Page, entry: (typeof entries)[number], image = false) {
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^现在/ })
    .click();
  await page.getByLabel('此刻发生了什么？').fill(entry.text);
  if (image) {
    await page.locator('input[type=file][accept="image/*"]').setInputFiles('public/icon-192.png');
  }
  await page.getByLabel('心情与事件').click();
  await page.getByRole('button', { name: entry.tag, exact: true }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByLabel('保存到过去').click();
  await expect(page.getByTestId('past-page')).toBeVisible();
  await expect(page.locator('.past-record').filter({ hasText: entry.text })).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`三条真实路径审计 ${width}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await seedOnboardedApp(page);
    for (const [index, entry] of entries.entries()) await addEntry(page, entry, index === 0);
    await expect(page.locator('.past-record')).toHaveCount(3);
    for (const entry of entries)
      await expect(page.locator('.past-record').filter({ hasText: entry.text })).toBeVisible();
    const first = page.locator('.past-record').filter({ hasText: entries[0].text });
    const timestamp = await first.locator('.past-record__date').getAttribute('datetime');
    expect(timestamp).toBeTruthy();
    await expect(first.locator('img')).toHaveCount(1);
    const thumbnail = await first.locator('.mobile-past-image').boundingBox();
    expect(thumbnail).not.toBeNull();
    expect(thumbnail!.width).toBeLessThanOrEqual(200);
    expect(thumbnail!.height).toBeLessThanOrEqual(160);
    await first.getByRole('button', { name: /查看图片/ }).click();
    await expect(page.getByRole('dialog').locator('.past-image-viewer img')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click();
    await page.screenshot({ path: info.outputPath('three-records.png'), fullPage: true });

    const search = page.getByRole('searchbox', { name: '搜索记录' });
    await search.fill('工作事业');
    await expect(page.locator('.past-record')).toHaveCount(2);
    await search.fill('周日下午');
    await expect(page.locator('.past-record')).toHaveCount(1);
    await expect(page.locator('.past-record')).toContainText(entries[2].text);
    await search.fill('没有出现的事实');
    await expect(page.locator('.past-record')).toHaveCount(0);
    await search.fill('');
    await first.getByRole('button', { name: '补充', exact: true }).click();
    await page.getByLabel('补充内容').fill('补充：会议纪要已发给三位负责人。');
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(first).toContainText('会议纪要已发给三位负责人');
    await expect(first.locator('.past-record__date')).toHaveAttribute('datetime', timestamp!);
    await search.fill('会议纪要');
    await expect(search).toHaveValue('会议纪要');
    await expect(page.locator('.past-record')).toHaveCount(1);
    await search.fill('');
    await page.reload();
    const password = page.locator('input[type="password"]:visible');
    await expect(password).toHaveCount(1);
    await password.fill('VectorVisual123!');
    await password.press('Enter');
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^过去/ })
      .click();
    await expect(page.locator('.past-record')).toHaveCount(3);
    await expect(first).toContainText('会议纪要已发给三位负责人');
    await expect(first.locator('img')).toHaveCount(1);
    await expect(first.locator('.past-record__date')).toHaveAttribute('datetime', timestamp!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('restored-records.png'), fullPage: true });
  });
}
