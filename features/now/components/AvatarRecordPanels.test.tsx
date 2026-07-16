import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AvatarInsightPanel,
  AvatarRecallPanel,
  AvatarUnderstandingCard,
  RecordPreviewCard,
} from './AvatarRecordPanels';

describe('AvatarRecordPanels', () => {
  it('renders structured insight rows and tags', () => {
    render(
      <AvatarInsightPanel
        insight={{
          fact: '完成了一次复盘',
          action: '写下关键动作',
          feeling: '感动',
          thought: '',
          result: '更清楚下一步',
          moodTags: ['感动'],
          eventTags: ['个人成长'],
          completeness: 80,
          nextQuestion: null,
        }}
      />,
    );

    expect(screen.getByText('实时提炼')).not.toBeNull();
    expect(screen.getByText('80%')).not.toBeNull();
    expect(screen.getByText('完成了一次复盘')).not.toBeNull();
    expect(screen.getAllByText('感动').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('个人成长')).not.toBeNull();
  });

  it('renders top recalled memories only', () => {
    render(
      <AvatarRecallPanel
        memories={[
          { id: '1', sourceEntryId: '1', title: '记录一', excerpt: '第一条', tags: [], score: 3, createdAt: 1, reason: '关键词关联' },
          { id: '2', sourceEntryId: '2', title: '记录二', excerpt: '第二条', tags: [], score: 2, createdAt: 2, reason: '标签关联' },
          { id: '3', sourceEntryId: '3', title: '记录三', excerpt: '第三条', tags: [], score: 1, createdAt: 3, reason: '关键词关联' },
        ]}
      />,
    );

    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.getByText('第一条')).not.toBeNull();
    expect(screen.getByText('第二条')).not.toBeNull();
    expect(screen.queryByText('第三条')).toBeNull();
  });

  it('requires explicit confirmation before accepting an understanding', () => {
    const onResolve = vi.fn();
    render(<AvatarUnderstandingCard statement="你更看重可验证的进展" onResolve={onResolve} />);
    expect(screen.getByText('尚未写入长期记忆')).not.toBeNull();
    fireEvent.click(screen.getByText('确认'));
    expect(onResolve).toHaveBeenCalledWith('confirmed', '你更看重可验证的进展');
  });

  it('allows editing preview text before sending', () => {
    const onChange = vi.fn();
    const onSend = vi.fn();
    render(
      <RecordPreviewCard
        payload={{
          text: '原始记录',
          mood_tags: ['平静'],
          event_tags: ['个人成长'],
          record_time: '2026-07-06T13:45:00.000Z',
          display_time: '2026年7月6日13点45分',
          is_sparse: false,
        }}
        sending={false}
        onChange={onChange}
        onEditTags={vi.fn()}
        onSend={onSend}
      />,
    );

    fireEvent.click(screen.getByText('修改'));
    fireEvent.change(screen.getByDisplayValue('原始记录'), { target: { value: '修改后记录' } });
    fireEvent.click(screen.getByText('保存'));
    fireEvent.click(screen.getByText('发送过去'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '修改后记录',
      }),
    );
    expect(onSend).toHaveBeenCalled();
  });
});
