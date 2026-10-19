import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

type SyntheticEntry = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  tags: string[];
  isLocked: boolean;
};

const ENTRY_COUNT = 1_000;
const ENTRY_KEY = 'vector_master_vault_entries';

const makeEntries = (): SyntheticEntry[] => {
  const start = Date.UTC(2026, 0, 1, 12, 0, 0);
  return Array.from({ length: ENTRY_COUNT }, (_, index) => ({
    id: `large-archive-${index}`,
    title: `合成经历 ${index}`,
    content: `合成经历 ${index}：这是用于稳定性验收的完整事实记录，关键词-${String(index % 20).padStart(2, '0')}。${'细节与上下文。'.repeat(30)}`,
    createdAt: start + index * 60_000,
    tags: [`事件:主题-${String(index % 20).padStart(2, '0')}`, index % 2 === 0 ? '工作事业' : '人际交往'],
    isLocked: false,
  }));
};

test('千条历史记录在浏览器中可稳定加载、检索、切换、展开与分页', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await seedOnboardedApp(page);
  const entries = makeEntries();
  await page.evaluate(async ({ key, values }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('keyval-store');
      request.onerror = () => reject(request.error ?? new Error('无法打开 IndexedDB'));
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('keyval', 'readwrite');
        transaction.objectStore('keyval').put(values, key);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error ?? new Error('无法写入记录'));
        transaction.onabort = () => reject(transaction.error ?? new Error('写入记录已中止'));
      };
    });
  }, { key: ENTRY_KEY, values: entries });

  await page.reload();
  const password = page.locator('input[type="password"]:visible');
  await expect(password).toHaveCount(1);
  await password.fill('VectorVisual123!');
  await password.press('Enter');
  await page.getByRole('navigation', { name: '主页面导航' }).waitFor({ state: 'visible' });
  await page.getByRole('navigation', { name: '主页面导航' }).getByRole('button', { name: /^过去/ }).click();
  await expect(page.getByTestId('past-page')).toBeVisible();

  const records = page.locator('.past-record');
  await expect(records).toHaveCount(100);
  await expect(records.first()).toContainText('合成经历 999');
  await expect(page.getByRole('button', { name: /加载更多/ })).toBeVisible();

  await page.getByRole('button', { name: /加载更多/ }).click();
  await expect(records).toHaveCount(200);
  await expect(records.nth(199)).toContainText('合成经历 800');

  const search = page.getByRole('searchbox', { name: '搜索记录' });
  const reviewTab = page.getByRole('tab', { name: '回看' });
  const insightTab = page.getByRole('tab', { name: '沉淀' });
  for (let round = 0; round < 20; round += 1) {
    const marker = `关键词-${String(round).padStart(2, '0')}`;
    await search.fill(marker);
    await expect(records).toHaveCount(50);
    await expect(records.first()).toContainText(marker);

    const toggle = records.first().getByRole('button', { name: '展开记录内容' });
    await toggle.click();
    await expect(records.first().getByRole('button', { name: '收起记录内容' })).toBeVisible();
    await records.first().getByRole('button', { name: '收起记录内容' }).click();

    await insightTab.click();
    await expect(insightTab).toHaveAttribute('aria-selected', 'true');
    await reviewTab.click();
    await expect(reviewTab).toHaveAttribute('aria-selected', 'true');
    await search.fill('');
    await expect(records).toHaveCount(100);
  }

  // Pagination is reset after each search, then remains monotonic for a long archive.
  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    await page.getByRole('button', { name: /加载更多/ }).click();
  }
  await expect(records).toHaveCount(500);
  await expect(records.nth(499)).toContainText('合成经历 500');
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
