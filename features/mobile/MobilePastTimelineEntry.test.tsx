import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobilePastTimelineEntry } from './MobilePastTimelineEntry';
import type { DiaryEntry } from '../../types';

const makeEntry = (content: string): DiaryEntry => ({
  id: 'entry-mobile-timeline',
  title: '2026年7月6日13点45分',
  content,
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:感动', '事件:个人成长'],
  isLocked: false,
});

const renderEntry = (entry: DiaryEntry, options?: { highlight?: boolean }) =>
  render(<MobilePastTimelineEntry entry={entry} highlight={options?.highlight} language="zh" />);

describe('MobilePastTimelineEntry', () => {
  it('shows cleaned tags directly below the content with a compact timestamp', () => {
    const { container } = renderEntry(makeEntry('今天保存了一段录音。'));

    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-06T05:45:00.000Z',
    );
    expect(screen.queryByText('2026年7月6日13点45分')).toBeNull();
    expect(screen.getByText('感动')).not.toBeNull();
    expect(screen.getByText('个人成长')).not.toBeNull();
    expect(screen.queryByText('心情:感动')).toBeNull();
    expect(screen.queryByText('事件:个人成长')).toBeNull();

    const content = container.querySelector('.mobile-past-timeline__content');
    const tags = container.querySelector('.mobile-past-timeline__tags');
    expect(content).not.toBeNull();
    expect(tags).not.toBeNull();
    expect(
      content?.compareDocumentPosition(tags as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps original text intact while toggling the line preview', () => {
    const longText = '记'.repeat(101);
    renderEntry(makeEntry(longText));

    expect(screen.getByText(longText)).not.toBeNull();
    expect(screen.queryByText('展开全文')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开记录内容' }));
    expect(screen.getByText(longText)).not.toBeNull();
    expect(screen.getByRole('button', { name: '收起记录内容' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('shows images, videos and links before the record is expanded', () => {
    const entry = makeEntry('包含媒体的记录。');
    entry.attachment = {
      type: 'image',
      name: '现场照片.png',
      data: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
    };
    entry.nowMaterials = [
      {
        id: 'video-1',
        type: 'video',
        url: 'data:video/mp4;base64,BBBB',
        meta: { title: '现场视频' },
        sort_order: 0,
      },
      {
        id: 'link-1',
        type: 'link',
        url: 'https://example.com',
        meta: { title: '参考链接' },
        sort_order: 1,
      },
    ];

    const { container } = renderEntry(entry);

    expect(screen.getByAltText('现场照片.png')).not.toBeNull();
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.getByRole('link', { name: '参考链接' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '展开记录内容' })).toBeNull();
  });

  it('shows one timestamp without a redundant latest badge', () => {
    const { container } = renderEntry(makeEntry('刚刚写入。'), { highlight: true });

    expect(screen.queryByText('最新写入')).toBeNull();
    expect(container.querySelectorAll('time')).toHaveLength(1);
    expect(container.querySelector('.mobile-past-timeline__time')).toBeNull();
    const navigator = container.querySelector('.past-record__date');
    expect(navigator?.getAttribute('datetime')).toBe('2026-07-06T05:45:00.000Z');
    expect(navigator?.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('does not show a detail action or expand control for a short record', () => {
    renderEntry(makeEntry('今天保存了一段录音。'));

    expect(screen.queryByRole('button', { name: '查看记录' })).toBeNull();
    expect(screen.queryByRole('button', { name: '展开记录内容' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
