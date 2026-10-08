import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../constants';
import { PastEntryPreview } from './PastEntryPreview';
import type { DiaryEntry } from '../types';

const makeEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'preview-entry',
  title: '2026年7月6日13点45分',
  content: '正文\n素材:\n- link: https://example.com',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:感动'],
  isLocked: false,
  ...overrides,
});

describe('PastEntryPreview', () => {
  it('composes the mobile record preview', () => {
    render(<PastEntryPreview entry={makeEntry()} variant="mobile" language="zh" />);

    expect(screen.getByText(/2026年7月6日/)).toBeTruthy();
    expect(screen.queryByText('2026年7月6日13点45分')).toBeNull();
    expect(screen.getByText('正文')).toBeTruthy();
    expect(screen.getByText('感动')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('composes the archive list preview with archive id, sample badge and lock state', () => {
    render(
      <PastEntryPreview
        entry={makeEntry({ title: '真实标题' })}
        variant="archive-list"
        theme="dark"
        archiveId="AR-26-PREV"
        isTimeLocked
        t={TRANSLATIONS.zh}
        sampleBadge={<span>Sample</span>}
      />,
    );

    expect(screen.getByText('真实标题')).toBeTruthy();
    expect(screen.getByText(/AR-26-PREV/)).toBeTruthy();
    expect(screen.getByText('Sample')).toBeTruthy();
    expect(screen.getByText(TRANSLATIONS.zh.encryptedRecord || 'RESTRICTED')).toBeTruthy();
  });

  it('composes the archive grid preview without mobile tags', () => {
    render(
      <PastEntryPreview
        entry={makeEntry({ title: 'Grid Title' })}
        variant="archive-grid"
        theme="dark"
      />,
    );

    expect(screen.getByText('Grid Title')).toBeTruthy();
    expect(screen.getByText('正文')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
    expect(screen.queryByText('感动')).toBeNull();
  });
});
