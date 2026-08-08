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
  it('cleans generated titles and tag prefixes while keeping full dates', () => {
    renderEntry(makeEntry('今天保存了一段录音。'));

    expect(screen.getByText(/2026年7月6日/)).not.toBeNull();
    expect(screen.queryByText('2026年7月6日13点45分')).toBeNull();
    expect(screen.queryByText('感动')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开记录内容' }));
    expect(screen.getByText('感动')).not.toBeNull();
    expect(screen.getByText('个人成长')).not.toBeNull();
  });

  it('collapses body text over 100 chars and can expand it', () => {
    const longText = '记'.repeat(101);
    renderEntry(makeEntry(longText));

    expect(screen.getByText(`${'记'.repeat(100)}…`)).not.toBeNull();
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
    expect(screen.getByRole('button', { name: '展开记录内容' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('marks the latest record and exposes its timeline timestamp', () => {
    const { container } = renderEntry(makeEntry('刚刚写入。'), { highlight: true });

    expect(screen.getByText('最新写入')).not.toBeNull();
    const navigator = container.querySelector('.mobile-past-timeline__navigator');
    expect(navigator?.getAttribute('datetime')).toBe('2026-07-06T05:45:00.000Z');
    expect(navigator?.textContent).toContain('07.06');
  });

  it('uses one symbol control and removes the record detail action', () => {
    renderEntry(makeEntry('今天保存了一段录音。'));

    expect(screen.queryByRole('button', { name: '查看记录' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '展开记录内容' }).textContent).toBe('');
  });
});
