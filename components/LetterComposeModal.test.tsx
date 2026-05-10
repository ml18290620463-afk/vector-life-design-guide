import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LetterComposeModal } from './LetterComposeModal';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';

const t = TRANSLATIONS.zh;

const memoirA = mintPersona({
  name: '奶奶',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const memoirB = mintPersona({
  name: '导师',
  systemPrompt: 'x'.repeat(200),
  kind: 'memoir',
});

const personaJobs = mintPersona({
  name: '乔布斯',
  systemPrompt: 'x'.repeat(200),
  kind: 'persona',
});

describe('LetterComposeModal', () => {
  afterEach(() => cleanup());

  it('renders the empty-state when no Memoirs are provided', () => {
    render(
      <LetterComposeModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoirs={[personaJobs]}
        onSendLetter={vi.fn()}
      />,
    );
    expect(screen.getByText(t.letterComposeNoMemoirsHint as string)).toBeDefined();
  });

  it('hides the recipient selector when only one Memoir exists', () => {
    render(
      <LetterComposeModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoirs={[memoirA]}
        onSendLetter={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(t.letterComposeRecipient as string)).toBeNull();
  });

  it('shows the recipient selector when multiple Memoirs exist', () => {
    render(
      <LetterComposeModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoirs={[memoirA, memoirB]}
        onSendLetter={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(t.letterComposeRecipient as string);
    expect(select).toBeDefined();
  });

  it('Send is disabled until the body has content', () => {
    render(
      <LetterComposeModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoirs={[memoirA]}
        onSendLetter={vi.fn()}
      />,
    );
    const send = screen.getByLabelText(t.letterComposeSend as string) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it('on Send, calls onSendLetter with the chosen memoir + body + delay', async () => {
    const onSendLetter = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <LetterComposeModal
        open
        onClose={onClose}
        theme="dark"
        t={t}
        memoirs={[memoirA]}
        onSendLetter={onSendLetter}
      />,
    );
    fireEvent.change(screen.getByTestId('letter-compose-body'), {
      target: { value: '想跟你说一件事 — 我换了工作。' },
    });
    fireEvent.click(screen.getByLabelText(t.letterComposeSend as string));
    await waitFor(() => {
      expect(onSendLetter).toHaveBeenCalledTimes(1);
    });
    expect(onSendLetter).toHaveBeenCalledWith({
      memoirId: memoirA.id,
      body: '想跟你说一件事 — 我换了工作。',
      delayMs: 24 * 60 * 60 * 1000, // default
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces an inline error and does NOT close when onSendLetter returns false', async () => {
    const onSendLetter = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(
      <LetterComposeModal
        open
        onClose={onClose}
        theme="dark"
        t={t}
        memoirs={[memoirA]}
        onSendLetter={onSendLetter}
      />,
    );
    fireEvent.change(screen.getByTestId('letter-compose-body'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByLabelText(t.letterComposeSend as string));
    await waitFor(() => {
      expect(screen.getByTestId('letter-compose-error')).toBeDefined();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('switching the delivery preset to 1h forwards the right delayMs', async () => {
    const onSendLetter = vi.fn().mockResolvedValue(true);
    render(
      <LetterComposeModal
        open
        onClose={vi.fn()}
        theme="dark"
        t={t}
        memoirs={[memoirA]}
        onSendLetter={onSendLetter}
      />,
    );
    fireEvent.click(screen.getByLabelText(t.letterDelay1h as string));
    fireEvent.change(screen.getByTestId('letter-compose-body'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByLabelText(t.letterComposeSend as string));
    await waitFor(() => {
      expect(onSendLetter).toHaveBeenCalledWith(
        expect.objectContaining({ delayMs: 60 * 60 * 1000 }),
      );
    });
  });
});
