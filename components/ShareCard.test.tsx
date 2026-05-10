import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareCard, type ShareCardLabels } from './ShareCard';
import { SHARE_CARD_DEFAULT_OPTIONS } from '../hooks/useShareCardOptions';
import type { DiaryEntry } from '../types';

const labels: ShareCardLabels = {
  eyebrow: 'VECTOR · Reflection card',
  bodyMaskedPlaceholder: 'Body content hidden by default.',
  footerAttribution: 'Local-first journal · vectorlife.app',
  attachmentBadge: 'Has attachment',
  emptyBodyPlaceholder: '(no body)',
};

const baseEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'abcdef0123456789',
  title: 'On Cognitive Sovereignty',
  content: 'The first principle is that you must not fool yourself.',
  createdAt: Date.UTC(2025, 5, 15),
  tags: ['meta', 'discipline'],
  isLocked: false,
  ...overrides,
});

describe('ShareCard (Phase 3 §3.h)', () => {
  it('renders the title, eyebrow, archive id and footer attribution', () => {
    render(
      <ShareCard
        entry={baseEntry()}
        options={SHARE_CARD_DEFAULT_OPTIONS}
        displayIdentity="Captain Marlow"
        labels={labels}
      />,
    );
    expect(screen.getByText('On Cognitive Sovereignty')).toBeTruthy();
    expect(screen.getByText('VECTOR · Reflection card')).toBeTruthy();
    expect(screen.getByText(/AR-25-ABCD/)).toBeTruthy();
    expect(screen.getByText(/Local-first journal/)).toBeTruthy();
    expect(screen.getByText('@Captain Marlow')).toBeTruthy();
  });

  it('hides the body and renders the masked placeholder when showBody=false', () => {
    render(
      <ShareCard
        entry={baseEntry()}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showBody: false }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.getByText(labels.bodyMaskedPlaceholder)).toBeTruthy();
    expect(screen.queryByText(/must not fool yourself/)).toBeNull();
  });

  it('reveals the body when showBody=true (and strips markdown noise)', () => {
    render(
      <ShareCard
        entry={baseEntry({ content: '# Title\n\n**Bold** body line.' })}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showBody: true }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.queryByText(labels.bodyMaskedPlaceholder)).toBeNull();
    // Markdown asterisks / hashes are stripped before rendering.
    expect(screen.getByText(/Bold body line\./)).toBeTruthy();
    // Hash characters stripped — "Title" remains as plain text.
    expect(screen.getByText(/Title/)).toBeTruthy();
  });

  it('hides tag chips when showTags=false', () => {
    render(
      <ShareCard
        entry={baseEntry()}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showTags: false }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.queryByText('#meta')).toBeNull();
  });

  it('renders tag chips with leading "#" when showTags=true', () => {
    render(
      <ShareCard
        entry={baseEntry({ tags: ['meta', '#discipline'] })}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showTags: true }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.getByText('#meta')).toBeTruthy();
    expect(screen.getByText('#discipline')).toBeTruthy();
  });

  it('shows the attachment badge only when both option + entry have one', () => {
    const entryWith = baseEntry({
      attachment: { type: 'image', data: 'x', name: 'photo.png', mimeType: 'image/png' },
    });
    const entryWithout = baseEntry();

    const { rerender } = render(
      <ShareCard
        entry={entryWithout}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showAttachmentBadge: true }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.queryByText('Has attachment')).toBeNull();

    rerender(
      <ShareCard
        entry={entryWith}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showAttachmentBadge: true }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.getByText('Has attachment')).toBeTruthy();

    rerender(
      <ShareCard
        entry={entryWith}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showAttachmentBadge: false }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.queryByText('Has attachment')).toBeNull();
  });

  it('renders SEALED / TIMELOCK / ARCHIVED / ANALYSED status flags', () => {
    render(
      <ShareCard
        entry={baseEntry({
          isLocked: true,
          isEncrypted: true,
          unlockAt: Date.UTC(2030, 0, 1),
          isArchived: true,
          morningStarAnalysis: 'analysis blob',
        })}
        options={SHARE_CARD_DEFAULT_OPTIONS}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.getByText('SEALED')).toBeTruthy();
    expect(screen.getByText('TIMELOCK')).toBeTruthy();
    expect(screen.getByText('ARCHIVED')).toBeTruthy();
    expect(screen.getByText('ANALYSED')).toBeTruthy();
  });

  it('falls back to the empty-body placeholder when entry.content is blank', () => {
    render(
      <ShareCard
        entry={baseEntry({ content: '' })}
        options={{ ...SHARE_CARD_DEFAULT_OPTIONS, showBody: true }}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(screen.getByText('(no body)')).toBeTruthy();
  });

  it('forwards ref so the export hook can pass it straight to domToBlob', () => {
    let captured: HTMLDivElement | null = null;
    render(
      <ShareCard
        ref={(node) => {
          captured = node;
        }}
        entry={baseEntry()}
        options={SHARE_CARD_DEFAULT_OPTIONS}
        displayIdentity="x"
        labels={labels}
      />,
    );
    expect(captured).not.toBeNull();
    expect((captured as unknown as HTMLDivElement).getAttribute('data-testid')).toBe(
      'share-card-root',
    );
  });
});
