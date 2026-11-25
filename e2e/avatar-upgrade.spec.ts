import type { AvatarOntologySnapshot } from '../services/avatarOntologyStore';
import { AVATAR_V1_KEYS } from '../services/avatarOntologyMigration';
import { expect, test, type Page } from '@playwright/test';
import { resetPersistentAppState } from './seedHelpers';

test.beforeEach(async ({ context, baseURL, page }) => {
  await context.grantPermissions(['local-network-access'], { origin: baseURL! });
  page.on('pageerror', (error) => console.error('Avatar fixture page error:', error.message));
});

const original = JSON.stringify([
  {
    id: 'old',
    statement: '喜欢安静的环境',
    nature: 'explicit',
    facets: ['preference'],
    tags: [],
    contexts: [],
    sourceRefs: [{ source: 'message', id: 'm1', sessionId: 's1', excerpt: '喜欢安静' }],
    confidence: 0.8,
    status: 'confirmed',
    createdAt: Date.UTC(2026, 0, 1),
    confirmedAt: Date.UTC(2026, 0, 1),
    confirmedBy: 'user',
  },
]);
async function openBoundary(page: Page, mode: 'new' | 'legacy' | 'locked') {
  await page.route('**/__avatar-upgrade', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React}=await import('/node_modules/.vite/deps/react.js');
    const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AvatarUpgradeBoundary}=await import('/features/now/components/AvatarUpgradeBoundary.tsx');
    const {useAppStore}=await import('/stores/appStore.ts');
    const {set,get}=await import('/node_modules/.vite/deps/idb-keyval.js');
    const {DiaryStorageKeys:K}=await import('/services/diaryStorage.ts');
    const {SecurityService}=await import('/services/securityService.ts');
    const {AVATAR_V1_KEYS}=await import('/services/avatarOntologyMigration.ts');
    const keys=await import('/services/avatarOntologyKey.ts');
    const repo=await import('/services/avatarOntologyStore.ts');
    window.inspect=async()=>({graph:await get(keys.AVATAR_ONTOLOGY_KEY),snapshot:await get(keys.AVATAR_MIGRATION_SNAPSHOT_KEY),original:localStorage.getItem(AVATAR_V1_KEYS.atoms),mounted:window.mounted||0});
    window.readGraph=()=>repo.readAvatarOntology();
    if (${JSON.stringify(mode)}!=='new') localStorage.setItem(AVATAR_V1_KEYS.atoms,${JSON.stringify(original)});
    const save=async(password)=>{const salt='browser-phase-one';await set(K.passwordHash,await SecurityService.hashPassword(password,salt));await set(K.passwordSalt,salt);useAppStore.setState({masterPassword:password,isUnlocked:true});};
    useAppStore.setState({masterPassword:null,isUnlocked:true});
    if (${JSON.stringify(mode)}==='locked'){await save('Phase1-private-123!');useAppStore.setState({masterPassword:null,isUnlocked:false});}
    function Consumer(){React.useEffect(()=>{window.mounted=(window.mounted||0)+1},[]);return React.createElement('p',null,'分身已恢复');}
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AvatarUpgradeBoundary,{language:'zh',onBack:()=>{},onSetPassword:save,onUnlock:()=>save('Phase1-private-123!')},React.createElement(Consumer)));
  </script></body></html>`,
    }),
  );
  await page.goto('/__avatar-upgrade');
}
const inspect = (page: Page) =>
  page.evaluate('window.inspect()') as Promise<{
    graph?: { format?: string; ontologySchemaVersion?: number; objects?: unknown[] };
    snapshot?: { format?: string };
    original: string | null;
    mounted: number;
  }>;

test('legacy account upgrades through the real app navigation and returns to avatar', async ({ page }) => {
  test.setTimeout(120000);
  await resetPersistentAppState(page);
  await page.getByTestId('cover-initialize').click();
  await page.getByRole('navigation', { name: '主页面导航' }).waitFor({ state: 'visible' });
  await page.evaluate(({ legacy, key }) => {
    localStorage.setItem(key, legacy);
  }, { legacy: original, key: AVATAR_V1_KEYS.atoms });
  await page.getByRole('navigation', { name: '主页面导航' }).getByRole('button', { name: /^分身/ }).click();
  await expect(page.getByRole('button', { name: '设置密码并升级' })).toBeVisible();
  await page.getByRole('button', { name: '设置密码并升级' }).click();
  await page.getByTestId('onboarding-password').fill('Phase1-private-123!');
  await page.getByTestId('onboarding-password-confirm').fill('Phase1-private-123!');
  await page.getByTestId('onboarding-protect').click();
  await expect(page.getByRole('navigation', { name: '记忆分身导航' })).toBeVisible({ timeout: 30000 });
});

test('passwordless new account initializes one empty v2 graph', async ({ page }) => {
  await openBoundary(page, 'new');
  await expect(page.getByText('分身已恢复', { exact: true })).toBeVisible();
  const state = await inspect(page);
  expect(state.graph).toMatchObject({ ontologySchemaVersion: 2, objects: [], edges: [] });
  expect(state.original).toBeNull();
  expect(state.snapshot).toBeUndefined();
  expect(state.mounted).toBe(1);
});
test('legacy account pauses consumers and upgrades through password CTA', async ({ page }) => {
  await openBoundary(page, 'legacy');
  await expect(page.getByRole('button', { name: '设置密码并升级' })).toBeVisible();
  expect(await inspect(page)).toEqual({ original, mounted: 0 });
  await page.getByRole('button', { name: '设置密码并升级' }).click();
  await page.getByTestId('onboarding-password').fill('Phase1-private-123!');
  await page.getByTestId('onboarding-password-confirm').fill('Phase1-private-123!');
  await page.getByTestId('onboarding-protect').click();
  await expect(page.getByText('分身已恢复', { exact: true })).toBeVisible({ timeout: 30000 });
  const state = await inspect(page);
  expect(state.original).toBe(original);
  expect(state.graph).toMatchObject({ format: 'vector-private-v1' });
  expect(state.snapshot).toMatchObject({
    type: 'vector-encrypted-vault-backup',
    cipher: 'AES-256-GCM',
  });
  expect(JSON.stringify(state.graph)).not.toContain('喜欢安静');
  expect(JSON.stringify(state.snapshot)).not.toContain('喜欢安静');
  const graph = await page.evaluate<AvatarOntologySnapshot>('window.readGraph()');
  expect(graph.objects).toHaveLength(1);
  expect(graph.objects[0]).toMatchObject({
    status: 'candidate',
    privacy: { aiVisible: false },
    evidenceGate: { isReadyForConfirmation: false },
  });
  expect(graph.objects[0].migration.legacyConfirmedAt).toBeTruthy();
  expect(graph.edges.filter((edge: { type: string }) => edge.type === 'EVIDENCED_BY')).toHaveLength(
    0,
  );
});
test('locked legacy account cannot mount consumers or commit migration before unlock', async ({
  page,
}) => {
  await openBoundary(page, 'locked');
  await expect(page.getByRole('heading', { name: '请先解锁资料库' })).toBeVisible();
  expect(await inspect(page)).toEqual({ original, mounted: 0 });
  await page.getByRole('button', { name: '解锁资料库', exact: true }).click();
  await expect(page.getByText('分身已恢复', { exact: true })).toBeVisible({ timeout: 30000 });
  expect((await inspect(page)).graph).toMatchObject({ format: 'vector-private-v1' });
});
