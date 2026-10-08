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

for (const width of [320, 393, 1280]) {
  test(`minimal memory archive at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 852 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/__avatar-spec', (route) =>
      route.fulfill({ contentType: 'text/html', body: harness }),
    );
    await page.goto('/__avatar-spec');
    await page.getByRole('button', { name: '记忆档案', exact: true }).click();
    for (const name of ['关于我', '我的模式', '我的变化']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('重要选择先留出思考时间')).toHaveCount(0);
    await expect(page.getByText('管理标签')).toHaveCount(0);
    await page.getByRole('button', { name: '新增记忆' }).click();
    await page.getByRole('textbox', { name: '提炼的信息' }).fill('我倾向使用简短直接的语句');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: '确认记住', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '我倾向使用简短直接的语句' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('archive.png') });
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await page.getByRole('button', { name: '我倾向使用简短直接的语句' }).click();
    await page.getByRole('button', { name: '需要调整', exact: true }).click();
    await page.getByRole('textbox', { name: '记忆内容' }).fill('我喜欢直接表达');
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(page.getByRole('button', { name: '保存修改' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('archive-edit-landscape.png') });
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByRole('button', { name: '我的变化', exact: true }).click();
    await page.getByRole('button', { name: /^认识更新/ }).click();
    await expect(page.getByRole('article')).toContainText('此前我倾向使用简短直接的语句');
    await expect(page.getByRole('article')).toContainText('现在我喜欢直接表达');
    await page.getByRole('button', { name: '关于我', exact: true }).click();
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await page.getByRole('button', { name: '我喜欢直接表达' }).click();
    await page.getByRole('button', { name: '需要调整', exact: true }).click();
    await page.getByRole('textbox', { name: '记忆内容' }).fill('我喜欢清晰直接地表达');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.getByRole('button', { name: '我喜欢清晰直接地表达' }).click();
    await page.getByRole('button', { name: '暂不采用', exact: true }).click();
    await expect(page.getByRole('heading', { name: '暂不采用这条理解？' })).toBeVisible();
    await page.getByRole('button', { name: '暂不采用', exact: true }).click();
    await expect(page.getByRole('button', { name: '我喜欢清晰直接地表达' })).toHaveCount(0);
    const memories = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vector:avatar:atomic-memories:v1') || '[]'),
    );
    expect(memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statement: '我喜欢清晰直接地表达',
          status: 'rejected',
          sourceRefs: [],
        }),
      ]),
    );
  });
}
