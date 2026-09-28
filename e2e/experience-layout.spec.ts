import { expect, test } from '@playwright/test';

for (const mode of ['web', 'mobile']) {
  for (const module of ['past', 'now', 'future', 'avatar']) {
    test(`${mode} ${module} layout and editor`, async ({ page }, info) => {
      await page.setViewportSize(
        mode === 'web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/__layout*', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html class="vector-force-${mode} ${mode === 'mobile' ? 'mobile-product-active' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
        const {default:React}=await import('/node_modules/.vite/deps/react.js');
        const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {MobileShell}=await import('/features/mobile/MobileShell.tsx');
        const {AppPageFrame}=await import('/components/AppPageFrame.tsx');
        const {${{ past: 'PastRepository', now: 'NowPage', future: 'FuturePage', avatar: 'AvatarChatPage' }[module]}:Module}=await import('${{ past: '/features/mobile/PastRepository.tsx', now: '/features/now/components/NowPage.tsx', future: '/features/future/FuturePage.tsx', avatar: '/features/now/components/AvatarChatPage.tsx' }[module]}');
        const noop=()=>{};
        const common={language:'zh',theme:'dark',entries:[],pastEntries:[],principles:[],actions:[],onSelectEntry:noop,onAddPrinciple:noop,onDeletePrinciple:noop,onUpdatePrinciple:noop,onDeleteEntries:noop,draft:{text:'',materials:[],mood_tags:[],event_tags:[],record_time:'2026-09-22',display_time:'2026年9月22日',updated_at:'2026-09-22'},setDraft:noop,sending:false,onSend:async()=>true,onSaveDraft:noop,onDiscardDraft:noop,onExit:noop,onBack:noop,onRouteChange:noop,showToast:noop,mobileShell:${mode === 'mobile'},onNavigateModule:noop,launchContext:{mode:'general',source:'global'}};
        if ('${module}' === 'past') {
          common.entries = [
            {id:'past-one',title:'把注意力放回真正重要的事情',content:'今天重新安排了工作顺序，先完成最重要的一件事。'+ '减少切换后，我更能专注，也留出了休息时间。'.repeat(8),tags:['心情:平静','事件:个人成长'],createdAt:Date.parse('2026-09-22T09:30:00+08:00'),updatedAt:Date.now(),isLocked:false},
            {id:'past-two',title:'2026年9月21日18点00分',content:'和朋友散步，发现不急着寻找答案时，交流反而更自然。',tags:['关系'],createdAt:Date.parse('2026-09-21T18:00:00+08:00'),updatedAt:Date.now(),isLocked:false}
          ];
        }
        if ('${module}' === 'avatar') {
          // Seed the maximum retained history. The screen must only mount a
          // small reading window even when a long-running conversation has
          // reached its storage limit.
          localStorage.setItem('vector:avatar:sessions:v1', JSON.stringify([{id:'scroll-history',mode:'general',context:common.launchContext,createdAt:1,updatedAt:2,messages:Array.from({length:600},(_,i)=>({id:'turn-'+i,role:i%2?'assistant':'user',type:'text',content:'历史消息 '+i+'：'+ '这是一段用于验证长对话能够完整阅读的内容。'.repeat(12),created_at:new Date(1700000000000+i*1000).toISOString()})),references:[]}]));
        }
        const content=React.createElement(Module,common);
        const child='${module}' === 'avatar' ? React.createElement('div',{className:'now-shell ${mode === 'mobile' ? 'now-flow--mobile-shell' : ''}'},content) : content;
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${mode === 'mobile' ? 'MobileShell' : 'AppPageFrame'},{variant:'${module}' === 'avatar' ? 'avatar' : ('${module}' === 'now' ? 'now' : 'default'),activeTab:'${module}',language:'zh',onNavigate:noop,onTabChange:noop},child));
      </script></body></html>`,
        }),
      );
      await page.goto(`/__layout?preview=${mode}`);
      await expect(
        page.locator(mode === 'web' ? '.desktop-workspace' : '.mobile-shell'),
      ).toBeVisible({ timeout: 60000 });
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (mode === 'mobile' && (module === 'avatar' || module === 'now')) {
        const editor = page.locator(module === 'avatar' ? '.now-chat-input' : '.now-bottom-bar');
        await editor.scrollIntoViewIfNeeded();
        const box = await editor.boundingBox();
        const nav = await page.locator('.mobile-main-nav').boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y + 1);
      }
      if (mode === 'web' && module === 'now') {
        const card = (await page.locator('.now-card').boundingBox())!;
        expect(card.width).toBeGreaterThanOrEqual(900);
        expect(card.width).toBeLessThanOrEqual(1120);
        expect(card.x).toBeGreaterThanOrEqual(160);
        expect(card.x + card.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

        await page.setViewportSize({ width: 2048, height: 900 });
        await expect(page.locator('.now-card')).toBeVisible();
        const wideCard = (await page.locator('.now-card').boundingBox())!;
        expect(wideCard.width).toBeGreaterThanOrEqual(980);
        expect(wideCard.width).toBeLessThanOrEqual(1120);
        expect(wideCard.x).toBeGreaterThanOrEqual(320);
        expect(wideCard.x + wideCard.width).toBeLessThanOrEqual(2049);
      }
      await page.screenshot({ path: info.outputPath(`${mode}-${module}.png`) });
      if (module === 'past') {
        if (mode === 'web') {
          const body = page.locator('.mobile-past-page__body');
          const searchRow = page.locator('.mobile-past-search-row');
          const record = page.locator('.past-record').first();
          const baseline = (await body.boundingBox())!;
          const baselineSearch = (await searchRow.boundingBox())!;
          const baselineRecord = (await record.boundingBox())!;
          expect(baseline.width).toBeGreaterThanOrEqual(900);
          expect(baseline.x).toBeGreaterThanOrEqual(200);
          expect(baseline.x + baseline.width).toBeLessThanOrEqual(1441);
          expect(baselineSearch.x).toBeGreaterThanOrEqual(baseline.x);
          expect(baselineSearch.x + baselineSearch.width).toBeLessThanOrEqual(baseline.x + baseline.width + 1);
          expect(baselineRecord.width).toBeGreaterThanOrEqual(850);

          await page.setViewportSize({ width: 2048, height: 900 });
          await expect(body).toBeVisible();
          const wide = (await body.boundingBox())!;
          const wideRecord = (await record.boundingBox())!;
          expect(wide.width).toBeGreaterThanOrEqual(1100);
          expect(wide.width).toBeLessThanOrEqual(1500);
          expect(wide.x).toBeGreaterThanOrEqual(200);
          expect(wide.x + wide.width).toBeLessThanOrEqual(2049);
          // The reading column deliberately stops growing on ultrawide
          // screens.  A journal entry is prose, so keeping it close to the
          // 880px measure used at normal desktop widths preserves scannable
          // line lengths and leaves quiet space around the timeline.
          expect(wideRecord.width).toBeGreaterThanOrEqual(850);
          expect(wideRecord.width).toBeLessThanOrEqual(1000);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
        const cards = page.locator('.past-record');
        await expect(cards).toHaveCount(2);
        await expect(page.locator('.past-record time')).toHaveCount(2);
        await expect(page.getByText('最新写入')).toHaveCount(0);
        const search = page.locator('.mobile-past-search-row');
        expect((await search.boundingBox())!.y).toBeLessThan(
          (await cards.first().boundingBox())!.y,
        );
        await cards.first().getByRole('button', { name: '展开记录内容' }).click();
        await expect(cards.first().getByRole('button', { name: '收起记录内容' })).toBeVisible();
        await cards.first().getByRole('button', { name: '收起记录内容' }).click();
        await page.getByRole('button', { name: '选择', exact: true }).click();
        const management = page.getByRole('dialog', { name: '管理记录' });
        await expect(management.getByRole('checkbox').first()).toBeVisible();
        await management.getByRole('button', { name: '返回回看', exact: true }).click();
        await expect(management).not.toBeVisible();
        for (const width of mode === 'mobile' ? [320, 390, 430] : [1280, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
        await page.screenshot({ path: info.outputPath(mode + '-past-compact.png') });
        await page.getByRole('tab', { name: '沉淀', exact: true }).click();
        await page.getByRole('button', { name: '写原则', exact: true }).click();
        const editor = page.getByRole('dialog', { name: '书写原则' });
        await expect(editor).toBeVisible();
        const bounds = (await editor.boundingBox())!;
        // Editors are standalone pages: no underlying module UI or fixed nav
        // should remain exposed while a user writes.
        expect(bounds.x).toBe(0);
        expect(bounds.y).toBe(0);
        expect(bounds.width).toBe(page.viewportSize()!.width);
        expect(bounds.height).toBe(page.viewportSize()!.height);
        await expect(page.locator('.mobile-main-nav')).toBeHidden();
        await page.screenshot({ path: info.outputPath(`${mode}-principle-editor.png`) });
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await expect(editor).not.toBeVisible();
      }
      if (module === 'future') {
        if (mode === 'web') {
          const content = page.locator('.future-design-content');
          const cards = page.locator('.future-design-summary-card');
          await expect(cards).toHaveCount(3);
          const baseline = (await content.boundingBox())!;
          const baselineCards = await Promise.all([0, 1, 2].map(async (index) => (await cards.nth(index).boundingBox())!));
          expect(baseline.width).toBeGreaterThanOrEqual(900);
          expect(baseline.x).toBeGreaterThanOrEqual(200);
          expect(baseline.x + baseline.width).toBeLessThanOrEqual(1441);
          expect(baselineCards[0].x).toBeLessThan(baselineCards[1].x);
          expect(baselineCards[1].x).toBeLessThan(baselineCards[2].x);
          for (const card of baselineCards) {
            expect(card.width).toBeGreaterThanOrEqual(260);
            expect(card.x).toBeGreaterThanOrEqual(baseline.x);
            expect(card.x + card.width).toBeLessThanOrEqual(baseline.x + baseline.width + 1);
          }

          await page.setViewportSize({ width: 2048, height: 900 });
          await expect(content).toBeVisible();
          const wide = (await content.boundingBox())!;
          const wideCards = await Promise.all([0, 1, 2].map(async (index) => (await cards.nth(index).boundingBox())!));
          // Planning has three peer cards, but it should not become a
          // wall-to-wall dashboard as the viewport grows.  The bounded
          // workspace leaves intentional outer whitespace on wide screens.
          expect(wide.width).toBeGreaterThanOrEqual(1080);
          expect(wide.width).toBeLessThanOrEqual(1200);
          expect(wideCards[0].x).toBeLessThan(wideCards[1].x);
          expect(wideCards[1].x).toBeLessThan(wideCards[2].x);
          for (const card of wideCards) {
            expect(card.width).toBeGreaterThanOrEqual(300);
            expect(card.width).toBeLessThanOrEqual(400);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
        await page.getByRole('button', { name: /^(从愿景开始|编辑未来规划)$/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        if (module === 'future') {
          const bounds = (await page.getByRole('dialog').boundingBox())!;
          expect(bounds.x).toBe(0);
          expect(bounds.y).toBe(0);
          expect(bounds.width).toBe(page.viewportSize()!.width);
          expect(bounds.height).toBe(page.viewportSize()!.height);
        }
        expect(
          await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`${mode}-future-editor.png`) });
      }
      if (module === 'avatar') {
        if (mode === 'web') {
          const pageShell = page.locator('.now-page.avatar-guide-page');
          const controls = page.locator('.avatar-page-controls');
          const content = page.locator('.avatar-chat-content');
          const composer = page.locator('.now-chat-input');
          const baselineShell = (await pageShell.boundingBox())!;
          const baselineControls = (await controls.boundingBox())!;
          const baselineContent = (await content.boundingBox())!;
          const baselineComposer = (await composer.boundingBox())!;
          // The chat shell keeps a readable two-column measure.  Do not pin
          // this to an exact browser rounding outcome at 1440px.
          expect(baselineShell.width).toBeGreaterThanOrEqual(1060);
          expect(baselineShell.width).toBeLessThanOrEqual(1320);
          expect(baselineControls.x + baselineControls.width).toBeLessThanOrEqual(baselineContent.x + 1);
          expect(baselineContent.width).toBeGreaterThanOrEqual(700);
          expect(baselineComposer.width).toBeGreaterThanOrEqual(600);
          expect(baselineComposer.x).toBeGreaterThanOrEqual(baselineContent.x);
          expect(baselineComposer.x + baselineComposer.width).toBeLessThanOrEqual(baselineContent.x + baselineContent.width + 1);

          await page.setViewportSize({ width: 2048, height: 900 });
          await expect(content).toBeVisible();
          const wideShell = (await pageShell.boundingBox())!;
          const wideContent = (await content.boundingBox())!;
          const wideComposer = (await composer.boundingBox())!;
          expect(wideShell.width).toBeGreaterThanOrEqual(1200);
          expect(wideContent.width).toBeGreaterThanOrEqual(1050);
          expect(wideContent.width).toBeLessThanOrEqual(1500);
          expect(wideComposer.width).toBeGreaterThanOrEqual(860);
          expect(wideComposer.x + wideComposer.width).toBeLessThanOrEqual(wideContent.x + wideContent.width + 1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
        const list = page.locator('.now-chat-list');
        const composer = page.locator('.now-chat-input');
        await expect(page.getByText('历史消息 599：', { exact: false })).toBeAttached();
        // Long conversations only mount the most recent window. This keeps
        // typing and scrolling responsive without losing stored history.
        await expect(list.locator('.now-chat-bubble')).toHaveCount(60);
        const earlier = page.getByRole('button', { name: '查看更早消息（540）' });
        await expect(earlier).toBeVisible();
        await earlier.click();
        await expect(page.getByText('历史消息 539：', { exact: false })).toBeAttached();
        await expect(list.locator('.now-chat-bubble')).toHaveCount(120);
        const sizes = await list.evaluate((el) => ({
          height: el.clientHeight,
          total: el.scrollHeight,
        }));
        expect(sizes.height).toBeGreaterThan(80);
        expect(sizes.total).toBeGreaterThan(sizes.height * 2);
        const before = await composer.boundingBox();
        expect(before!.y + before!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        await list.evaluate((el) => {
          el.scrollTop = 0;
        });
        await expect(page.getByText('历史消息 480：', { exact: false })).toBeInViewport();
        await list.hover();
        await page.mouse.wheel(0, 500);
        await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        await list.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await expect(page.getByText('历史消息 599：', { exact: false })).toBeInViewport();
        expect((await composer.boundingBox())!.y).toBeCloseTo(before!.y, 0);

        // Resizing must keep the composer visible and history independently scrollable.
        for (const viewport of mode === 'web'
          ? [
              { width: 1280, height: 720 },
              { width: 1024, height: 600 },
            ]
          : [
              { width: 320, height: 568 },
              { width: 430, height: 932 },
              { width: 844, height: 390 },
            ]) {
          await page.setViewportSize(viewport);
          await expect
            .poll(async () => {
              const box = await composer.boundingBox();
              return box!.y >= 0 && box!.y + box!.height <= viewport.height;
            })
            .toBe(true);
          expect(
            await list.evaluate((el) => el.clientHeight > 40 && el.scrollHeight > el.clientHeight),
          ).toBe(true);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await list.evaluate((el) => {
            el.scrollTop = 0;
          });
          await expect(page.getByText('历史消息 480：', { exact: false })).toBeInViewport();
        }
        await page.setViewportSize(
          mode === 'web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
        );

        await page.getByRole('button', { name: '记忆档案', exact: true }).click();
        const cards = page.locator('.avatar-library__dimension-card');
        await expect(cards.first()).toBeVisible();
        const first = await cards.nth(0).boundingBox();
        const second = await cards.nth(1).boundingBox();
        expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
        await page.screenshot({ path: info.outputPath(`${mode}-archive.png`) });
        await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(
          await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`${mode}-settings.png`) });
      }
      expect(errors).toEqual([]);
    });
  }
}
