import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibility regression gate for the entry-point shells (cover screen +
 * onboarding intro). We deliberately scope axe to WCAG A/AA + best-practice
 * tags and only fail on `serious` / `critical` impact so cosmetic issues
 * (e.g. decorative element contrast on the cyber theme) do not block CI
 * while we polish them in Phase 2/3.
 *
 * Add new flows here only after confirming they have zero
 * serious/critical violations locally; lower impact issues should be
 * tracked in EVALUATION.md instead of lowering this gate.
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
      nodes: v.nodes.length,
    }));

test.describe('axe accessibility', () => {
  test('cover screen has no serious or critical violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for the cover entry button so we know React has hydrated.
    await page.getByTestId('cover-initialize').waitFor({ state: 'visible' });

    const result = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
    const blockers = summarise(result.violations);
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });

  test('onboarding intro has no serious or critical violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /起航|initialize/i }).dispatchEvent('click');
    // Wait for the onboarding "next" button to indicate the panel has rendered.
    await page.getByRole('button', { name: /下一步|next/i }).waitFor({ state: 'visible' });

    const result = await new AxeBuilder({ page }).withTags(RULES_TAGS).analyze();
    const blockers = summarise(result.violations);
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });
});
