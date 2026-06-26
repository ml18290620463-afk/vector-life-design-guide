import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { PersonaBuilderModal } from './PersonaBuilderModal';
import { TRANSLATIONS } from '../constants';
import type { PaywallVerdict } from '../services/quotaService';

const t = TRANSLATIONS.zh;

const okVerdict: PaywallVerdict = {
  reason: 'ok',
  blocked: false,
  tier: 'stardust',
  limit: 5,
  used: 0,
  suggestedUpgrade: 'polaris',
};

const blockedVerdict: PaywallVerdict = {
  reason: 'free-tier-no-personas',
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
        persona: {
          name: '生成的名字',
          description: '生成的描述',
          systemPrompt: 'You are X, ...'.padEnd(900, '.'),
        },
        provider: 'openrouter',
        requestId: 'req-1',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );

describe('PersonaBuilderModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('paywall surface (Free tier)', () => {
    it('renders the paywall headline + upgrade CTA when verdict is blocked', () => {
      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );
      expect(screen.getByText(t.personaPaywallHeadlineFree as string)).toBeDefined();
      // Upgrade CTA aria-label is the i18n string `personaPaywallUpgradeAction`.
      expect(screen.getByLabelText(t.personaPaywallUpgradeAction as string)).toBeDefined();
    });

    it('clicking upgrade fires onUpgrade', () => {
      const onUpgrade = vi.fn();
      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onUpgrade={onUpgrade}
          onPersonaCreated={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText(t.personaPaywallUpgradeAction as string));
      expect(onUpgrade).toHaveBeenCalled();
    });

    it('does NOT render the wizard when blocked', () => {
      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );
      expect(screen.queryByText((t.personaBuilderStep as string) + / 1 \//)).toBeNull();
    });
  });

  describe('wizard surface (paid tier)', () => {
    beforeEachStubFetch();

    it('renders step 1 / 6 with the name question first', () => {
      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );
      expect(screen.getByText(/步骤.*1 \/ 6/)).toBeDefined();
      // First step's zh label
      expect(screen.getByText('这位启明星叫什么')).toBeDefined();
    });

    it('next button is disabled until the required field is filled', () => {
      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );
      const nextBtn = screen.getByLabelText('下一步');
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true);

      const textarea = screen.getByPlaceholderText(t.personaBuilderPlaceholder as string);
      fireEvent.change(textarea, { target: { value: '乔布斯' } });
      expect((nextBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('escape key calls onClose', () => {
      const onClose = vi.fn();
      render(
        <PersonaBuilderModal
          open
          onClose={onClose}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('end-to-end: fill all 6 steps + submit -> preview surface appears', async () => {
      const stubFetch = successFetcher();
      vi.stubGlobal('fetch', stubFetch);

      render(
        <PersonaBuilderModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          onPersonaCreated={vi.fn()}
        />,
      );

      // Walk through the 6 required steps. We fill every step
      // (including the optional voice/avoid steps so isReadyToSubmit
      // flips true at step 5).
      const fills = ['乔布斯', 'Apple', '极简', 'Stay hungry', '直接', '不要客套'];
      for (let i = 0; i < fills.length; i += 1) {
        const textarea = screen.getByPlaceholderText(
          t.personaBuilderPlaceholder as string,
        ) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: fills[i] } });
        if (i < fills.length - 1) {
          fireEvent.click(screen.getByLabelText('下一步'));
        }
      }

      const submitBtn = screen.getByLabelText('生成启明星') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(false);
      fireEvent.click(submitBtn);

      // After the LLM returns, the preview surface renders.
      await waitFor(() => {
        expect(screen.getByText(t.personaPreviewHeadline as string)).toBeDefined();
      });
      expect(stubFetch).toHaveBeenCalledTimes(1);
    });
  });
});

// Stubs `fetch` once for the sub-describe — kept outside vitest's
// implicit `beforeEach` API because the existing test runner expects
// scoped helpers in `describe` order.
function beforeEachStubFetch() {
  // No-op shim: tests that need the stub call `vi.stubGlobal`
  // explicitly. This helper just documents the intent.
}
