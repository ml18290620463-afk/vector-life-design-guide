import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PastRepository } from './PastRepository';
import type { DiaryEntry, Principle } from '../../types';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const makeEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: 'entry-video',
  title: '视频记录',
  content: '今天上传了一个视频。',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:平静', '事件:个人成长'],
  isLocked: false,
  ...overrides,
});

const renderRepository = ({
  entries = [makeEntry()],
  principles = [],
  onAddPrinciple = vi.fn(),
  onDeleteEntries = vi.fn(),
  onUpdatePrinciple = vi.fn(),
  onDeletePrinciple = vi.fn(),
}: {
  entries?: DiaryEntry[];
  principles?: Principle[];
  onAddPrinciple?: ComponentProps<typeof PastRepository>['onAddPrinciple'];
  onDeleteEntries?: ComponentProps<typeof PastRepository>['onDeleteEntries'];
  onUpdatePrinciple?: ComponentProps<typeof PastRepository>['onUpdatePrinciple'];
  onDeletePrinciple?: ComponentProps<typeof PastRepository>['onDeletePrinciple'];
} = {}) =>
  render(
    <PastRepository
      language="zh"
      entries={entries}
      principles={principles}
      onAddPrinciple={onAddPrinciple}
      onDeletePrinciple={onDeletePrinciple}
      onUpdatePrinciple={onUpdatePrinciple}
      onSelectEntry={vi.fn()}
      onDeleteEntries={onDeleteEntries}
    />,
  );

describe('PastRepository', () => {
  it('keeps record cards free of action prompts and review annotations', () => {
    const onOpenFutureAction = vi.fn();
    render(
      <PastRepository
        language="zh"
        entries={[makeEntry({ id: 'decision', title: '项目复盘', content: '先确认事实' })]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        onDeleteEntries={vi.fn()}
        onOpenFutureAction={onOpenFutureAction}
      />,
    );
    expect(screen.queryByRole('button', { name: '作为行动依据' })).toBeNull();
    expect(screen.queryByText('事实回顾')).toBeNull();
    expect(screen.queryByText('显示 1 条记录')).toBeNull();
    expect(onOpenFutureAction).not.toHaveBeenCalled();
  });

  it('keeps past focused on review and user-maintained principles', () => {
    renderRepository();

    expect(screen.getByRole('tab', { name: '回看' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '我的原则' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: '模式' })).toBeNull();
    expect(screen.queryByText('提炼模式')).toBeNull();
    expect(screen.queryByText('萃取原则')).toBeNull();
    expect(screen.queryByText('与分身聊聊')).toBeNull();
  });

  it('searches records by title, content, and tags', () => {
    renderRepository({
      entries: [
        makeEntry({ id: 'matched', title: '长期项目', content: '关键决策证据', tags: ['证据'] }),
        makeEntry({ id: 'other', title: '其他记录', content: '无关内容' }),
      ],
    });
    const search = screen.getByRole('searchbox', { name: '搜索记录' });

    fireEvent.change(search, { target: { value: '关键决策' } });
    expect(screen.getByText('长期项目')).toBeTruthy();
    expect(screen.queryByText('其他记录')).toBeNull();

    fireEvent.change(search, { target: { value: '证据' } });
    expect(screen.getByText('长期项目')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect((search as HTMLInputElement).value).toBe('');
  });

  it('renders large result sets in bounded batches while keeping the full result count', () => {
    const entries = Array.from({ length: 101 }, (_, index) =>
      makeEntry({
        id: `entry-${index}`,
        title: `记录 ${index}`,
        createdAt: index,
        updatedAt: index,
      }),
    );
    renderRepository({ entries });

    expect(screen.getByRole('tab', { name: '回看' }).textContent).toContain('101');
    expect(screen.getByText('记录 100')).toBeTruthy();
    expect(screen.queryByText('记录 0')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '加载更多（剩余 1 条）' }));
    expect(screen.getByText('记录 0')).toBeTruthy();
  });

  it('does not expand record search through a linked principle', () => {
    renderRepository({
      entries: [
        makeEntry({ id: 'principle-source', title: '一次复盘', content: '保留原始观察' }),
        makeEntry({ id: 'unrelated', title: '其他记录', content: '无关内容' }),
      ],
      principles: [
        {
          id: 'principle-evidence',
          text: '先确认事实，再作判断',
          tags: ['决策'],
          year: 2026,
          createdAt: 1,
          showOnHome: true,
          derivedFromEntryIds: ['principle-source'],
        },
      ],
    });

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记录' }), {
      target: { value: '确认事实' },
    });

    expect(screen.queryByLabelText('关联依据')).toBeNull();
    expect(screen.queryByText('一次复盘')).toBeNull();
    expect(screen.queryByText('其他记录')).toBeNull();
  });

  it('matches record content and tags without following stored action links', () => {
    renderRepository({
      entries: [
        makeEntry({ id: 'linked', title: '周一记录', relatedActionIds: ['action-1'] }),
        makeEntry({ id: 'direct', title: '周五复盘', content: '项目复盘' }),
        makeEntry({ id: 'tagged', title: '生活随笔', tags: ['项目复盘'] }),
      ],
    });
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记录' }), {
      target: { value: '项目复盘' },
    });
    expect(screen.queryByLabelText('关联依据')).toBeNull();
    expect(screen.queryByText('周一记录')).toBeNull();
    expect(screen.getByText('周五复盘')).toBeTruthy();
    expect(screen.getByText('生活随笔')).toBeTruthy();
  });

  it('counts only current principles in the tab', () => {
    renderRepository({
      principles: [
        { id: 'old', text: '旧原则', year: 2025, createdAt: 1, showOnHome: true },
        {
          id: 'current',
          text: '新原则',
          year: 2026,
          createdAt: 2,
          showOnHome: true,
          supersedesPrincipleId: 'old',
          revisionKind: 'correction',
          revisedAt: 2,
        },
      ],
    });

    expect(screen.getByRole('tab', { name: '我的原则' }).textContent).toContain('1');
  });

  it('supports bulk deleting the current search result and explains retained understanding', async () => {
    const onDeleteEntries = vi.fn();
    renderRepository({
      entries: [
        makeEntry({ id: 'match', title: '项目复盘' }),
        makeEntry({ id: 'hidden', title: '生活随笔' }),
      ],
      onDeleteEntries,
    });

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记录' }), {
      target: { value: '项目' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    fireEvent.click(screen.getByRole('button', { name: '删除 1 条' }));
    expect(screen.getByLabelText('保留分身已形成的理解与我的原则')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(onDeleteEntries).toHaveBeenCalledWith(['match'], true));
    expect(
      await screen.findByText('已删除 1 条记录；分身已形成的理解与我的原则已保留。'),
    ).toBeTruthy();
  });

  it('keeps principle editing independent from avatar patterns', () => {
    const onAddPrinciple = vi.fn();
    renderRepository({ onAddPrinciple });

    fireEvent.click(screen.getByRole('tab', { name: '我的原则' }));
    fireEvent.click(screen.getByRole('button', { name: '写原则' }));
    expect(screen.getByRole('dialog', { name: '书写原则' })).toBeTruthy();
    expect(screen.queryByText('关联模式（可选）')).toBeNull();
    expect(screen.queryByText('待沉淀的模式')).toBeNull();
    expect(screen.queryByText('提炼模式')).toBeNull();

    fireEvent.change(screen.getByLabelText('刻录新原则'), {
      target: { value: '先确认事实，再作判断' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存原则' }));
    expect(onAddPrinciple).toHaveBeenCalledWith(
      '先确认事实，再作判断',
      expect.any(Number),
      true,
      undefined,
      undefined,
      undefined,
      [],
      [],
    );
  });

  it('shows saved principles and lets the user update them', () => {
    const onUpdatePrinciple = vi.fn();
    const principle: Principle = {
      id: 'principle-1',
      text: '先确认事实，再作判断',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
    };
    renderRepository({ principles: [principle], onUpdatePrinciple });

    fireEvent.click(screen.getByRole('tab', { name: '我的原则' }));
    expect(screen.getByText('先确认事实，再作判断')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '编辑原则：先确认事实，再作判断' }));
    fireEvent.change(screen.getByLabelText('编辑原则：先确认事实，再作判断'), {
      target: { value: '先核对事实，再作判断' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    expect(onUpdatePrinciple).toHaveBeenCalledWith({
      ...principle,
      text: '先核对事实，再作判断',
    });
  });
});
