import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EchoChamberModal } from './EchoChamberModal';
import { TRANSLATIONS } from '../constants';
import type { PaywallVerdict } from '../services/quotaService';

const t = TRANSLATIONS.zh;

const okVerdict: PaywallVerdict = {
  reason: 'ok',
  blocked: false,
  tier: 'stardust',
  limit: 80,
  used: 0,
  suggestedUpgrade: 'polaris',
};

const blockedVerdict: PaywallVerdict = {
  reason: 'free-tier-no-echo-chamber',
  blocked: true,
  tier: 'free',
  limit: 0,
  used: 0,
  suggestedUpgrade: 'stardust',
};

const personaPool = ['Marcus Aurelius', 'Naval Ravikant', 'Laozi', 'Carl Jung'];

describe('EchoChamberModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('paywall surface', () => {
    it('renders the upgrade headline + CTA when verdict is blocked', () => {
      render(
        <EchoChamberModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          availablePersonas={personaPool}
          onSave={vi.fn()}
        />,
      );
      expect(screen.getByText(t.echoChamberPaywallHeadline as string)).toBeDefined();
      expect(screen.getByLabelText(t.echoChamberPaywallUpgrade as string)).toBeDefined();
    });

    it('clicking upgrade fires onUpgrade', () => {
      const onUpgrade = vi.fn();
      render(
        <EchoChamberModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={blockedVerdict}
          onUpgrade={onUpgrade}
          availablePersonas={personaPool}
          onSave={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText(t.echoChamberPaywallUpgrade as string));
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  describe('compose surface', () => {
    it('renders query textarea + persona chip group', () => {
      render(
        <EchoChamberModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          availablePersonas={personaPool}
          onSave={vi.fn()}
        />,
      );
      expect(screen.getByTestId('echo-chamber-query')).toBeDefined();
      for (const name of personaPool) {
        expect(screen.getByText(name)).toBeDefined();
      }
    });

    it('Send is disabled until query + ≥3 personas are filled', () => {
      render(
        <EchoChamberModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          availablePersonas={personaPool}
          onSave={vi.fn()}
        />,
      );
      const send = screen.getByLabelText(t.echoChamberStart as string) as HTMLButtonElement;
      expect(send.disabled).toBe(true);
      // Fill query
      fireEvent.change(screen.getByTestId('echo-chamber-query'), {
        target: { value: '我现在该不该辞职?这份工作让我焦虑。' },
      });
      expect(send.disabled).toBe(true); // still no personas
      // Pick 3 personas
      for (const name of ['Marcus Aurelius', 'Naval Ravikant', 'Laozi']) {
        fireEvent.click(screen.getByText(name));
      }
      expect(send.disabled).toBe(false);
    });

    it('persona chips toggle pressed state on click', () => {
      render(
        <EchoChamberModal
          open
          onClose={vi.fn()}
          theme="dark"
          language="zh"
          t={t}
          paywallVerdict={okVerdict}
          availablePersonas={personaPool}
          onSave={vi.fn()}
        />,
      );
      const chip = screen.getByText('Marcus Aurelius');
      expect(chip.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(chip);
      expect(chip.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(chip);
      expect(chip.getAttribute('aria-pressed')).toBe('false');
    });

    it('on submit success, flips to result surface; Save fires onSave with the payload', async () => {
      const onSave = vi.fn().mockResolvedValue(true);
      // Stub fetch to return a markdown reply.
      const originalFetch = window.fetch;
      window.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            markdown: '### ✉️ 来自 Marcus 的回应\n\nbody body body',
            provider: 'openrouter',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ) as typeof fetch;
      try {
        const onClose = vi.fn();
        render(
          <EchoChamberModal
            open
            onClose={onClose}
            theme="dark"
            language="zh"
            t={t}
            paywallVerdict={okVerdict}
            availablePersonas={personaPool}
            onSave={onSave}
          />,
        );
        fireEvent.change(screen.getByTestId('echo-chamber-query'), {
          target: { value: '我现在该不该辞职?这份工作让我焦虑。' },
        });
        for (const name of ['Marcus Aurelius', 'Naval Ravikant', 'Laozi']) {
          fireEvent.click(screen.getByText(name));
        }
        fireEvent.click(screen.getByLabelText(t.echoChamberStart as string));
        await waitFor(() => {
          expect(screen.getByTestId('echo-chamber-result')).toBeDefined();
        });
        fireEvent.click(screen.getByLabelText(t.echoChamberSave as string));
        await waitFor(() => {
          expect(onSave).toHaveBeenCalledTimes(1);
        });
        const call = onSave.mock.calls[0][0];
        expect(call.query).toContain('辞职');
        expect(call.personaNames).toEqual(['Marcus Aurelius', 'Naval Ravikant', 'Laozi']);
        expect(call.resultMarkdown).toContain('Marcus');
        await waitFor(() => {
          expect(onClose).toHaveBeenCalledTimes(1);
        });
      } finally {
        window.fetch = originalFetch;
      }
    });
  });
});
