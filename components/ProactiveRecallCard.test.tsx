import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProactiveRecallCard } from './ProactiveRecallCard';
import { TRANSLATIONS } from '../constants';
import type { ProactiveRecallSuggestion } from '../services/proactiveRecall';

const t = TRANSLATIONS.zh;

const baseSuggestion = (
  over: Partial<ProactiveRecallSuggestion> = {},
): ProactiveRecallSuggestion => ({
  memoirId: 'memoir-1',
  memoirName: '奶奶',
  trigger: 'silence-reconnect',
  promptHintKey: 'proactiveSilenceHint',
  expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  ...over,
});

describe('ProactiveRecallCard', () => {
  afterEach(() => cleanup());

  it('renders the memoir name + localised hint', () => {
    render(
      <ProactiveRecallCard
        suggestion={baseSuggestion()}
        theme="dark"
        t={t}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('奶奶')).toBeDefined();
    expect(screen.getByText(t.proactiveSilenceHint as string)).toBeDefined();
  });

  it('Open CTA fires onOpen with the suggestion', () => {
    const onOpen = vi.fn();
    render(
      <ProactiveRecallCard
        suggestion={baseSuggestion()}
        theme="dark"
        t={t}
        onOpen={onOpen}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/打开与这位心象的对话/));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('Dismiss button fires onDismiss with the suggestion', () => {
    const onDismiss = vi.fn();
    render(
      <ProactiveRecallCard
        suggestion={baseSuggestion()}
        theme="dark"
        t={t}
        onOpen={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText(t.proactiveDismissAria as string));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the anniversary hint key when trigger is anniversary', () => {
    render(
      <ProactiveRecallCard
        suggestion={baseSuggestion({
          trigger: 'anniversary',
          promptHintKey: 'proactiveAnniversaryHint',
        })}
        theme="dark"
        t={t}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(t.proactiveAnniversaryHint as string)).toBeDefined();
  });
});
