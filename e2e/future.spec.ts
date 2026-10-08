import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// This is a browser integration harness, NOT an authentication bypass in the app.
// Playwright serves this document only in its disposable context. It mounts the
// production mobile shell/component and uses the real IndexedDB repository.
const harness = `<!doctype html><html lang="zh-CN" class="vector-force-mobile">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Future browser integration</title><link rel="stylesheet" href="/index.css"></head>
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
  await expect(page.getByRole('navigation', { name: '未来功能' })).toBeVisible();
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/services/futureRepository.ts';
    const repo = (await import(path)) as typeof import('../services/futureRepository');
    return repo.readFutureSnapshot();
  });
}

async function seedMountain(page: Page, title = '今年爬十座不同的山') {
  return page.evaluate(async (title) => {
    const path = '/services/futureRepository.ts';
    const repo = (await import(path)) as typeof import('../services/futureRepository');
    return repo.saveGoal({
      title,
      status: 'active',
      tags: [],
      measurement: { kind: 'quantity', target: 10, unit: '座', precision: 0, distinctItems: true },
    });
  }, title);
}

test.use({ viewport: { width: 393, height: 852 } });

test('Future shares Past navigation typography and the mobile palette', async ({ page }) => {
  await mount(page);
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  const styles = await page.evaluate(() => {
    const shell = document.querySelector('.mobile-shell')!;
    const future = document.querySelector('.future-tabs')!;
    const reference = future.cloneNode(true) as HTMLElement;
    reference.className = 'mobile-past-page__segments';
    reference.style.visibility = 'hidden';
    shell.append(reference);
    const values = (element: Element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundImage, style.fontFamily, style.fontSize, style.padding];
    };
    const result = {
      actual: values(future.querySelector('button[aria-pressed="true"]')!),
      expected: values(reference.querySelector('button[aria-pressed="true"]')!),
      pageBackground: getComputedStyle(document.querySelector('.future-page')!).backgroundColor,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
    reference.remove();
    return result;
  });
  expect(styles.actual).toEqual(styles.expected);
  expect(styles.pageBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.overflow).toBe(false);
  await expect(page.locator('.mobile-shell__back')).toHaveCount(0);
});

test('editors stay inside the mobile page in a wide browser preview', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mount(page);
  for (const name of ['新增目标', '新增行动', '写愿景']) {
    if (name === '写愿景') {
      await page.getByRole('button', { name: '愿景', exact: true }).click();
    }
    await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const sheet = await dialog.boundingBox();
    const content = await page.locator('.future-page').boundingBox();
    expect(content!.width).toBe(440);
    expect(sheet!.x).toBeGreaterThanOrEqual(content!.x + 12);
    expect(sheet!.x + sheet!.width).toBeLessThanOrEqual(content!.x + content!.width - 12);
    if (name === '写愿景') {
      await page.screenshot({ path: testInfo.outputPath('future-vision-contained.png') });
      for (const width of [320, 393, 402, 440]) {
        await page.setViewportSize({ width, height: 852 });
        await expect.poll(async () => (await dialog.boundingBox())!.width).toBe(width - 32);
        expect((await dialog.boundingBox())!.x).toBe(16);
      }
    }
    await dialog.getByRole('button', { name: '关闭编辑' }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
  }
});

test('mobile create, count distinct mountains, correct, revoke and reload', async ({ page }) => {
  await mount(page);
  await page.getByRole('button', { name: '新增目标', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('目标', { exact: true }).fill('今年爬十座不同的山');
  await dialog.getByLabel('衡量方式').selectOption('quantity');
  await dialog.getByLabel('目标量').fill('10');
  await dialog.getByLabel('单位').fill('座');
  await dialog.getByLabel('不重复计数').check();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /今年爬十座不同的山/ }).click();
  for (const mountain of ['黄山', '黄山', '泰山']) {
    await page.getByRole('button', { name: '记进展', exact: true }).click();
    await dialog.getByLabel('成果名称').fill(mountain);
    await dialog.getByRole('button', { name: '计入进度' }).click();
    await expect(dialog).not.toBeVisible();
  }
  await expect(page.getByText('2 / 10 座', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '纠正', exact: true }).first().click();
  await dialog.getByLabel('成果名称').fill('黄山');
  await dialog.getByRole('button', { name: '计入进度' }).click();
  await expect(page.getByText('1 / 10 座', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销成果', exact: true }).click();
  await expect(page.getByText('0 / 10 座', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /今年爬十座不同的山 0 \/ 10 座/ })).toBeVisible();
  expect((await snapshot(page)).state.visions).toEqual([]);
});

test('real tabs serialize retries and publish committed changes', async ({ page, context }) => {
  await mount(page);
  const goal = await seedMountain(page);
  const other = await context.newPage();
  await mount(other);
  const submit = (target: Page) =>
    target.evaluate(async (goal) => {
      const path = '/services/futureRepository.ts';
      const repo = (await import(path)) as typeof import('../services/futureRepository');
      return repo.recordOutcome({
        operationId: 'same-retry-across-tabs',
        goalId: goal.id,
        expectedRevision: goal.revision,
        occurredOn: '2026-09-13',
        value: { kind: 'quantity', amount: 1 },
        itemLabel: '黄山',
      });
    }, goal);
  const [first, second] = await Promise.all([submit(page), submit(other)]);
  expect(first).toEqual(second);
  for (const tab of [page, other])
    await expect(tab.getByRole('button', { name: /今年爬十座不同的山 1 \/ 10 座/ })).toBeVisible();
  const edit = (target: Page, title: string) =>
    target.evaluate(
      async ({ goal, title }) => {
        const path = '/services/futureRepository.ts';
        const repo = (await import(path)) as typeof import('../services/futureRepository');
        try {
          await repo.saveGoal({ ...goal, title });
          return 'saved';
        } catch (error) {
          return (error as Error).message;
        }
      },
      { goal, title },
    );
  const result = await Promise.all([edit(page, '山川计划'), edit(other, '登山计划')]);
  expect(result.filter((value) => value === 'saved')).toHaveLength(1);
  expect(result.filter((value) => value.includes('目标已更新'))).toHaveLength(1);
  expect((await snapshot(page)).state.events).toHaveLength(1);
  await other.close();
});

test('mobile long content and 200% text keep forms inside viewport and save reachable', async ({
  page,
}, testInfo) => {
  await mount(page);
  const title = `让身体与生活保持连接${'long-title-'.repeat(12)}`;
  await seedMountain(page, title);
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
  for (const viewport of [
    ...[320, 375, 390, 393, 402, 430, 440].map((width) => ({ width, height: 852 })),
    { width: 852, height: 393 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: testInfo.outputPath('future-mobile.png'), fullPage: true });
  const initialAudit = await new AxeBuilder({ page }).include('.future-page').analyze();
  expect(initialAudit.violations).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.setViewportSize({ width: 390, height: 460 });
  await page.getByRole('button', { name: '新增目标', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('目标', { exact: true }).fill('试着理解摄影');
  await dialog.getByRole('button', { name: '保存', exact: true }).scrollIntoViewIfNeeded();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(460);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('future-large-text-dialog.png') });
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await snapshot(page)).state.goals.some((goal) => goal.title === '试着理解摄影')).toBe(
    true,
  );
});

test('protected vault fails closed instead of writing new private data as plaintext', async ({
  page,
}) => {
  await mount(page);
  await page.evaluate(async () => {
    const path = '/services/vaultTransaction.ts';
    const { vaultTransaction } = (await import(
      path
    )) as typeof import('../services/vaultTransaction');
    await vaultTransaction(['vector_master_vault_pwd_hash'], (values) => {
      values.vector_master_vault_pwd_hash = 'test-only-existing-password';
    });
  });
  await expect(page.getByRole('status')).toContainText('资料库已锁定');
  const navigation = page.getByRole('navigation', { name: '未来功能' });
  await navigation.getByRole('button', { name: '愿景' }).focus();
  await page.keyboard.press('Enter');
  await expect(navigation.getByRole('button', { name: '愿景', pressed: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资料库已锁定' })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(navigation.getByRole('button', { name: '计划', pressed: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资料库已锁定' })).toBeVisible();
  await expect(page.getByText('新增目标', { exact: true })).toHaveCount(0);
  await expect(seedMountain(page)).rejects.toThrow('解锁资料库');
  expect((await snapshot(page)).protectedVault).toBe(true);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('资料库已锁定');
  await expect(page.getByRole('navigation', { name: '未来功能' })).toBeVisible();
  await page.screenshot({ path: 'output/future-navigation-mobile.png', fullPage: true });
});
