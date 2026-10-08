import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PastEntryBody, PastEntryTags, PastEntryTitle } from './PastEntryText';
import type { DiaryEntry } from '../types';

const makeEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'text-entry',
  title: '2026年7月6日13点45分',
  content: '正文\n素材:\n- audio: data:audio/webm;base64,AAAA',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:感动', '事件:个人成长'],
  isLocked: false,
  ...overrides,
});

describe('PastEntryText', () => {
  it('mobile title hides generated time titles but keeps the formatted timestamp', () => {
    render(<PastEntryTitle entry={makeEntry()} variant="mobile" language="zh" />);

    expect(screen.getByText(/2026年7月6日/)).toBeTruthy();
    expect(screen.queryByText('2026年7月6日13点45分')).toBeNull();
  });

  it('mobile body strips material appendix and keeps collapsible long text', () => {
    const longText = '经历'.repeat(110);
    render(
      <PastEntryBody
        entry={makeEntry({ content: `${longText}\n素材:\n- link: https://example.com` })}
        variant="mobile"
        language="zh"
      />,
    );

    expect(screen.queryByText(/素材/)).toBeNull();
    expect(screen.getByText('展开全文')).toBeTruthy();
    fireEvent.click(screen.getByText('展开全文'));
    expect(screen.getByText('收起')).toBeTruthy();
    expect(screen.getByText(longText)).toBeTruthy();
  });

  it('archive title and body use archive formatting without leaking materials', () => {
    render(
      <>
        <PastEntryTitle
          entry={makeEntry({ title: '真实标题' })}
          variant="archive-list"
          theme="dark"
          archiveId="AR-26-TEXT"
        />
        <PastEntryBody entry={makeEntry()} variant="archive-list" theme="dark" />
      </>,
    );

    expect(screen.getByText(/AR-26-TEXT/)).toBeTruthy();
    expect(screen.getByText('真实标题')).toBeTruthy();
    expect(screen.getByText('正文')).toBeTruthy();
    expect(screen.queryByText(/audio:/i)).toBeNull();
  });

  it('mobile tags strip category prefixes', () => {
    render(<PastEntryTags entry={makeEntry()} />);

    expect(screen.getByText('感动')).toBeTruthy();
    expect(screen.getByText('个人成长')).toBeTruthy();
    expect(screen.queryByText('心情:感动')).toBeNull();
  });
});
