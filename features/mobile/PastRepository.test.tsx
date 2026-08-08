import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PastRepository } from './PastRepository';
import type { DiaryEntry } from '../../types';

afterEach(cleanup);

const makeEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry-video',
  title: '视频记录',
  content: '今天上传了一个视频。',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:平静', '事件:个人成长'],
  isLocked: false,
  nowMaterials: [
    {
      id: 'video-1',
      type: 'video',
      url: 'data:video/mp4;base64,AAAA',
      local_path: 'clip.mp4',
      meta: { title: 'clip.mp4' },
      sort_order: 0,
    },
  ],
  ...overrides,
});

const renderRepository = (entries: DiaryEntry[]) =>
  render(
    <PastRepository
      language="zh"
      entries={entries}
      principles={[]}
      onAddPrinciple={vi.fn()}
      onDeletePrinciple={vi.fn()}
      onUpdatePrinciple={vi.fn()}
      onSelectEntry={vi.fn()}
    />,
  );

describe('PastRepository', () => {
  it('exposes only records and principles as top-level sections', () => {
    renderRepository([makeEntry()]);

    expect(screen.getByRole('tab', { name: '记录' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: '原则' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: '归档' })).toBeNull();
  });

  it('renders legacy archived records in the unified timeline', () => {
    renderRepository([makeEntry({ isArchived: true, title: '旧项目复盘' })]);

    expect(screen.getByText('旧项目复盘')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '查看记录' })).toBeNull();
    expect(screen.getByRole('button', { name: '展开记录内容' })).not.toBeNull();
  });

  it('searches unified records by title, content and tags and can clear the query', () => {
    renderRepository([
      makeEntry({ isArchived: true, title: '长期项目', content: '关键决策证据', tags: ['证据'] }),
      makeEntry({ id: 'other', title: '其他记录', content: '无关内容' }),
    ]);

    const search = screen.getByRole('searchbox', { name: '搜索记录' });

    fireEvent.change(search, { target: { value: '长期项目' } });
    expect(screen.getByText('长期项目')).not.toBeNull();
    expect(screen.queryByText('其他记录')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    fireEvent.change(search, {
      target: { value: '关键决策' },
    });
    expect(screen.getByText('长期项目')).not.toBeNull();
    expect(screen.queryByText('其他记录')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    fireEvent.change(search, { target: { value: '证据' } });
    expect(screen.getByText('长期项目')).not.toBeNull();
    expect(screen.queryByText('其他记录')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(screen.getByText('其他记录')).not.toBeNull();
    expect((search as HTMLInputElement).value).toBe('');
  });

  it('shows a distinct no-results message and does not mark a match as the latest write', () => {
    renderRepository([
      makeEntry({ id: 'latest', title: '今天的记录', createdAt: 200 }),
      makeEntry({ id: 'older', title: '旧日散步', createdAt: 100 }),
    ]);

    const search = screen.getByRole('searchbox', { name: '搜索记录' });
    fireEvent.change(search, { target: { value: '旧日' } });
    expect(screen.getByText('旧日散步')).not.toBeNull();
    expect(screen.queryByText('最新写入')).toBeNull();

    fireEvent.change(search, { target: { value: '不存在' } });
    expect(screen.getByRole('status').textContent).toContain('没有找到相关记录。');
    expect(screen.queryByText('还没有记录。请前往「现在」写入。')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(screen.getByText('最新写入')).not.toBeNull();
  });

  it('keeps playable material inline without exposing distillation controls', () => {
    const { container } = renderRepository([makeEntry()]);

    const video = container.querySelector('video');
    expect(video?.controls).toBe(true);
    expect(screen.getByRole('button', { name: '展开记录内容' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.queryByText('回顾与提炼')).toBeNull();
    expect(screen.queryByRole('button', { name: '进入经验提炼' })).toBeNull();
  });

  it('opens the principles library directly', () => {
    renderRepository([makeEntry()]);

    fireEvent.click(screen.getByRole('tab', { name: '原则' }));
    expect(screen.getByRole('heading', { name: '公理圣殿 // 存在之锚' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: /待提炼/ })).toBeNull();
  });
});
