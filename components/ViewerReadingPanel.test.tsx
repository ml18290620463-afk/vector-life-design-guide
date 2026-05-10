import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewerReadingPanel } from './ViewerReadingPanel';
import type { DiaryEntry } from '../types';
import { TRANSLATIONS } from '../constants';
import { buildViewerMarkdownComponents } from './viewerMarkdown';

const t = TRANSLATIONS.zh;

const baseEntry: DiaryEntry = {
  id: 'entry-r',
  title: 'Reading Title',
  content: 'plain text body',
  createdAt: Date.UTC(2026, 4, 1),
  tags: ['alpha', 'beta'],
  isLocked: false,
};

const baseProps = {
  theme: 'dark' as const,
  t,
  entry: baseEntry,
  decrypted: true,
  decryptedContent: '# Heading\n\nBody copy here.',
  decodedStars: [{ top: '5%', right: '5%', duration: 3, delay: 0.1 }],
  burnMode: 'idle' as const,
  archiveState: 'idle' as const,
  showConfirmHome: false,
  showPackingMenu: false,
  containers: [],
  onTogglePackingMenu: vi.fn(),
  onMoveToContainer: vi.fn(),
  onArchiveOrRestore: vi.fn(),
  onDownload: vi.fn(),
  guidingStars: ['Star One'],
  readingStep: 'reading' as const,
  setReadingStep: vi.fn(),
  reflectionText: '',
  setReflectionText: vi.fn(),
  morningStarPersonas: [],
  setMorningStarPersonas: vi.fn(),
  morningStarLoading: false,
  morningStarError: null as string | null,
  parsedAnalysis: null,
  onAnalyze: vi.fn(),
  onDeleteAnalysis: vi.fn(),
  onBack: vi.fn(),
  onRequestBurn: vi.fn(),
  onCancelBurn: vi.fn(),
  onExecuteBurn: vi.fn(),
  markdownComponents: buildViewerMarkdownComponents('dark'),
};

describe('ViewerReadingPanel', () => {
  it('renders the entry footer metadata (NODE_ID + protocol)', () => {
    render(<ViewerReadingPanel {...baseProps} />);
    expect(screen.getByText(/NODE_ID/)).toBeTruthy();
    expect(screen.getByText(/VECTOR_TRACE_PROTOCOL/)).toBeTruthy();
  });

  it('renders tag chips when the entry is decrypted', () => {
    render(<ViewerReadingPanel {...baseProps} />);
    expect(screen.getByText('#alpha')).toBeTruthy();
    expect(screen.getByText('#beta')).toBeTruthy();
  });

  it('renders the decrypted markdown body via the supplied components', () => {
    render(<ViewerReadingPanel {...baseProps} />);
    // Multiple <h1> elements exist (entry title + markdown heading); we only
    // assert the markdown body's content is present.
    expect(screen.getByText('Heading')).toBeTruthy();
    expect(screen.getByText(/Body copy here/)).toBeTruthy();
  });

  it('hides the markdown body when not yet decrypted and shows the blurred placeholder instead', () => {
    render(<ViewerReadingPanel {...baseProps} decrypted={false} decryptedContent="" />);
    // When not decrypted the entry-title <h1> renders the encryptedTitle
    // placeholder instead of the real title; the markdown <h1> ('Heading')
    // must not be present.
    expect(screen.queryByText('Heading')).toBeNull();
    expect(screen.getByText('plain text body')).toBeTruthy();
    expect(screen.getByText(t.encryptedTitle)).toBeTruthy();
  });

  it('Close-file button on the toolbar invokes onBack', () => {
    const onBack = vi.fn();
    render(<ViewerReadingPanel {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByText(t.closeFile));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders the burn confirmation overlay only when burnMode === "confirm" and routes the buttons correctly', () => {
    const onCancelBurn = vi.fn();
    const onExecuteBurn = vi.fn();
    render(
      <ViewerReadingPanel
        {...baseProps}
        burnMode="confirm"
        onCancelBurn={onCancelBurn}
        onExecuteBurn={onExecuteBurn}
      />,
    );
    expect(screen.getByText(t.confirmDestruction)).toBeTruthy();
    fireEvent.click(screen.getByText(t.cancel));
    expect(onCancelBurn).toHaveBeenCalled();
    fireEvent.click(screen.getByText(t.confirm));
    expect(onExecuteBurn).toHaveBeenCalled();
  });

  /* -------------------------------------------------------------- *
   * Phase 4.5 follow-ups (F3) — Echo Chamber preface                *
   * -------------------------------------------------------------- */

  it('renders the echo-chamber preface block when entry.isEchoChamber + echoChamberQuery are present', () => {
    const echoEntry: DiaryEntry = {
      ...baseEntry,
      isEchoChamber: true,
      echoChamberQuery: '我应该接受这份 offer 吗?',
    };
    render(<ViewerReadingPanel {...baseProps} entry={echoEntry} />);
    expect(screen.getByTestId('viewer-echo-preface')).toBeTruthy();
    expect(screen.getByText('我应该接受这份 offer 吗?')).toBeTruthy();
    expect(screen.getByText(t.echoChamberPrefaceLabel as string)).toBeTruthy();
  });

  it('does not render the preface block for a regular non-echo entry', () => {
    render(<ViewerReadingPanel {...baseProps} />);
    expect(screen.queryByTestId('viewer-echo-preface')).toBeNull();
  });

  it('does not render the preface block until the entry is decrypted', () => {
    const echoEntry: DiaryEntry = {
      ...baseEntry,
      isEchoChamber: true,
      echoChamberQuery: 'Should I switch jobs?',
    };
    render(
      <ViewerReadingPanel {...baseProps} entry={echoEntry} decrypted={false} decryptedContent="" />,
    );
    expect(screen.queryByTestId('viewer-echo-preface')).toBeNull();
  });
});
