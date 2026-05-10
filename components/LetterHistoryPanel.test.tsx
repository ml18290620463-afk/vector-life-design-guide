import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LetterHistoryPanel } from './LetterHistoryPanel';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';
import type { PendingLetter } from '../types';

const t = TRANSLATIONS.zh;

const memoir = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const baseTime = 1_700_000_000_000;
const NOW = baseTime + 5 * 24 * 60 * 60 * 1000;

const sampleLetters = (): PendingLetter[] => [
  {
    id: 'letter-pending-soon',
    memoirId: memoir.id,
    body: '想跟你说一件马上就要做的事',
    composedAt: baseTime,
    deliverAt: NOW + 12 * 60 * 60 * 1000, // 12h
    status: 'pending',
  },
  {
    id: 'letter-pending-later',
    memoirId: memoir.id,
    body: '稍微远一点的安排',
    composedAt: baseTime + 1000,
    deliverAt: NOW + 7 * 24 * 60 * 60 * 1000, // 7d
    status: 'pending',
  },
  {
    id: 'letter-delivered',
    memoirId: memoir.id,
    body: '已经送出的信',
    composedAt: baseTime - 86_400_000,
    deliverAt: NOW - 1000,
    status: 'delivered',
    replyEntryId: 'entry-reply-1',
  },
  {
    id: 'letter-cancelled',
    memoirId: memoir.id,
    body: '中途取消的信',
    composedAt: baseTime - 172_800_000,
    deliverAt: NOW - 1000,
    status: 'cancelled',
  },
  {
    id: 'letter-failed',
    memoirId: memoir.id,
    body: '失败 3 次的信',
    composedAt: baseTime - 259_200_000,
    deliverAt: NOW - 1000,
    status: 'failed',
    attempts: 3,
  },
  {
    id: 'letter-other-memoir',
    memoirId: 'memoir-other',
    body: '应该被过滤掉',
    composedAt: baseTime,
    deliverAt: NOW + 1000,
    status: 'pending',
  },
];

describe('LetterHistoryPanel', () => {
  afterEach(() => cleanup());

  it('renders the title with the memoir name', () => {
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={[]}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText((c) => c.includes(t.letterHistoryTitle as string))).toBeDefined();
    expect(screen.getByText((c) => c.includes(memoir.name))).toBeDefined();
  });

  it('filters letters scoped to the memoir id', () => {
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={sampleLetters()}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    // The "other memoir" row should be filtered out.
    expect(screen.queryByTestId('letter-history-row-letter-other-memoir')).toBeNull();
  });

  it('orders pending by deliverAt ASC (next-to-arrive on top)', () => {
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={sampleLetters()}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    const pendingSection = screen.getByTestId('letter-history-pending');
    const rows = pendingSection.querySelectorAll('[data-testid^="letter-history-row-"]');
    expect(rows[0].getAttribute('data-testid')).toBe('letter-history-row-letter-pending-soon');
    expect(rows[1].getAttribute('data-testid')).toBe('letter-history-row-letter-pending-later');
  });

  it('cancel button on pending row fires onCancelLetter', () => {
    const onCancelLetter = vi.fn();
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={sampleLetters()}
        onCancelLetter={onCancelLetter}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByTestId('letter-history-cancel-letter-pending-soon'));
    expect(onCancelLetter).toHaveBeenCalledWith('letter-pending-soon');
  });

  it('open-reply button on a delivered row fires onOpenReply with the letter', () => {
    const onOpenReply = vi.fn();
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={sampleLetters()}
        onCancelLetter={vi.fn()}
        onOpenReply={onOpenReply}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByTestId('letter-history-open-reply-letter-delivered'));
    expect(onOpenReply).toHaveBeenCalledTimes(1);
    expect(onOpenReply.mock.calls[0][0].id).toBe('letter-delivered');
  });

  it('cancelled + failed rows go into the collapsed "other" section', () => {
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={sampleLetters()}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    const other = screen.getByTestId('letter-history-other');
    expect(
      other.querySelector('[data-testid="letter-history-row-letter-cancelled"]'),
    ).not.toBeNull();
    expect(other.querySelector('[data-testid="letter-history-row-letter-failed"]')).not.toBeNull();
  });

  it('hides the "other" section entirely when there are no cancelled / failed letters', () => {
    const cleanLetters = sampleLetters().filter(
      (l) => l.status !== 'cancelled' && l.status !== 'failed',
    );
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={cleanLetters}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId('letter-history-other')).toBeNull();
  });

  it('renders empty-state copy when the memoir has no pending or delivered letters', () => {
    render(
      <LetterHistoryPanel
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoir={memoir}
        letters={[]}
        onCancelLetter={vi.fn()}
        onOpenReply={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText(t.letterHistoryEmptyPending as string)).toBeDefined();
    expect(screen.getByText(t.letterHistoryEmptyDelivered as string)).toBeDefined();
  });
});
