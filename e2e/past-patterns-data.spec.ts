import { expect, test } from '@playwright/test';

const entries = [
  {
    id: 'pattern-source-1',
    title: '第一次沟通后的记录',
    content: '我在会议结束后写下了当时的感受与下一步。',
    tags: ['事件:沟通'],
    createdAt: Date.parse('2026-09-21T09:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'pattern-source-2',
    title: '第二次沟通后的记录',
    content: '这次我先听完对方的想法，再写下自己的回应。',
    tags: ['事件:沟通'],
    createdAt: Date.parse('2026-08-20T09:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'pattern-source-3',
    title: '第三次沟通后的记录',
    content: '我给这次交流留下了简短的复述，方便以后再看。',
    tags: ['事件:沟通'],
    createdAt: Date.parse('2026-07-20T09:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
  {
    id: 'pattern-source-4',
    title: '第四次沟通后的记录',
    content: '在结束前，我确认了彼此都理解的安排。',
    tags: ['事件:沟通'],
    createdAt: Date.parse('2026-06-20T09:00:00+08:00'),
    updatedAt: Date.now(),
    isLocked: false,
  },
];

const coreUnderstandings = [
  {
    id: 'confirmed-pattern',
    statement: '在重要沟通前，你会先分清事实与推测，再决定怎样回应。',
    status: 'confirmed',
    sourceEntryIds: ['pattern-source-1', 'pattern-source-2'],
    createdAt: Date.parse('2026-09-22T09:00:00+08:00'),
    patternDomain: 'relational',
    patternLabel: '澄清后回应',
    outcome: '沟通更聚焦，也更容易留下可执行的共识。',
    summaryKind: 'past-pattern',
  },
  {
    id: 'candidate-pattern',
    statement: '面对复杂沟通时，你正在把即时反应改为先整理再表达。',
    status: 'pending',
    sourceEntryIds: [
      'pattern-source-1',
      'pattern-source-2',
      'pattern-source-3',
      'pattern-source-4',
    ],
    createdAt: Date.parse('2026-09-23T09:00:00+08:00'),
    patternDomain: 'behavioral',
    patternLabel: '整理后表达',
    outcome: '表达的节奏更稳定，仍值得在更多情境中验证。',
  },
];

const understandings = [
  ...coreUnderstandings,
  ...[
    '遇到复杂选择时，你会先拆开约束，再决定最小可行动作。',
    '当计划被打断时，你会先保留核心节奏，再调整其余安排。',
    '面对重要关系的分歧时，你倾向于先确认彼此真正关心的部分。',
    '在高压任务前，你会通过写下顺序让注意力重新稳定下来。',
    '面对不确定的结果时，你会为自己保留一次复盘和调整的空间。',
    '当信息过多时，你会主动收窄问题，先处理最能改变局面的部分。',
    '在需要表达立场时，你会先辨认感受，再组织能够被理解的话。',
    '当行动迟迟无法开始时，你会把任务拆到今天能够完成的一步。',
  ].map((statement, index) => ({
    id: `density-pattern-${index}`,
    statement,
    status: index % 2 === 0 ? 'confirmed' : 'pending',
    sourceEntryIds: ['pattern-source-1', 'pattern-source-2'],
    createdAt: Date.parse(`2026-0${(index % 8) + 1}-12T09:00:00+08:00`),
    patternDomain: index % 2 === 0 ? 'behavioral' : 'decision',
    patternLabel: '正在形成的选择方式',
    outcome: '这条理解仍在真实经历中接受检验。',
    summaryKind: 'past-pattern',
  })),
];

for (const mode of ['mobile', 'web'] as const) {
  test(`past patterns keep conclusions readable with real ${mode} data`, async ({ page }) => {
    await page.setViewportSize(
      mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.addInitScript((items) => {
      localStorage.setItem('vector:avatar:understandings:v1', JSON.stringify(items));
    }, understandings);
    await page.route('**/__past-patterns*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html class="vector-force-${mode} ${mode === 'mobile' ? 'mobile-product-active' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
        const {default:React}=await import('/node_modules/.vite/deps/react.js'); const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {PastRepository}=await import('/features/mobile/PastRepository.tsx'); const {MobileShell}=await import('/features/mobile/MobileShell.tsx'); const {AppPageFrame}=await import('/components/AppPageFrame.tsx');
        const noop=()=>{}; const props={initialSection:'pattern',language:'zh',theme:'dark',entries:${JSON.stringify(entries)},principles:[],onAddPrinciple:noop,onDeletePrinciple:noop,onUpdatePrinciple:noop,onSelectEntry:noop,onDeleteEntries:noop};
        const content=React.createElement(PastRepository,props); ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${mode === 'mobile' ? 'MobileShell' : 'AppPageFrame'},{activeTab:'past',language:'zh',onNavigate:noop,onTabChange:noop},content));
      </script></body></html>`,
      }),
    );
    await page.goto('/__past-patterns');
    await expect(page.locator('.mobile-past-pattern-card')).toHaveCount(10, { timeout: 60_000 });

    const confirmed = page
      .locator('.mobile-past-pattern-card')
      .filter({ hasText: '先分清事实与推测' });
    const candidate = page.locator('.mobile-past-pattern-card').filter({ hasText: '先整理再表达' });
    await expect(confirmed.getByText('已确认', { exact: true })).toBeVisible();
    await expect(confirmed.getByText('出现 2 次', { exact: true })).toBeVisible();
    await expect(confirmed.getByRole('button', { name: '萃取原则', exact: true })).toBeVisible();
    await expect(candidate.getByText('候选', { exact: true })).toBeVisible();
    await expect(candidate.getByText('出现 4 次', { exact: true })).toBeVisible();
    await expect(candidate.getByRole('button', { name: '确认模式', exact: true })).toBeVisible();
    await expect(candidate.getByText('行为 · 整理后表达 · 稳定', { exact: true })).toHaveCount(0);

    const evidence = candidate.getByRole('button', { name: '查看依据', exact: true });
    await evidence.focus();
    await page.keyboard.press('Enter');
    await expect(evidence).toHaveAttribute('aria-expanded', 'true');
    await expect(candidate.getByText('行为 · 整理后表达 · 稳定', { exact: true })).toBeVisible();
    await expect(candidate.getByText('结果', { exact: true })).toBeVisible();
    await expect(candidate.getByText('还有 2 条', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(evidence).toHaveAttribute('aria-expanded', 'false');

    await candidate.getByRole('button', { name: '确认模式', exact: true }).click();
    await expect(candidate.getByRole('button', { name: '萃取原则', exact: true })).toBeVisible();
    await expect(candidate.getByText('已确认', { exact: true })).toBeVisible();

    const sizes =
      mode === 'mobile'
        ? [
            { width: 320, height: 844 },
            { width: 390, height: 844 },
            { width: 430, height: 932 },
            { width: 844, height: 390 },
          ]
        : [
            { width: 1280, height: 900 },
            { width: 1440, height: 1000 },
            { width: 2048, height: 1100 },
          ];
    for (const size of sizes) {
      await page.setViewportSize(size);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const cards = page.locator('.mobile-past-pattern-card');
      await expect(cards).toHaveCount(10);
      for (let index = 0; index < (await cards.count()); index += 1) {
        const card = cards.nth(index);
        await expect(card.locator('.mobile-past-pattern-card__actions button')).toHaveCount(2);
        const statement = await card.locator(':scope > p').boundingBox();
        const actions = await card.locator('.mobile-past-pattern-card__actions').boundingBox();
        expect(statement).not.toBeNull();
        expect(actions).not.toBeNull();
        expect(actions!.y).toBeGreaterThanOrEqual(statement!.y + statement!.height);
        if (size.width >= 768) expect(statement!.width).toBeLessThanOrEqual(760);
      }
    }
  });
}
