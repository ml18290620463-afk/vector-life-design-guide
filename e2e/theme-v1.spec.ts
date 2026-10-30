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
          body: `<!doctype html><html class="vector-force-${mode} ${mode === 'mobile' ? 'mobile-product-active' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"><link rel="stylesheet" href="/styles/theme-v1.css"></head><body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
        const {default:React}=await import('/node_modules/.vite/deps/react.js');
        const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
        const {MobileShell}=await import('/features/mobile/MobileShell.tsx');
        const {AppPageFrame}=await import('/components/AppPageFrame.tsx');
        const {${{ past: 'PastRepository', now: 'NowPage', future: 'FuturePage', avatar: 'AvatarChatPage' }[module]}:Module}=await import('${{ past: '/features/mobile/PastRepository.tsx', now: '/features/now/components/NowPage.tsx', future: '/features/future/FuturePage.tsx', avatar: '/features/now/components/AvatarChatPage.tsx' }[module]}');
        const noop=()=>{};
        const common={language:'zh',theme:'dark',entries:[],pastEntries:[],principles:[],actions:[],onSelectEntry:noop,onAddPrinciple:noop,onDeletePrinciple:noop,onUpdatePrinciple:noop,onDeleteEntries:noop,draft:{text:'${module === 'now' ? '一段尚未完成的想法，留在这里继续写下去。' : ''}',materials:[],mood_tags:[],event_tags:[],record_time:'2026-09-22',display_time:'2026年9月22日',updated_at:'2026-09-22'},setDraft:noop,sending:false,onSend:async()=>true,onSaveDraft:noop,onDiscardDraft:noop,onExit:noop,onBack:noop,onRouteChange:noop,showToast:noop,mobileShell:${mode === 'mobile'},onNavigateModule:noop,launchContext:{mode:'general',source:'global'}};
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
      if (module === 'now') {
        await expect(page.locator('#now-record-text')).toHaveCSS('font-size', '17px');
        await expect(page.locator('#now-record-text')).toHaveCSS('font-weight', '400');
        await expect(page.locator('#now-record-text')).toHaveCSS('line-height', '30.6px');
      }
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
        const editor = (await page.locator('.now-editor textarea').boundingBox())!;
        expect(card.width).toBeGreaterThanOrEqual(900);
        expect(card.width).toBeLessThanOrEqual(1120);
        expect(card.x).toBeGreaterThanOrEqual(160);
        expect(card.x + card.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        // A restored draft is a continuation surface, so it has more writing
        // room than the short, first-use empty state.
        expect(card.height).toBeGreaterThanOrEqual(680);
        expect(editor.height).toBeGreaterThanOrEqual(440);

        await page.setViewportSize({ width: 2048, height: 900 });
        await expect(page.locator('.now-card')).toBeVisible();
        const wideCard = (await page.locator('.now-card').boundingBox())!;
        expect(wideCard.width).toBeGreaterThanOrEqual(980);
        expect(wideCard.width).toBeLessThanOrEqual(1120);
        expect(wideCard.x).toBeGreaterThanOrEqual(320);
        expect(wideCard.x + wideCard.width).toBeLessThanOrEqual(2049);
      }
      await page.screenshot({ path: info.outputPath(`${mode}-${module}.png`) });
      expect(
        await page
          .locator('html')
          .evaluate((el) => getComputedStyle(el).getPropertyValue('--vector-page').trim()),
      ).toBe('#10171d');
      expect(errors).toEqual([]);
    });
  }
}
