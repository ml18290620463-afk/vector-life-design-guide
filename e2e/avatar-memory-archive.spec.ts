import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, baseURL, page }) => {
  await context.grantPermissions(['local-network-access'], { origin: baseURL! });
  page.on('pageerror', (error) => console.error('Avatar fixture page error:', error.message));
});
const harness = `<!doctype html><html lang="zh-CN" class="vector-force-mobile">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avatar integration</title><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"></head>
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
    await page.route('**/api/v1/avatar/chat', (route) =>
      route.fulfill({ json: { reply: '好的。' } }),
    );
    await page.route('**/api/v1/avatar/memory/extract', (route) => {
      const { messages } = route.request().postDataJSON() as {
        messages: { role: string; content: string }[];
      };
      const index = messages.findLastIndex((message) => message.role === 'user');
      return route.fulfill({
        json: {
          candidate: {
            statement: messages[index].content,
            kind: 'expression',
            sourceIndexes: [index],
            evidences: [messages[index].content],
          },
        },
      });
    });
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'vector.avatar.model.session.v1',
        JSON.stringify({
          baseUrl: 'https://api.example.test/v1',
          apiKey: 'test-key',
          model: 'test-model',
          endpoint: 'chat',
        }),
      ),
    );
    await page.goto('/__avatar-spec');
    await page.getByRole('button', { name: '记忆库', exact: true }).click();
    for (const name of ['关于我', '我的认识', '我的变化']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('重要选择先留出思考时间')).toHaveCount(0);
    await expect(page.getByText('管理标签')).toHaveCount(0);
    await page.getByLabel('返回聊天', { exact: true }).click();
    await page.getByLabel('对话内容', { exact: true }).fill('用户倾向使用简短直接的语句');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByText('好的。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '提炼记忆', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '提炼的信息' })).toHaveValue(
      '用户倾向使用简短直接的语句',
    );
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: '确认记住', exact: true }).click();
    await page.getByRole('button', { name: /^仅自己可见/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '记忆库', exact: true }).click();
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await expect(page.getByRole('button', { name: '我倾向使用简短直接的语句' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('archive.png') });
    await page.getByRole('button', { name: '我的变化', exact: true }).click();
    await expect(page.getByText('尚无已确认的观点修订。')).toBeVisible();
    await expect(page.getByRole('button', { name: /新增|添加/ })).toHaveCount(0);
    await page.getByRole('button', { name: '关于我', exact: true }).click();
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await page.getByRole('button', { name: '我倾向使用简短直接的语句' }).click();
    await page.getByRole('button', { name: '调整表述', exact: true }).click();
    await page.getByRole('textbox', { name: '记忆内容' }).fill('用户喜欢直接表达');
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(page.getByRole('button', { name: '保存修改' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('archive-edit-landscape.png') });
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByRole('button', { name: '确认记住', exact: true }).click();
    await page.getByRole('button', { name: /^仅自己可见/ }).click();
    await page.getByRole('button', { name: '记忆库', exact: true }).click();
    await page.getByRole('button', { name: '我的变化', exact: true }).click();
    const revisions = page.getByRole('region', { name: '已确认的变化' });
    await expect(
      revisions.getByText('仅展示你确认过的观点修订，不代表已经证明的成长。'),
    ).toBeVisible();
    await expect(revisions.getByText('此前看法')).toBeVisible();
    await expect(revisions.getByText('用户倾向使用简短直接的语句')).toBeVisible();
    await expect(revisions.getByText('最新认识')).toBeVisible();
    await expect(revisions.getByText('用户喜欢直接表达')).toBeVisible();
    await expect(page.getByRole('button', { name: /新增|添加/ })).toHaveCount(0);
    await page.getByRole('button', { name: '关于我', exact: true }).click();
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await page.getByRole('button', { name: '我喜欢直接表达' }).click();
    await page.getByRole('button', { name: '调整表述', exact: true }).click();
    await page.getByRole('textbox', { name: '记忆内容' }).fill('用户喜欢清晰直接地表达');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.getByRole('button', { name: '确认记住', exact: true }).click();
    await page.getByRole('button', { name: /^仅自己可见/ }).click();
    await page.getByRole('button', { name: '记忆库', exact: true }).click();
    await page.getByRole('button', { name: /^偏好与边界/ }).click();
    await page.getByRole('button', { name: '我喜欢清晰直接地表达' }).click();
    await page.getByRole('button', { name: '暂不采用', exact: true }).click();
    await expect(page.getByRole('heading', { name: '暂不采用这条理解？' })).toBeVisible();
    await page.getByRole('button', { name: '暂不采用', exact: true }).click();
    await expect(page.getByRole('button', { name: '我喜欢清晰直接地表达' })).toHaveCount(0);
    const graph = await page.evaluate(async () => {
      const path = '/services/avatarOntologyStore.ts';
      return (await import(/* @vite-ignore */ path)).readAvatarOntology();
    });
    expect(graph.ontologySchemaVersion).toBe(2);
    expect(graph.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statement: '用户喜欢清晰直接地表达', status: 'rejected' }),
      ]),
    );
    expect(
      await page.evaluate(() => localStorage.getItem('vector:avatar:atomic-memories:v1')),
    ).toBeNull();
  });
}
