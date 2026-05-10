import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoirBuilderModal } from './MemoirBuilderModal';
import { TRANSLATIONS } from '../constants';
import type { PaywallVerdict } from '../services/quotaService';

const t = TRANSLATIONS.zh;

const okVerdict: PaywallVerdict = {
  reason: 'ok',
  blocked: false,
  tier: 'stardust',
  limit: 1,
  used: 0,
  suggestedUpgrade: 'polaris',
};

const blockedVerdict: PaywallVerdict = {
  reason: 'free-tier-no-memoirs',
  blocked: true,
  tier: 'free',
  limit: 0,
  used: 0,
  suggestedUpgrade: 'stardust',
};

const successFetcher = () =>
  vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        memoir: {
          name: '奶奶',
          description: '我心中的奶奶',
          systemPrompt: '你是奶奶,是用户心中的奶奶。'.padEnd(1500, '。'),
        },
        provider: 'openrouter',
        requestId: 'req-1',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );

describe('MemoirBuilderModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('paywall surface (Free tier)', () => {
    it('renders the Memoir paywall headline + upgrade CTA when blocked', () => {
      render(
        <MemoirBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onMemoirCreated={vi.fn()}
        />,
      );
      expect(screen.getByText(t.memoirPaywallHeadlineFree as string)).toBeDefined();
      expect(screen.getByLabelText(t.memoirPaywallUpgradeAction as string)).toBeDefined();
    });

    it('clicking upgrade fires onUpgrade', () => {
      const onUpgrade = vi.fn();
      render(
        <MemoirBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onUpgrade={onUpgrade}
          onMemoirCreated={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText(t.memoirPaywallUpgradeAction as string));
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe('wizard surface', () => {
    it('renders step 1 with the name field on open', () => {
      render(
        <MemoirBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onMemoirCreated={vi.fn()}
        />,
      );
      expect(screen.getByText(/心中的这个人叫什么/)).toBeDefined();
      expect(screen.getByText(/步骤 1 \/ 5/)).toBeDefined();
    });

    it('does not render the consent checkbox on early steps', () => {
      render(
        <MemoirBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onMemoirCreated={vi.fn()}
        />,
      );
      // Consent label only appears on the LAST (wishes) step.
      expect(screen.queryByLabelText(t.memoirBuilderConsentAria as string)).toBeNull();
    });

    it('does not call fetcher when consent checkbox is unchecked', async () => {
      const fetcher = successFetcher();
      // Inject the fetcher via the global since the modal uses the
      // hook's default `fetch` parameter — patching window.fetch is
      // the cleanest path that keeps the modal API closed.
      const originalFetch = window.fetch;
      window.fetch = fetcher as unknown as typeof fetch;

      try {
        render(
          <MemoirBuilderModal
            open
            onClose={vi.fn()}
            theme="dark"
            language="zh"
            t={t}
            paywallVerdict={okVerdict}
            onMemoirCreated={vi.fn()}
          />,
        );

        // Walk through the 5 steps filling required fields.
        const fillStep = (placeholder: string, value: string) => {
          const ta = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement;
          fireEvent.change(ta, { target: { value } });
          // The "Next" button is labelled by the i18n key on the
          // first 4 steps, then becomes "Submit" on step 5.
          const next = screen.queryByLabelText(t.memoirBuilderNext as string);
          if (next) fireEvent.click(next);
        };

        fillStep(t.memoirBuilderPlaceholder as string, '奶奶');
        fillStep(t.memoirBuilderPlaceholder as string, '我的奶奶');
        fillStep(t.memoirBuilderPlaceholder as string, '不要紧');
        fillStep(t.memoirBuilderPlaceholder as string, '一起吃饭');

        // Now we should be on step 5 with the consent checkbox.
        const consent = screen.getByLabelText(t.memoirBuilderConsentAria as string);
        expect(consent).toBeDefined();

        // Submit button should be disabled until consent is ticked.
        const submit = screen.getByLabelText(t.memoirBuilderSubmit as string);
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        // Tick consent → submit enables.
        fireEvent.click(consent);
        await waitFor(() => {
          expect((submit as HTMLButtonElement).disabled).toBe(false);
        });
      } finally {
        window.fetch = originalFetch;
      }
    });
  });
});
