import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LetterArrivedCard } from './LetterArrivedCard';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';
import type { PendingLetter } from '../types';

const t = TRANSLATIONS.zh;

const memoir = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const sampleLetter: PendingLetter = {
  id: 'letter-1',
  memoirId: memoir.id,
  body: '想跟你说一件事',
  composedAt: Date.now() - 24 * 60 * 60 * 1000,
  deliverAt: Date.now() - 1000,
  status: 'delivered',
  replyEntryId: 'entry-XYZ',
  lastAttemptAt: Date.now() - 1000,
};

describe('LetterArrivedCard', () => {
  afterEach(() => cleanup());

  it('renders nothing when memoir is undefined (orphaned letter)', () => {
    const { container } = render(
      <LetterArrivedCard
        letter={sampleLetter}
        memoir={undefined}
        theme="dark"
        t={t}
        onOpenReply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the headline with the memoir name interpolated', () => {
    render(
      <LetterArrivedCard
        letter={sampleLetter}
        memoir={memoir}
        theme="dark"
        t={t}
        onOpenReply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/奶奶/)).toBeDefined();
  });

  it('Open CTA fires onOpenReply with the letter', () => {
    const onOpenReply = vi.fn();
    render(
      <LetterArrivedCard
        letter={sampleLetter}
        memoir={memoir}
        theme="dark"
        t={t}
        onOpenReply={onOpenReply}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/奶奶/));
    expect(onOpenReply).toHaveBeenCalledWith(sampleLetter);
  });

  it('Dismiss button fires onDismiss with the letter', () => {
    const onDismiss = vi.fn();
    render(
      <LetterArrivedCard
        letter={sampleLetter}
        memoir={memoir}
        theme="dark"
        t={t}
        onOpenReply={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText(t.letterArrivedDismissAria as string));
    expect(onDismiss).toHaveBeenCalledWith(sampleLetter);
  });
});
