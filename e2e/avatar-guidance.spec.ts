import { expect, test } from '@playwright/test';

const harness = `<!doctype html><html lang="zh-CN" class="vector-force-mobile">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avatar integration</title><link rel="stylesheet" href="/index.css"></head>
<body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;
window.__vite_plugin_react_preamble_installed__=true;
const {default:React}=await import('/node_modules/.vite/deps/react.js');
const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
const {AvatarChatPage}=await import('/features/now/components/AvatarChatPage.tsx');
const {MobileShell}=await import('/features/mobile/MobileShell.tsx');
const noop=()=>{};
ReactDOM.createRoot(document.getElementById('root')).render(
React.createElement(MobileShell,{activeTab:'avatar',language:'zh',onTabChange:noop},
React.createElement('div',{className:'now-flow--mobile-shell'},
React.createElement(AvatarChatPage,{
 draft:{text:'',materials:[],mood_tags:[],event_tags:[],record_time:'2026-09-15',display_time:'2026年9月15日',updated_at:'2026-09-15'},
 setDraft:noop,pastEntries:[],principles:[{id:'p1',text:'重要选择先留出思考时间',year:2026,createdAt:1,showOnHome:false}],
 actions:[{id:'a1',title:'今晚留出十分钟复盘',status:'active',createdAt:1}],
 sending:false,mobileShell:true,onBack:noop,onRouteChange:noop,onSend:async()=>true,showToast:noop,
 onNavigateModule:(module)=>{document.body.dataset.destination=module},
 launchContext:{mode:'general',source:'global'}
}))));
</script></body></html>`;

for (const width of [320, 393, 440]) {
  test(`Avatar chat and memory archive fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 852 });
    await page.route('**/__avatar-spec', (route) =>
      route.fulfill({ contentType: 'text/html', body: harness }),
    );
    await page.goto('/__avatar-spec');

    await expect(page.getByTestId('avatar-assist-page')).toBeVisible();
    await expect(page.getByRole('tablist', { name: '记忆分身导航' })).toBeVisible();
    await expect(page.getByRole('region', { name: '对话记录' })).toBeVisible();
    const chatRegion = page.getByRole('region', { name: '对话记录' });
    expect((await chatRegion.boundingBox())?.height).toBeGreaterThan(100);
    const visibleSidebars = await page.locator('.desktop-main-nav:visible, .avatar-side-nav:visible').count();
    expect(visibleSidebars).toBe(0);
    const input = page.getByRole('textbox', { name: '对话内容' });
    await expect(input).toBeInViewport();
    const inputBounds = await input.boundingBox();
    const bottomNavBounds = await page.locator('.mobile-main-nav').boundingBox();
    expect(inputBounds && bottomNavBounds && inputBounds.y + inputBounds.height <= bottomNavBounds.y, JSON.stringify({ inputBounds, bottomNavBounds })).toBe(true);
    await input.focus();
    await expect(input).toBeInViewport();
    const focusedBox = await input.boundingBox();
    expect(focusedBox && focusedBox.x >= 0 && focusedBox.x + focusedBox.width <= width).toBe(true);
    expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const sendBounds = await page.getByRole('button', { name: '发送', exact: true }).boundingBox();
    expect(sendBounds?.width).toBeGreaterThanOrEqual(44);
    expect(sendBounds?.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('canvas:visible').count()).toBe(0);
    await expect(page.locator('.now-chat-list')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await input.fill('我想记录一个新的发现');
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('avatar-chat.png') });

    await page.getByRole('tab', { name: '记忆档案', exact: true }).click();
    for (const name of ['关于我', '我的认识', '我的变化']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '新增记忆' })).toBeVisible();
    const archive = await page.getByRole('button', { name: '关于我', exact: true }).boundingBox();
    const insight = await page.getByRole('button', { name: '我的认识', exact: true }).boundingBox();
    expect(archive && insight && archive.x + archive.width + 2 <= insight.x).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('avatar-library.png') });
  });
}
