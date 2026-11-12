import { test, expect, type Page } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

async function savedEntries(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('keyval-store');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<
        Array<{ content: string; aiVisibility?: string; supplements?: Array<{ content: string }> }>
      >((resolve, reject) => {
        const request = db
          .transaction('keyval')
          .objectStore('keyval')
          .get('vector_master_vault_entries');
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`记录与补充每次保存都明确选择 AI 权限 ${viewport.width}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await seedOnboardedApp(page);
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    const content = `隐私验证 ${viewport.width}：今天整理了自己的想法。`;
    const supplement = '补充：这部分也需要重新确认权限。';
    await page.getByLabel('此刻发生了什么？').fill(content);
    await page.getByLabel('保存到过去').click();
    const privacy = page.getByRole('dialog', { name: '是否允许 AI 可见？' });
    await expect(privacy).toBeVisible();
    await expect(privacy.getByRole('button', { name: '返回编辑' })).toBeFocused();
    expect((await savedEntries(page)).some((e) => e.content === content)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('privacy-choice.png'), fullPage: true });
    expect(await privacy.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await privacy.boundingBox())!.height).toBeLessThan(viewport.height - 100);
    await page.keyboard.press('Escape');
    await expect(privacy).toHaveCount(0);
    await expect(page.getByLabel('此刻发生了什么？')).toHaveValue(content);
    await page.getByLabel('保存到过去').click();
    await privacy.getByRole('button', { name: /^仅自己可见/ }).click();
    await expect(page.getByTestId('past-page')).toBeVisible();
    await expect
      .poll(async () => (await savedEntries(page)).find((e) => e.content === content)?.aiVisibility)
      .toBe('private');

    const record = page
      .locator('.past-supplements')
      .filter({ has: page.getByRole('button', { name: '仅自己可见', exact: true }) })
      .last();
    await record.getByRole('button', { name: '仅自己可见', exact: true }).click();
    await privacy.getByRole('button', { name: /^允许 AI 可见/ }).click();
    await expect
      .poll(async () => (await savedEntries(page)).find((e) => e.content === content)?.aiVisibility)
      .toBe('allowed');
    await page
      .locator('.past-supplements')
      .last()
      .getByRole('button', { name: '补充', exact: true })
      .click();
    await page.getByLabel('补充内容', { exact: true }).fill(supplement);
    const editor = page.getByRole('dialog', { name: '补充', exact: true });
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(privacy).toBeVisible();
    await expect(privacy).toContainText('包括原文和全部补充');
    await page.screenshot({ path: testInfo.outputPath('supplement-consent.png'), fullPage: true });
    await privacy.getByRole('button', { name: '返回编辑' }).click();
    await expect(page.getByLabel('补充内容', { exact: true })).toHaveValue(supplement);
    expect(
      (await savedEntries(page)).find((e) => e.content === content)?.supplements ?? [],
    ).toHaveLength(0);
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await privacy.getByRole('button', { name: /^仅自己可见/ }).click();
    await expect(editor).toHaveCount(0);
    await expect
      .poll(async () => {
        const entry = (await savedEntries(page)).find((e) => e.content === content);
        return {
          visibility: entry?.aiVisibility,
          supplementCount: entry?.supplements?.length,
        };
      })
      .toEqual({ visibility: 'private', supplementCount: 1 });
    await expect(page.getByText(supplement, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath('private-supplement-saved.png'),
      fullPage: true,
    });
  });
}
