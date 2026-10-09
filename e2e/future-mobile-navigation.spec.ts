import { expect, test, type Page } from '@playwright/test';

// This mounts the real future module inside the mobile shell. Keep the test
// focused on the current information architecture: design results and
// practice records, with one editor that selects its planning type inside it.
const harness = `<!doctype html><html lang="zh-CN" class="vector-force-mobile mobile-product-active">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Future browser integration</title><link rel="stylesheet" href="/index.css"></head>
<body><main id="future-test-root" style="width:100%"></main><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
const { default: React } = await import('/node_modules/.vite/deps/react.js');
const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
const { createElement } = React;
const { createRoot } = ReactDOM;
const { FuturePage } = await import('/features/future/FuturePage.tsx');
const { MobileShell } = await import('/features/mobile/MobileShell.tsx');
createRoot(document.getElementById('future-test-root')).render(
  createElement(MobileShell, {activeTab:'future',language:'zh',onTabChange:()=>{}},
    createElement(FuturePage, {entries:[],onSelectEntry:()=>{}})));
</script></body></html>`;

async function mount(page: Page) {
  await page.route('**/__future-spec', (route) =>
    route.fulfill({ contentType: 'text/html', body: harness }),
  );
  await page.goto('/__future-spec');
  await expect(page.getByRole('tablist', { name: '未来分区' })).toBeVisible();
}

for (const width of [320, 393, 768, 1280]) {
  test(`future design and practice stay usable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await mount(page);

    const sections = page.getByRole('tablist', { name: '未来分区' });
    await expect(sections.getByRole('tab')).toHaveCount(2);
    await expect(sections.getByRole('tab', { name: '设计', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('button', { name: '添加规划', exact: true })).toBeVisible();
    for (const name of ['愿景', '目标', '行动规划']) {
      await expect(page.getByRole('region', { name })).toBeVisible();
    }
    await expect(page.getByText('暂未记录')).toHaveCount(3);

    // Planning types are deliberately chosen in the one full-page editor;
    // they are not separate top-level creation paths.
    await page.getByRole('button', { name: '添加规划', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '行动规划' });
    await expect(editor).toBeVisible();
    const bounds = (await editor.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(width);
    expect(bounds.height).toBe(844);
    await expect(page.locator('.mobile-main-nav')).toBeHidden();
    const types = editor.getByRole('group', { name: '规划类型' });
    await expect(types.getByRole('button')).toHaveCount(3);
    await types.getByRole('button', { name: '行动规划', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '行动规划' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '行动内容' })).toBeVisible();
    const actionEditor = page.getByRole('dialog', { name: '行动规划' });
    expect(await actionEditor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`future-editor-${width}.png`) });
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await sections.getByRole('tab', { name: '践行', exact: true }).click();
    await expect(sections.getByRole('tab', { name: '践行', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('添加行动后，可在这里记录结果。')).toBeVisible();
    await expect(page.getByRole('button', { name: '去添加规划', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '去添加规划', exact: true }).click();
    await expect(sections.getByRole('tab', { name: '设计', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
