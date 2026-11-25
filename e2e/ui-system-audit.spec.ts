import { expect, test } from '@playwright/test';
import { seedOnboardedApp } from './seedHelpers';

const lightness = (value: string) => {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  return channels.length === 3 ? (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722) / 255 : 0;
};

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`real module route and light surfaces at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await seedOnboardedApp(page);
    const navigation = page.getByRole('navigation', { name: '主页面导航' });
    for (const [label, path] of [['过去', 'past'], ['现在', 'now'], ['未来', 'future'], ['分身', 'avatar']] as const) {
      await navigation.getByRole('button', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
      const bodyColor = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
      expect(lightness(bodyColor), `${path} body: ${bodyColor}; html=${await page.locator('html').getAttribute('class')}; shell=${await page.locator('.mobile-shell').count()}`).toBeGreaterThan(.65);
      for (const textarea of await page.locator('textarea:visible').all()) {
        const color = await textarea.evaluate(el => {
          let node: Element | null = el;
          while (node) {
            const value = getComputedStyle(node).backgroundColor;
            const alpha = Number(value.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? '1');
            if (alpha > .95) return value;
            node = node.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        });
        expect(lightness(color), `${path} textarea effective surface: ${color}`).toBeGreaterThan(.65);
      }
      if (viewport.width >= 860) {
        const sidebar = page.locator('.v-sidebar:visible');
        await expect(sidebar).toBeVisible();
        expect((await sidebar.boundingBox())!.height).toBeGreaterThanOrEqual(viewport.height * .85);
      } else {
        const main = page.locator('.mobile-shell__content:visible');
        await expect(main).toBeVisible();
        expect((await main.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width * .85);
        const inner = main.locator(':scope > *:visible').first();
        if (await inner.count()) expect((await inner.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width * .85);
      }
    }
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`UI shell geometry at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: /进入|Enter/ }).first()).toBeVisible({ timeout: 60000 });
    await expect.poll(async () => {
      try { return await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); }
      catch { return false; }
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`), fullPage: true });
    const visibleSearch = page.locator('input[type="search"]:visible');
    if (await visibleSearch.count()) {
      await expect.poll(() => visibleSearch.first().evaluate((el) => getComputedStyle(el).fontSize)).not.toBe('0px');
    }
    if (viewport.width < 860) {
      const textInputs = page.locator('input:not([type="checkbox"]):not([type="radio"]):visible');
      for (const input of await textInputs.all()) {
        expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      }
      const canvas = page.locator('canvas:visible');
      expect(await canvas.count()).toBe(0);
    }
  });
}
