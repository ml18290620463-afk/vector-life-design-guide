import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resetPersistentAppState, seedOnboardedApp } from './seedHelpers';

/** Audit entry, unlocked modules and editors against WCAG A/AA.
 * Keep target selectors and failure reasons in reports so regressions are actionable.
 */

const RULES_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const BLOCKING_IMPACTS = new Set<'serious' | 'critical'>(['serious', 'critical']);

const summarise = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations
    .filter((v) => v.impact && BLOCKING_IMPACTS.has(v.impact as 'serious' | 'critical'))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
    }));

test.describe('axe accessibility', () => {
  test('cover screen has no serious or critical violations', async ({ page }) => {
    await resetPersistentAppState(page);
    // Wait for the cover entry button so we know React has hydrated.
    await page.getByTestId('cover-initialize').waitFor({ state: 'visible' });

    const result = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
    const blockers = summarise(result.violations);
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });

  test('onboarding intro has no serious or critical violations', async ({ page }) => {
    await resetPersistentAppState(page);
    // Use a real user interaction: the cover transition is deliberately
    // guarded by the component's pointer/click flow rather than a raw event.
    await page.getByTestId('cover-initialize').click();
    await page.getByTestId('onboarding-password').waitFor({ state: 'visible' });

    const result = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
    const blockers = summarise(result.violations);
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });

  test('the unlocked core pages and full-screen editor have no serious or critical violations', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Scan real, unlocked screens rather than only the entry flow. This keeps
    // the audit tied to the controls people use to record, review and plan.
    await seedOnboardedApp(page);

    const navigation = page.getByRole('navigation', { name: '主页面导航' });
    for (const [moduleName, landmark] of [
      ['现在', '[data-testid="now-page"]'],
      ['过去', '[data-testid="past-page"]'],
      ['未来', '.future-page'],
      ['分身', '[data-testid="avatar-assist-page"]'],
    ] as const) {
      await navigation.getByRole('button', { name: new RegExp(`^${moduleName}`) }).click();
      await page.locator(landmark).waitFor({ state: 'visible' });
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });
      const result = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
      const blockers = summarise(result.violations);
      expect.soft(blockers, `${moduleName}: ${JSON.stringify(blockers, null, 2)}`).toEqual([]);
    }

    await navigation.getByRole('button', { name: /^未来/ }).click();
    await page.getByRole('button', { name: /^(添加愿景|编辑愿景)$/ }).click();
    await page.getByRole('dialog', { name: '愿景' }).waitFor({ state: 'visible' });
    const editor = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
    const editorBlockers = summarise(editor.violations);
    expect(editorBlockers, JSON.stringify(editorBlockers, null, 2)).toEqual([]);
  });
});
