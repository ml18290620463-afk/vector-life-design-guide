import { test, expect } from '@playwright/test';
import { resetPersistentAppState } from './seedHelpers';

test('real browser request excludes private, sealed, deleted and revoked references', async ({
  page,
}) => {
  const bodies: string[] = [];
  await page.route('**/api/v1/avatar/chat', async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.fulfill({ json: { reply: 'Verified response' } });
  });
  await resetPersistentAppState(page);
  await page.getByTestId('cover-initialize').click();
  await page
    .getByRole('navigation', { name: '主页面导航' })
    .getByRole('button', { name: /^现在/ })
    .click();
  await expect(page.getByTestId('now-page')).toBeVisible();
  await page.evaluate(async () => {
    const privacyPath = '/services/aiPrivacy.ts';
    const apiPath = '/features/now/api/avatar.ts';
    const vaultPath = '/services/vaultTransaction.ts';
    const keysPath = '/services/diaryStorage.ts';
    const { readAIPrivacy } = await import(/* @vite-ignore */ privacyPath);
    const { chatWithAvatar } = await import(/* @vite-ignore */ apiPath);
    const { rawVaultTransaction } = await import(/* @vite-ignore */ vaultPath);
    const { DiaryStorageKeys: keys } = await import(/* @vite-ignore */ keysPath);
    const entries = [
      { id: 'allowed', content: 'AUTHORIZED_MARKER', aiVisibility: 'allowed' },
      { id: 'private', content: 'PRIVATE_MARKER', aiVisibility: 'private' },
      { id: 'sealed', content: 'SEALED_MARKER', aiVisibility: 'allowed', isLocked: true },
      { id: 'encrypted', content: 'ENCRYPTED_MARKER', aiVisibility: 'allowed', isEncrypted: true },
    ].map((entry) => ({ title: '', tags: [], createdAt: Date.now(), ...entry }));
    await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
      values[keys.entries] = entries;
    });
    const { token } = await readAIPrivacy();
    const messages = [...entries, { id: 'deleted', content: 'DELETED_MARKER' }].map((entry) => ({
      id: entry.id,
      role: 'user',
      type: 'text',
      content: entry.content,
      created_at: new Date().toISOString(),
      aiPrivacyToken: token,
      references: [{ entryId: entry.id, title: '', date: 1, excerpt: entry.content, reason: '' }],
    }));
    await chatWithAvatar(messages, []);
    await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
      values[keys.entries] = entries.map((entry) => ({ ...entry, aiVisibility: 'private' }));
    });
    const current = await readAIPrivacy();
    await chatWithAvatar(
      [
        ...messages,
        {
          id: 'fresh',
          role: 'user',
          type: 'text',
          content: 'FRESH_QUESTION',
          created_at: new Date().toISOString(),
          aiPrivacyToken: current.token,
        },
      ],
      [],
    );
  });
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]).messages).toEqual([{ role: 'user', content: 'AUTHORIZED_MARKER' }]);
  expect(JSON.parse(bodies[1]).messages).toEqual([{ role: 'user', content: 'FRESH_QUESTION' }]);
  for (const marker of ['PRIVATE_MARKER', 'SEALED_MARKER', 'ENCRYPTED_MARKER', 'DELETED_MARKER']) {
    expect(bodies.join('')).not.toContain(marker);
  }
});

test('permission revocation rejects an in-flight browser response', async ({ page }) => {
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
  await page.evaluate(async () => {
    const vaultPath = '/services/vaultTransaction.ts';
    const keysPath = '/services/diaryStorage.ts';
    const { rawVaultTransaction } = await import(/* @vite-ignore */ vaultPath);
    const { DiaryStorageKeys: keys } = await import(/* @vite-ignore */ keysPath);
    await rawVaultTransaction([keys.entries], (values: Record<string, unknown>) => {
      values[keys.entries] = [];
    });
  });
  release();
  expect(await outcome).toBe('rejected');
});
