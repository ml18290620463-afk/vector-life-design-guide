import { expect, test } from '@playwright/test';
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

test('user chooses a model in the mobile chat settings', async ({ page }, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('**/__avatar-spec', (route) =>
    route.fulfill({ contentType: 'text/html', body: harness }),
  );
  await page.route('**/api/v1/avatar/model/test', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/v1/avatar/model/list', (route) =>
    route.fulfill({ json: { models: ['gpt-4.1', 'deepseek-chat'] } }),
  );
  await page.goto('/__avatar-spec');
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('API Key', { exact: true }).fill('test-placeholder');
  await page.getByLabel('模型', { exact: true }).selectOption('gpt-4.1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('model-settings.png') });
  await page.getByRole('button', { name: '验证并保存' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('gpt-4.1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('invalid model settings are highlighted inline', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('**/__avatar-spec', (route) =>
    route.fulfill({ contentType: 'text/html', body: harness }),
  );
  await page.route('**/api/v1/avatar/model/list', (route) =>
    route.fulfill({ json: { models: ['gpt-4.1', 'deepseek-chat'] } }),
  );
  await page.goto('/__avatar-spec');
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await page.getByRole('button', { name: '验证并保存' }).click();
  await expect(page.getByText('请填写 API Key。')).toBeVisible();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('模型 ID')).toHaveCount(0);
});

test('custom model input keeps the provider and key on a small screen', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/__avatar-spec', (route) =>
    route.fulfill({ contentType: 'text/html', body: harness }),
  );
  let submitted: Record<string, string> | undefined;
  await page.route('**/api/v1/avatar/model/test', (route) => {
    submitted = route.request().postDataJSON().modelConfig;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/v1/avatar/model/list', (route) =>
    route.fulfill({ json: { models: ['gpt-4.1', 'deepseek-chat'] } }),
  );
  await page.goto('/__avatar-spec');
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await page.getByLabel('服务商', { exact: true }).selectOption('1');
  await page.getByLabel('API Key', { exact: true }).fill('test-deepseek-key');
  await page.getByRole('button', { name: '手动输入', exact: true }).click();
  await page.getByLabel('模型名称').fill('my-account-model');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('test-deepseek-key');
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath('custom-model-mobile.png') });
  await page.setViewportSize({ width: 812, height: 375 });
  await page.getByRole('button', { name: '验证并保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(submitted).toMatchObject({
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'test-deepseek-key',
    model: 'my-account-model',
  });
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await expect(page.getByLabel('模型名称')).toHaveValue('my-account-model');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('test-deepseek-key');
});

for (const width of [375, 768, 1440]) {
  test(`avatar workspace adapts navigation and drawers at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/__avatar-spec', (route) =>
      route.fulfill({ contentType: 'text/html', body: harness }),
    );
    await page.goto('/__avatar-spec');
    const navigation = page.getByRole('navigation', { name: '记忆分身导航' });
    const composer = page.getByLabel('对话内容', { exact: true });
    await expect(composer).toBeVisible();
    const navBox = (await navigation.boundingBox())!;
    const composerBox = (await composer.boundingBox())!;
    expect(navBox.y + navBox.height).toBeLessThan(composerBox.y);
    expect(composerBox.y + composerBox.height).toBeLessThan(900 - 70);
    await page.screenshot({ path: info.outputPath(`chat-${width}.png`) });
    await page.getByRole('button', { name: '记忆档案', exact: true }).click();
    const cards = page.locator('.avatar-library__dimension-card');
    await expect(cards).toHaveCount(4);
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    expect(first.x).toBe(second.x);
    expect(first.width).toBeGreaterThan(280);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`archive-${width}.png`) });
    await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const box = (await page.getByRole('dialog').boundingBox())!;
    if (width < 600) expect(Math.round(box.y + box.height)).toBe(900);
    else expect(box.width).toBeLessThanOrEqual(480);
  });
}

for (const [width, height] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [568, 320],
  [844, 390],
  [1024, 768],
]) {
  test(`avatar mobile viewport ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/__avatar-spec', (route) =>
      route.fulfill({ contentType: 'text/html', body: harness }),
    );
    await page.goto('/__avatar-spec');
    const composer = page.getByLabel('对话内容', { exact: true });
    await expect(composer).toBeVisible();
    const shell = (await page.locator('.mobile-shell').boundingBox())!;
    const nav = (await page.getByRole('navigation', { name: '主页面导航' }).boundingBox())!;
    const input = (await composer.boundingBox())!;
    expect(Math.abs(nav.width - shell.width)).toBeLessThan(2);
    expect(Math.abs(nav.x - shell.x)).toBeLessThan(2);
    expect(nav.y + nav.height).toBeLessThanOrEqual(height + 1);
    expect(input.y + input.height).toBeLessThanOrEqual(nav.y);
    expect(input.width).toBeGreaterThan(100);
    const settings = page.getByRole('button', { name: '打开分身设置', exact: true });
    await expect(settings.locator('span')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('chat.png') });
    await page.getByRole('button', { name: '记忆档案', exact: true }).click();
    const cards = page.locator('.avatar-library__dimension-card');
    await expect(cards).toHaveCount(4);
    await cards.last().scrollIntoViewIfNeeded();
    const card = (await cards.last().boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(nav.y + 1);
    await settings.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('API Key', { exact: true }).fill('mobile-layout-placeholder');
    await page.getByRole('button', { name: '验证并保存', exact: true }).scrollIntoViewIfNeeded();
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '聊天', exact: true }).click();
    await composer.fill('输入时保持可见');
    await page.setViewportSize({ width, height: Math.max(300, height - 260) });
    await expect(composer).toHaveValue('输入时保持可见');
    const resizedInput = (await composer.boundingBox())!;
    const resizedNav = (await page.locator('.mobile-main-nav').boundingBox())!;
    expect(resizedInput.y + resizedInput.height).toBeLessThanOrEqual(resizedNav.y);
  });
}

const modelFailureCases = [
  {
    name: '授权失败会保留配置并聚焦 API Key',
    response: { status: 401, json: { error: 'model_auth_failed' } },
    message: 'API Key 无效、已过期，或没有调用这个模型的权限。',
    field: 'API Key',
  },
  {
    name: '额度不足会保留配置并给出账户恢复路径',
    response: { status: 429, json: { error: 'model_rate_limited' } },
    message: '模型服务额度不足或请求过于频繁，请检查账户后重试。',
    field: undefined,
  },
  {
    name: '结算未开通会保留配置',
    response: { status: 402, json: { error: 'model_billing_required' } },
    message: '当前模型需要开通 API 结算或额度。请到服务商账户完成设置后重试。',
    field: undefined,
  },
  {
    name: '模型不可用会保留模型选择并聚焦模型',
    response: { status: 404, json: { error: 'model_not_found' } },
    message:
      '该模型不存在、已停止向当前账号开放，或不支持当前接口。请根据服务商返回的信息更换模型，也可获取模型列表核对。',
    field: '模型',
  },
  {
    name: '接口地址不存在会聚焦地址',
    response: { status: 404, json: { error: 'model_endpoint_not_found' } },
    message: '服务商返回接口不存在（404），尚不能判断模型权限。请检查 API 地址和接口类型。',
    field: '高级设置',
  },
] as const;

for (const failure of modelFailureCases) {
  test(`模型验证：${failure.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.route('**/__avatar-spec', (route) =>
      route.fulfill({ contentType: 'text/html', body: harness }),
    );
    await page.route('**/api/v1/avatar/model/test', (route) => route.fulfill(failure.response));
    await page.goto('/__avatar-spec');
    await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
    await page.getByLabel('API Key', { exact: true }).fill('still-here-key');
    await page.getByLabel('模型', { exact: true }).selectOption('gpt-4.1');
    await page.getByRole('button', { name: '验证并保存', exact: true }).click();

    await expect(page.locator('.avatar-model-alert')).toHaveText(failure.message);
    await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('still-here-key');
    await expect(page.getByLabel('模型', { exact: true })).toHaveValue('gpt-4.1');
    if (failure.field === 'API Key') {
      await expect(page.getByLabel('API Key', { exact: true })).toBeFocused();
      await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    }
    if (failure.field === '模型') {
      await expect(page.getByLabel('模型', { exact: true })).toBeFocused();
      await expect(page.getByLabel('模型', { exact: true })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    }
    if (failure.field === '高级设置') {
      await expect(page.getByRole('button', { name: '收起高级设置' })).toBeFocused();
      await expect(page.getByLabel('API 地址')).toBeVisible();
      await expect(page.getByLabel('API 地址')).toHaveAttribute('aria-invalid', 'true');
    }
  });
}

test('模型验证网络失败不会清空已填写内容', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('**/__avatar-spec', (route) =>
    route.fulfill({ contentType: 'text/html', body: harness }),
  );
  await page.route('**/api/v1/avatar/model/test', (route) => route.abort('failed'));
  await page.goto('/__avatar-spec');
  await page.getByRole('button', { name: '打开分身设置', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).fill('network-draft-key');
  await page.getByRole('button', { name: '验证并保存', exact: true }).click();
  await expect(page.locator('.avatar-model-alert')).toHaveText(
    '自动连接未成功，请稍后重试。已保存的设置无需重填。',
  );
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('network-draft-key');
});
