import { expect, test } from '@playwright/test';

const entries = [
  {
    id: 'long-reflection',
    title: '把注意力放回真正重要的事情，而不是不断回应所有临时请求',
    content: `今天重新安排了工作顺序，先完成最重要的一件事。${'减少切换后，我更能专注，也留出了休息时间。'.repeat(10)}`,
    tags: ['事件:工作', '心情:平静', '注意力', '节奏', '边界'],
    createdAt: Date.parse('2026-09-22T09:30:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'date-title',
    title: '2026年9月21日18点00分',
    content: '和朋友散步，发现不急着寻找答案时，交流反而更自然。',
    tags: ['事件:关系', '轻松'],
    createdAt: Date.parse('2026-09-21T18:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'untitled',
    title: '',
    content: '在犹豫时先停下来，确认自己真正想保护的是什么。',
    tags: ['选择', '心情:清醒'],
    createdAt: Date.parse('2025-12-12T12:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'long-tags',
    title: '一次不顺利的沟通',
    content: '表达感受前，先把对方实际说的话和我的推测分开。',
    tags: ['事件:沟通', '关系', '表达', '倾听', '情绪', '练习'],
    createdAt: Date.parse('2024-03-05T08:10:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
];

const principles = [
  {
    id: 'principle-2026',
    text: '先辨认真正重要的事，再分配注意力。',
    year: 2026,
    createdAt: Date.parse('2026-09-22T10:00:00+08:00'),
    showOnHome: true,
    tags: ['工作'],
    derivedFromEntryIds: ['long-reflection'],
    sourcePatternIds: [],
  },
  {
    id: 'principle-2024',
    text: '把事实和推测分开，关系才有余地。',
    year: 2024,
    createdAt: Date.parse('2024-03-06T10:00:00+08:00'),
    showOnHome: false,
    tags: ['关系'],
    derivedFromEntryIds: ['long-tags'],
    sourcePatternIds: [],
  },
  ...[
    '复杂选择先写下真正要守住的东西。',
    '情绪升起时，先区分感受与事实。',
    '给重要关系留出不解决问题的时间。',
    '行动卡住时，把下一步缩小到十分钟。',
    '承诺之前，先确认自己的余量。',
    '反复焦虑的地方，通常藏着未说清的期待。',
    '把节奏放慢，才听得见内心真正的答案。',
    '先完成，再把经验写成下一次可用的提醒。',
  ].map((text, index) => ({
    id: `principle-density-${index}`,
    text,
    year: index < 5 ? 2026 : 2025,
    createdAt: Date.parse(`2026-0${(index % 8) + 1}-10T10:00:00+08:00`),
    showOnHome: index === 0,
    tags: [],
    derivedFromEntryIds: [],
    sourcePatternIds: [],
  })),
];

for (const mode of ['mobile', 'web'] as const) {
  test(`past reading uses clear affordances with real ${mode} data`, async ({ page }) => {
    await page.setViewportSize(
      mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.route('**/__past-reading*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html class="vector-force-${mode} ${mode === 'mobile' ? 'mobile-product-active' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
        const {default:React}=await import('/node_modules/.vite/deps/react.js'); const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {PastRepository}=await import('/features/mobile/PastRepository.tsx'); const {MobileShell}=await import('/features/mobile/MobileShell.tsx'); const {AppPageFrame}=await import('/components/AppPageFrame.tsx');
        const noop=()=>{}; const props={language:'zh',theme:'dark',entries:${JSON.stringify(entries)},principles:${JSON.stringify(principles)},onAddPrinciple:noop,onDeletePrinciple:noop,onUpdatePrinciple:noop,onSelectEntry:noop,onDeleteEntries:noop};
        const page=React.createElement(PastRepository,props); ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${mode === 'mobile' ? 'MobileShell' : 'AppPageFrame'},{activeTab:'past',language:'zh',onNavigate:noop,onTabChange:noop},page));
      </script></body></html>`,
      }),
    );
    await page.goto('/__past-reading');
    await expect(page.locator('.past-record')).toHaveCount(4, { timeout: 60_000 });
    await expect(page.locator('.past-record time')).toHaveCount(4);
    await expect(page.getByRole('button', { name: '展开记录内容' })).toHaveCount(1);
    await expect(page.locator('.past-record').nth(1).getByRole('button')).toHaveCount(0);
    await expect(page.getByText('2026年9月21日18点00分', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '展开记录内容' }).click();
    await expect(page.getByRole('button', { name: '收起记录内容' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    for (const width of mode === 'mobile' ? [320, 390, 430] : [1280, 1440, 2048]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    if (mode === 'web') {
      const readingCard = (await page.locator('.past-record').first().boundingBox())!;
      expect(readingCard.width).toBeLessThanOrEqual(1000);
    }

    await page.getByRole('tab', { name: '沉淀', exact: true }).click();
    await expect(page.getByText('先辨认真正重要的事，再分配注意力。')).toBeVisible();
    await expect(page.getByText('把事实和推测分开，关系才有余地。')).toBeVisible();
    await expect(page.locator('.mobile-principle-card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: '写原则', exact: true })).toBeVisible();

    for (const width of mode === 'mobile' ? [320, 390, 430] : [1280, 1440, 2048]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const cards = page.locator('.mobile-principle-card');
      for (let index = 0; index < (await cards.count()); index += 1) {
        const card = cards.nth(index);
        await expect(card.getByRole('button')).toHaveCount(2);
        const text = await card.locator('p').boundingBox();
        const actions = await card.locator('.mobile-principle-card__actions').boundingBox();
        expect(text).not.toBeNull();
        expect(actions).not.toBeNull();
        expect(actions!.x).toBeGreaterThanOrEqual(text!.x);
        if (width >= 768) expect(text!.width).toBeLessThanOrEqual(760);
      }
    }
  });
}
