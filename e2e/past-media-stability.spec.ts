import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`回看图片加载前后布局稳定 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/stability-image.svg', async (route) => {
      await pending;
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="2000"><rect width="100" height="2000" fill="green"/></svg>',
      });
    });
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'media-stability';
      fixture.style.cssText =
        'position:fixed;inset:0;overflow:auto;background:white;z-index:99999;padding:16px';
      fixture.innerHTML = `<div class="mobile-past-image-gallery" data-count="1"><figure class="mobile-past-image"><img src="/stability-image.svg" /></figure></div><div class="mobile-past-image-gallery" data-count="2"><figure class="mobile-past-image"><img src="/stability-image.svg" /></figure><figure class="mobile-past-image"><img src="/stability-image.svg" /></figure></div><div class="archive-entry-media"><img src="/stability-image.svg" /></div><div class="archive-entry-media archive-entry-media--compact"><img src="/stability-image.svg" /></div><div id="after-media">后续记录</div>`;
      document.body.append(fixture);
    });
    const bounds = () =>
      page.locator('#media-stability img, #after-media').evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
    const before = await bounds();
    expect(before.slice(0, -1).every((box) => box.height > 0)).toBe(true);
    release();
    await expect
      .poll(() =>
        page
          .locator('#media-stability img')
          .evaluateAll((images) =>
            images.every((image) => (image as HTMLImageElement).naturalHeight === 2000),
          ),
      )
      .toBe(true);
    expect(await bounds()).toEqual(before);
  });
}
