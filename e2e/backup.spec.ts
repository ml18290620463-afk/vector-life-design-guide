import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seedOnboardedApp } from './seedHelpers';

/**
 * Restore-backup happy path. We don't drive the full onboarding flow here -
 * that is already covered by `app.spec.ts`. Instead we validate the import
 * pipeline end-to-end: the in-app modal renders, Origin/Token gate is not
 * triggered for a same-origin file upload, and a successful import surfaces
 * the localized success message.
 */

const buildBackupPayload = () =>
  JSON.stringify({
    type: 'vector-vault-backup',
    schemaVersion: 1,
    version: 'v9.9.9',
    exportedAt: '2026-05-01T00:00:00.000Z',
    entryCount: 1,
    entries: [
      {
        id: 'e2e-restore-1',
        title: 'Restored Entry',
        content: 'Imported via Playwright E2E.',
        createdAt: 1746057600000,
        tags: ['e2e'],
        isLocked: false,
        isEncrypted: false,
      },
    ],
  });

test('backup UI server is healthy', async ({ request }) => {
  const health = await request.get('/api/health');
  await expect(health).toBeOK();
});

test('encrypted full export restores across vault passwords and safely cancels or rejects attempts', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await seedOnboardedApp(page, { password: 'VectorSource123!' });
  // Restore the dashboard route through the SPA router, preserving the real
  // onboarding unlock session. A full preview reload would lock the vault.
  await page.evaluate(() => {
    history.pushState({}, '', '/?preview=web');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('dashboard-system-hub')).toBeVisible();
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { vaultTransaction } = await load('/services/vaultTransaction.ts');
    const { DiaryStorageKeys: K } = await load('/services/diaryStorage.ts');
    const { SecurityService } = await load('/services/securityService.ts');
    const { useAppStore } = await load('/stores/appStore.ts');
    const { saveNowDraft, loadNowDraft } = await load('/services/nowDraftRepository.ts');
    const { createEmptyDraft } = await load('/features/now/state/nowRules.ts');
    const { saveGoal, saveFutureAction } = await load('/services/futureRepository.ts');
    const content = await SecurityService.encrypt(
      '跨设备私人经历',
      useAppStore.getState().masterPassword,
    );
    await vaultTransaction([K.entries], (v: Record<string, unknown>) => {
      v[K.entries] = [
        {
          id: 'encrypted-e2e-entry',
          title: '跨设备恢复记录',
          content,
          createdAt: 1,
          tags: [],
          isLocked: false,
          isEncrypted: true,
        },
      ];
    });
    const old = await loadNowDraft();
    await saveNowDraft({ ...createEmptyDraft(), text: '跨设备私人草稿' }, old.revision);
    const goal = await saveGoal({
      title: '跨设备恢复目标',
      status: 'active',
      measurement: { kind: 'narrative' },
      tags: [],
    });
    await saveFutureAction({ title: '跨设备恢复行动', status: 'pending', goalId: goal.id });
    localStorage.setItem(
      'vector:avatar:atomic-memories:v1',
      JSON.stringify([
        { id: 'encrypted-e2e-memory', statement: '跨设备私人理解', status: 'confirmed' },
      ]),
    );
  });
  await page.getByRole('button', { name: /系统设置|System settings/i }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: /刻录全量星图|Burn Full StarMap/i }).click();
  const download = await exported;
  const file = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(file).type).toBe('vector-encrypted-vault-backup');
  expect(file).not.toMatch(/跨设备|entryCount|passwordHash/);

  const destination = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const target = await destination.newPage();
    await seedOnboardedApp(target, { password: 'VectorDestination456!' });
    await target.evaluate(() => {
      history.pushState({}, '', '/?preview=web');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(target.getByTestId('dashboard-system-hub')).toBeVisible();
    const hashBefore = await target.evaluate(async () => {
      const path = '/services/vaultTransaction.ts';
      const { rawVaultTransaction } = await import(/* @vite-ignore */ path);
      return rawVaultTransaction(
        ['vector_master_vault_pwd_hash'],
        (v: Record<string, unknown>) => v.vector_master_vault_pwd_hash,
        true,
      );
    });
    await target.getByRole('button', { name: /系统设置|System settings/i }).click();
    await target.getByText(/Restore Backup|导入备份/i).scrollIntoViewIfNeeded();
    const upload = () =>
      target
        .locator('input[type="file"][accept*="json"]')
        .first()
        .setInputFiles({
          name: 'encrypted-backup.json',
          mimeType: 'application/json',
          buffer: Buffer.from(file),
        });
    const dialog = target.getByRole('dialog');
    await upload();
    await expect(dialog.getByLabel(/备份密码|Backup password/)).toBeFocused();
    await target.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await upload();
    await dialog.getByLabel(/备份密码|Backup password/).fill('wrong-password');
    await dialog.getByRole('button', { name: /解密并检查|Decrypt and check/ }).click();
    await expect(target.getByRole('status').filter({ hasText: /未导入/ })).toBeVisible();
    const readRestored = () =>
      target.evaluate(async () => {
        const load = (path: string) => import(/* @vite-ignore */ path);
        const { rawVaultTransaction } = await load('/services/vaultTransaction.ts');
        const { loadNowDraft } = await load('/services/nowDraftRepository.ts');
        const { readFutureSnapshot } = await load('/services/futureRepository.ts');
        const { SecurityService } = await load('/services/securityService.ts');
        const { useAppStore } = await load('/stores/appStore.ts');
        const keys = [
          'vector_master_vault_entries',
          'vector_master_vault_pwd_hash',
          'vector_backup_restore_job_v1',
        ];
        const rows = await rawVaultTransaction(keys, (v: Record<string, unknown>) => v, true);
        const entries = rows[keys[0]] ?? [];
        return {
          hash: rows[keys[1]],
          recoveryPending: !!rows[keys[2]],
          entry: entries.find((e: { id: string }) => e.id === 'encrypted-e2e-entry'),
          content: entries.some((e: { id: string }) => e.id === 'encrypted-e2e-entry')
            ? await SecurityService.decrypt(
                entries.find((e: { id: string }) => e.id === 'encrypted-e2e-entry').content,
                useAppStore.getState().masterPassword,
              )
            : null,
          draft: (await loadNowDraft()).draft?.text,
          future: await readFutureSnapshot(),
          memories: JSON.parse(localStorage.getItem('vector:avatar:atomic-memories:v1') ?? '[]'),
        };
      });
    expect((await readRestored()).entry).toBeUndefined();
    for (let attempt = 0; attempt < 2; attempt++) {
      await upload();
      await dialog.getByLabel(/备份密码|Backup password/).fill('VectorSource123!');
      await dialog.getByRole('button', { name: /解密并检查|Decrypt and check/ }).click();
      await expect(dialog).toContainText(/完整备份|full backup/);
      await dialog.getByRole('button', { name: /^导入$|^Import$/ }).click();
      await expect(target.getByRole('status').filter({ hasText: /已导入|Imported/ })).toBeVisible();
      const restored = await readRestored();
      expect(restored.hash).toBe(hashBefore);
      expect(restored.entry.isEncrypted).toBe(true);
      expect(restored.content).toBe('跨设备私人经历');
      expect(restored.draft).toBe('跨设备私人草稿');
      expect(
        restored.future.state.goals.filter((g: { title: string }) => g.title === '跨设备恢复目标'),
      ).toHaveLength(1);
      expect(
        restored.future.actions.filter((a: { title: string }) => a.title === '跨设备恢复行动'),
      ).toHaveLength(1);
      expect(
        restored.memories.filter((m: { id: string }) => m.id === 'encrypted-e2e-memory'),
      ).toHaveLength(1);
      expect(restored.recoveryPending).toBe(false);
    }
  } finally {
    await destination.close();
  }
});

test.describe('Backup import modal', () => {
  // Onboarding is covered by app.spec.ts and is sufficient as a precondition;
  // this test only walks the cover/onboarding far enough to land in Dashboard,
  // then exercises the new import modal.
  test.setTimeout(90_000);

  test('completes onboarding, opens settings, and restores from a JSON backup', async ({
    page,
  }) => {
    await seedOnboardedApp(page, { password: 'Vector123!' });
    await page.goto('/?preview=web&screen=dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-system-hub')).toBeVisible();

    // Open the settings panel and trigger the hidden file input directly,
    // then confirm via the new in-app modal (no window.confirm anymore).
    // Open settings panel by clicking the settings cog (titled with the
    // localized `settingsTitle` translation, e.g. "认知切片 / 逻辑自检").
    await page.getByRole('button', { name: /系统设置|System settings/i }).click();

    // Scroll to the storage section so the hidden file input becomes
    // attached and clickable in headless mode.
    await page.getByText(/Restore Backup|导入备份/i).scrollIntoViewIfNeeded();

    const importInput = page.locator('input[type="file"][accept*="json"]').first();
    await importInput.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(buildBackupPayload(), 'utf-8'),
    });

    // The new in-app confirm modal should appear with the `导入 X 条` prompt.
    const importDialog = page.getByRole('dialog');
    await expect(importDialog).toBeVisible();
    await importDialog.getByRole('button', { name: /^导入$|^Import$/i }).click();

    // Status row in the Restore Backup section should now display a success
    // message. Match the localized success template (`已导入` in zh,
    // `Imported` in en) — the exact count formatting differs per language.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /已导入|Imported/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
