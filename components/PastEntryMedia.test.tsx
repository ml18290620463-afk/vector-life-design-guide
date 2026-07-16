import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PastEntryMedia } from './PastEntryMedia';
import type { DiaryEntry } from '../types';

const makeEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'media-entry',
  title: 'Media Entry',
  content: '正文\n素材:\n- audio: data:audio/webm;base64,BBBB\n- link: https://example.com',
  createdAt: Date.UTC(2026, 6, 13),
  tags: [],
  isLocked: false,
  nowMaterials: [
    {
      id: 'image-1',
      type: 'image',
      url: 'data:image/png;base64,AAAA',
      meta: { title: '图片素材' },
      sort_order: 0,
    },
    {
      id: 'audio-1',
      type: 'audio',
      url: 'data:audio/webm;base64,CCCC',
      meta: { title: '录音 5s' },
      sort_order: 1,
    },
  ],
  ...overrides,
});

describe('PastEntryMedia', () => {
  it('renders archive media with the archive class contract', () => {
    const { container } = render(<PastEntryMedia entry={makeEntry()} variant="archive" theme="dark" />);

    expect(container.querySelector('.archive-entry-media')).not.toBeNull();
    expect(screen.getByAltText('图片素材')).toBeTruthy();
    expect(container.querySelectorAll('audio')).toHaveLength(2);
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('renders mobile media with the mobile timeline class contract', () => {
    const { container } = render(
      <PastEntryMedia entry={makeEntry()} variant="mobile" language="zh" />,
    );

    expect(container.querySelector('.mobile-past-timeline__materials')).not.toBeNull();
    expect(container.querySelector('.mobile-past-image-gallery')).not.toBeNull();
    expect(container.querySelectorAll('audio')).toHaveLength(2);
    expect(screen.getByText('https://example.com')).toBeTruthy();
  });

  it('renders structured attachments in both variants', () => {
    const entry = makeEntry({
      content: '正文',
      nowMaterials: [],
      attachment: {
        type: 'image',
        name: 'photo.png',
        data: 'data:image/png;base64,DDDD',
        mimeType: 'image/png',
      },
    });
    const { container, rerender } = render(
      <PastEntryMedia entry={entry} variant="archive" theme="dark" />,
    );

    expect(screen.getByAltText('photo.png')).toBeTruthy();
    expect(container.querySelector('.archive-entry-media')).toBeNull();

    rerender(<PastEntryMedia entry={entry} variant="mobile" language="zh" />);
    expect(container.querySelector('.mobile-past-image-gallery')).not.toBeNull();
  });
});
