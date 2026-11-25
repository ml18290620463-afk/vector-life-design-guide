import { test, expect } from '@playwright/test';
import { resetPersistentAppState } from './seedHelpers';

for (const language of ['zh', 'en'] as const)
  for (const width of [1440, 390]) {
    test(`empty first run → consent → Past → reload ${language} ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await resetPersistentAppState(page);
      await page.getByTestId('cover-initialize').click();
      await page
        .getByRole('navigation', { name: '主页面导航' })
        .getByRole('button', { name: /^现在/ })
        .click();
      await expect(page.getByTestId('now-page')).toBeVisible();
      await expect(page.locator('input[type=password]:visible')).toHaveCount(0);
      // Use the same public store action as Settings; persist across reload.
      await page.evaluate(async (language) => {
        const path = '/stores/appStore.ts';
        const { useAppStore } = await import(/* @vite-ignore */ path);
        useAppStore.getState().setLanguage(language);
      }, language);
      const input = page.getByLabel(
        language === 'en' ? 'What is happening now?' : '此刻发生了什么？',
      );
      const marker = `First real experience ${language} ${width}: I clarified the meeting goal.`;
      await input.fill(marker);
      await page.getByLabel(language === 'en' ? 'Save to Past' : '保存到过去').click();
      const dialog = page.getByRole('dialog', {
        name: language === 'en' ? 'Allow AI access?' : '是否允许 AI 可见？',
      });
      await dialog
        .getByRole('button', { name: language === 'en' ? /^Only me/ : /^仅自己可见/ })
        .click();
      await expect(page.getByTestId('past-page')).toBeVisible();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('past-page')).toBeVisible();
      await expect(page.getByText(marker, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('vector_language'))).toBe(language);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: testInfo.outputPath('first-record-persisted.png'),
        fullPage: true,
      });
    });
  }
