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

describe('MobilePastTimelineEntry', () => {
  it('cleans generated titles and tag prefixes while keeping full dates', () => {
    render(
      <MobilePastTimelineEntry entry={makeEntry('今天保存了一段录音。')} language="zh" />,
    );

    expect(screen.getByText(/2026年7月6日/)).not.toBeNull();
    expect(screen.queryByText('2026年7月6日13点45分')).toBeNull();
    expect(screen.getByText('今天保存了一段录音。')).not.toBeNull();
    expect(screen.getByText('感动')).not.toBeNull();
    expect(screen.getByText('个人成长')).not.toBeNull();
  });

  it('collapses body text over 200 chars and can expand it', () => {
    const longText = '经历'.repeat(110);
    render(<MobilePastTimelineEntry entry={makeEntry(longText)} language="zh" />);

    expect(screen.getByText('展开全文')).not.toBeNull();
    fireEvent.click(screen.getByText('展开全文'));
    expect(screen.getByText('收起')).not.toBeNull();
    expect(screen.getByText(longText)).not.toBeNull();
  });

  it('marks the latest record when highlighted', () => {
    const { container } = render(
      <MobilePastTimelineEntry entry={makeEntry('刚刚写入。')} highlight language="zh" />,
    );

    expect(screen.getByText('最新写入')).not.toBeNull();
    expect(container.querySelector('.mobile-past-timeline__item--latest')).not.toBeNull();
  });
});
