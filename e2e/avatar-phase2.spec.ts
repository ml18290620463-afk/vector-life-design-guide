import { expect, test } from '@playwright/test';
import { resetPersistentAppState } from './seedHelpers';

test('capture network payload respects quota and user exclusions after v2 permission filtering', async ({
  page,
}) => {
  const payloads: Array<{ memories: Array<{ id: string; text: string }>; messages: unknown[] }> =
    [];
  await page.route('**/api/v1/avatar/chat', async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: '已收到' } });
  });
  await resetPersistentAppState(page);
  await page.getByTestId('cover-initialize').click();
  await page.evaluate(async () => {
    const privacyPath = '/services/aiPrivacy.ts';
    const apiPath = '/features/now/api/avatar.ts';
    const sourcePath = '/services/avatarGuidanceSources.ts';
    const ontologyPath = '/services/avatarOntologyStore.ts';
    const vaultPath = '/services/vaultTransaction.ts';
    const keysPath = '/services/diaryStorage.ts';
    const { readAIPrivacy } = await import(/* @vite-ignore */ privacyPath);
    const { chatWithAvatar } = await import(/* @vite-ignore */ apiPath);
    const { buildGuidanceSources } = await import(/* @vite-ignore */ sourcePath);
    const { initializeAvatarOntology } = await import(/* @vite-ignore */ ontologyPath);
    const { rawVaultTransaction } = await import(/* @vite-ignore */ vaultPath);
    const { DiaryStorageKeys: keys } = await import(/* @vite-ignore */ keysPath);
    const entries = Array.from({ length: 8 }, (_, i) => ({
      id: `phase2-${i}`,
      title: `记录${i}`,
      content: `CAPTURE_SOURCE_${i}`,
      aiVisibility: 'allowed',
      tags: [],
      createdAt: Date.now() - i * 86400000,
    }));
    await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
      values[keys.entries] = entries;
    });
    const graph = await initializeAvatarOntology();
    const sources = buildGuidanceSources({ entries, principles: [], actions: [], graph });
    const { token } = await readAIPrivacy();
    const messages = [
      {
        id: 'query',
        role: 'user',
        type: 'text',
        content: '帮我记录今天的工作',
        created_at: new Date().toISOString(),
        aiPrivacyToken: token,
      },
    ];
    await chatWithAvatar(messages, sources, undefined, { mode: 'capture' });
    await chatWithAvatar(messages, sources, undefined, {
      mode: 'capture',
      excludedIds: [sources[0].id],
    });
  });
  expect(payloads).toHaveLength(2);
  expect(payloads[0].memories).toHaveLength(3);
  expect(payloads[1].memories).toHaveLength(3);
  expect(payloads[1].memories.map((s) => s.id)).not.toContain(payloads[0].memories[0].id);
  expect(JSON.stringify(payloads[1])).not.toContain('CAPTURE_SOURCE_0');
});

for (const boundary of ['lock', 'revoke'] as const) {
  test(`${boundary} aborts before the provider responds`, async ({ page }) => {
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received!: () => void;
    const requestReceived = new Promise<void>((resolve) => {
      received = resolve;
    });
    await page.route('**/api/v1/avatar/chat', async (route) => {
      received();
      await responseGate;
      await route.fulfill({ json: { reply: 'STALE_RESPONSE' } }).catch(() => {});
    });
    await resetPersistentAppState(page);
    await page.getByTestId('cover-initialize').click();
    await page
      .getByRole('navigation', { name: '主页面导航' })
      .getByRole('button', { name: /^现在/ })
      .click();
    await expect(page.getByTestId('now-page')).toBeVisible();
    const outcome = page.evaluate(async () => {
      const privacyPath = '/services/aiPrivacy.ts';
      const apiPath = '/features/now/api/avatar.ts';
      const vaultPath = '/services/vaultTransaction.ts';
      const keysPath = '/services/diaryStorage.ts';
      const { readAIPrivacy } = await import(/* @vite-ignore */ privacyPath);
      const { chatWithAvatar } = await import(/* @vite-ignore */ apiPath);
      const { rawVaultTransaction } = await import(/* @vite-ignore */ vaultPath);
      const { DiaryStorageKeys: keys } = await import(/* @vite-ignore */ keysPath);
      await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
        values[keys.entries] = [
          {
            id: 'source',
            title: '',
            tags: [],
            content: 'Authorized source',
            createdAt: 1,
            aiVisibility: 'allowed',
          },
        ];
      });
      const { token } = await readAIPrivacy();
      try {
        await chatWithAvatar(
          [
            {
              id: 'question',
              role: 'user',
              type: 'text',
              content: 'Question',
              created_at: new Date().toISOString(),
              aiPrivacyToken: token,
            },
          ],
          [],
        );
        return 'accepted';
      } catch {
        return 'rejected';
      }
    });
    await requestReceived;
    await page.evaluate(async (boundary) => {
      if (boundary === 'lock') {
        const storePath = '/stores/appStore.ts';
        const { useAppStore } = await import(/* @vite-ignore */ storePath);
        useAppStore.setState({ isUnlocked: false, masterPassword: null });
        return;
      }
      const vaultPath = '/services/vaultTransaction.ts';
      const keysPath = '/services/diaryStorage.ts';
      const { rawVaultTransaction } = await import(/* @vite-ignore */ vaultPath);
      const { DiaryStorageKeys: keys } = await import(/* @vite-ignore */ keysPath);
      await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
        values[keys.entries] = [];
      });
    }, boundary);
    try {
      expect(
        await Promise.race([
          outcome,
          new Promise((resolve) => setTimeout(() => resolve('still-pending'), 3000)),
        ]),
      ).toBe('rejected');
    } finally {
      release();
    }
  });
}
