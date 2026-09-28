import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PastRepository } from './PastRepository';
import type { DiaryEntry, PatternPrincipleLink, Principle } from '../../types';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

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

const renderArchiveRepository = (...args: Parameters<typeof renderRepository>) =>
  renderRepository(args[0], args[1], args[2], args[3], { ...args[4], archiveMode: true });

const renderRepository = (
  entries: DiaryEntry[],
  onAddPrinciple = vi.fn(),
  principles: Principle[] = [],
  patternPrincipleLinks: PatternPrincipleLink[] = [],
  handlers: Partial<ComponentProps<typeof PastRepository>> = {},
) =>
  render(
    <PastRepository
      language="zh"
      entries={entries}
      principles={principles}
      onAddPrinciple={onAddPrinciple}
      onDeletePrinciple={vi.fn()}
      onUpdatePrinciple={vi.fn()}
      patternPrincipleLinks={patternPrincipleLinks}
      onSelectEntry={vi.fn()}
      onDeleteEntries={vi.fn()}
      {...handlers}
    />,
  );

describe('PastRepository', () => {
  it('keeps only records in the past time view', () => {
    renderRepository([makeEntry()]);

    expect(screen.getByRole('tab', { name: '回看' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '沉淀' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: '记录' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '模式' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '原则' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '记忆' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '归档' })).toBeNull();
  });

  it('keeps the distillation page result-first and reveals only a clean principle editor', () => {
    renderRepository([makeEntry()], vi.fn(), [
      {
        id: 'principle-1',
        text: '先确认事实，再作判断',
        year: 2026,
        createdAt: 1,
        showOnHome: true,
      },
    ]);

    fireEvent.click(screen.getByRole('tab', { name: '沉淀' }));
    expect(screen.getByText('我的原则')).toBeTruthy();
    expect(screen.getByText('先确认事实，再作判断')).toBeTruthy();
    expect(screen.queryByLabelText('刻录新原则')).toBeNull();
    expect(screen.queryByText('待沉淀的模式')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '写原则' }));
    expect(screen.getByRole('dialog', { name: '书写原则' })).toBeTruthy();
    expect(screen.getByLabelText('刻录新原则')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确定' })).toBeTruthy();
    expect(screen.queryByText('先确认事实，再作判断')).toBeNull();
    expect(screen.queryByText('待沉淀的模式')).toBeNull();
    expect(screen.queryByText('关联模式（可选）')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(screen.queryByLabelText('刻录新原则')).toBeNull();
    expect(screen.queryByText('待沉淀的模式')).toBeNull();
    expect(screen.getByText('先确认事实，再作判断')).toBeTruthy();
  });

  it('renders legacy archived records in the unified timeline', () => {
    renderRepository([makeEntry({ isArchived: true, title: '旧项目复盘' })]);

    expect(screen.getByText('旧项目复盘')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '查看记录' })).toBeNull();
    expect(screen.queryByRole('button', { name: '展开记录内容' })).toBeNull();
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

  it('keeps related knowledge and states that result after bulk deletion', async () => {
    const onDeleteEntries = vi.fn();
    renderRepository(
      [
        makeEntry({ id: 'first', title: '第一条记录' }),
        makeEntry({ id: 'second', title: '第二条记录' }),
      ],
      vi.fn(),
      [],
      [],
      { onDeleteEntries },
    );

    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    expect(screen.getByText('已选 2 条')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '删除 2 条' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(onDeleteEntries).toHaveBeenCalledWith(expect.arrayContaining(['first', 'second']), true);
    });
    expect(await screen.findByText('已删除 2 条记录；相关模式和原则已保留。')).toBeTruthy();
  });

  it('limits select all to the current search result', () => {
    const onDeleteEntries = vi.fn();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderRepository(
      [
        makeEntry({ id: 'match', title: '项目复盘' }),
        makeEntry({ id: 'hidden', title: '生活随笔' }),
      ],
      vi.fn(),
      [],
      [],
      { onDeleteEntries },
    );

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记录' }), {
      target: { value: '项目' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    fireEvent.click(screen.getByRole('button', { name: '删除 1 条' }));

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDeleteEntries).toHaveBeenCalledWith(['match'], true);
  });

  it('clears related knowledge and states that result when retention is declined', async () => {
    const onDeleteEntries = vi.fn();
    renderRepository([makeEntry({ id: 'source', title: '来源记录' })], vi.fn(), [], [], {
      onDeleteEntries,
    });

    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    fireEvent.click(screen.getByRole('button', { name: '删除 1 条' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '保留相关模式和原则' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(onDeleteEntries).toHaveBeenCalledWith(['source'], false);
    });
    expect(await screen.findByText('已删除 1 条记录；相关模式和原则已同步清理。')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '沉淀' }));
    expect(
      screen.getByText('关联经历已删除，原有原则已同步清理。新的理解会在回看中慢慢沉淀。'),
    ).toBeTruthy();
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
    expect(document.querySelector('.mobile-past-timeline__item--latest')).not.toBeNull();
  });

  it('keeps playable material inline without exposing distillation controls', () => {
    const { container } = renderRepository([makeEntry()]);

    const video = container.querySelector('video');
    expect(video?.controls).toBe(true);
    expect(screen.queryByRole('button', { name: '展开记录内容' })).toBeNull();
    expect(screen.queryByText('回顾与提炼')).toBeNull();
    expect(screen.queryByRole('button', { name: '进入经验提炼' })).toBeNull();
  });

  it('opens the principles library directly', () => {
    renderArchiveRepository([makeEntry()]);

    fireEvent.click(screen.getByRole('tab', { name: '原则' }));
    expect(screen.getByRole('heading', { name: '公理圣殿 // 存在之锚' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: /待提炼/ })).toBeNull();
  });

  it('automatically extracts a pending pattern from two similar records with a light record drawer', () => {
    const entries = [
      makeEntry({
        id: 'prepare-one',
        title: '演示前准备',
        content: '我提前整理了所有材料。',
        tags: [],
      }),
      makeEntry({
        id: 'prepare-two',
        title: '出发前确认',
        content: '我提前确认了路线和时间。',
        tags: [],
        createdAt: Date.parse('2026-07-07T13:45:00+08:00'),
      }),
    ];

    renderArchiveRepository(entries);
    fireEvent.click(screen.getByRole('tab', { name: '模式' }));

    expect(screen.getByRole('status').textContent).toContain('候选 1 · 记录 2');
    expect(screen.getByText('候选')).not.toBeNull();
    expect(screen.getByLabelText('候选 · 强化')).not.toBeNull();
    expect(screen.getByText('出现 2 次')).not.toBeNull();
    expect(screen.queryByText('行为 · 行动前准备')).toBeNull();
    expect(screen.getByText(/面对重要任务或沟通时，你会先整理、确认或规划/)).not.toBeNull();
    expect(screen.getByRole('button', { name: '刷新' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '查看依据' }));
    expect(screen.getByText('结果')).not.toBeNull();
    expect(screen.getByText('行动中的不确定性因此降低')).not.toBeNull();
    expect(screen.getByRole('button', { name: /演示前准备/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /出发前确认/ })).not.toBeNull();
  });

  it('keeps pattern source records lightweight on mobile', () => {
    const entries = [
      makeEntry({
        id: 'prepare-one',
        title: '2026年7月6日21点18分',
        content: '我提前整理了所有材料。',
        tags: [],
      }),
      makeEntry({
        id: 'prepare-two',
        title: '出发前确认',
        content: '我提前确认了路线和时间。',
        tags: [],
        createdAt: Date.parse('2026-07-07T13:45:00+08:00'),
      }),
      makeEntry({
        id: 'prepare-three',
        title: '第三次准备',
        content: '我提前列出了讨论重点。',
        tags: [],
        createdAt: Date.parse('2026-07-08T13:45:00+08:00'),
      }),
    ];

    renderArchiveRepository(entries);
    fireEvent.click(screen.getByRole('tab', { name: '模式' }));
    fireEvent.click(screen.getByRole('button', { name: '查看依据' }));

    expect(screen.getByRole('button', { name: /第三次准备/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /出发前确认/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /我提前整理了所有材料。/ })).toBeNull();
    expect(screen.getByText('还有 1 条')).not.toBeNull();
  });

  it('does not label a single occurrence as a pattern', () => {
    renderArchiveRepository([
      makeEntry({
        id: 'prepare-once',
        title: '一次准备',
        content: '我提前整理了材料。',
        tags: [],
      }),
    ]);

    fireEvent.click(screen.getByRole('tab', { name: '模式' }));

    expect(screen.getByText('候选 0 · 记录 1')).not.toBeNull();
    expect(screen.getByText('相似情境与反应出现两次后，将形成候选模式。')).not.toBeNull();
  });

  it('sends a confirmed pattern to the dedicated principle workspace', () => {
    const onAddPrinciple = vi.fn();
    renderArchiveRepository(
      [
        makeEntry({
          id: 'prepare-one',
          title: '演示前准备',
          content: '我提前整理了所有材料。',
          tags: [],
        }),
        makeEntry({
          id: 'prepare-two',
          title: '出发前确认',
          content: '我提前确认了路线和时间。',
          tags: [],
        }),
      ],
      onAddPrinciple,
    );

    fireEvent.click(screen.getByRole('tab', { name: '模式' }));
    fireEvent.click(screen.getByRole('button', { name: '确认模式' }));
    expect(screen.getByText('已确认')).not.toBeNull();
    expect(screen.getByLabelText('已确认 · 强化')).not.toBeNull();
    expect(screen.getByText('出现 2 次')).not.toBeNull();
    expect(screen.queryByLabelText('刻录新原则')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '萃取原则' }));
    expect(screen.getByRole('button', { name: '萃取' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText('刻录新原则')).not.toBeNull();
    expect(
      (screen.getByLabelText(/面对重要任务或沟通时，你会先整理、确认或规划/) as HTMLInputElement)
        .checked,
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('刻录新原则'), {
      target: { value: '先准备再行动' },
    });
    fireEvent.click(screen.getByRole('button', { name: '刻录新原则' }));
    expect(onAddPrinciple).toHaveBeenCalledWith(
      '先准备再行动',
      expect.any(Number),
      true,
      undefined,
      undefined,
      [expect.any(String)],
      [],
    );
  });

  it('explains when a retained pattern no longer has its source records', () => {
    localStorage.setItem(
      'vector:avatar:understandings:v1',
      JSON.stringify([
        {
          id: 'retained-pattern',
          statement: '在重要决定前，你会先为自己留出一点重新判断的空间。',
          status: 'confirmed',
          sourceEntryIds: [],
          createdAt: 1,
          retainedAfterSourceDeletion: true,
          summaryKind: 'past-pattern',
        },
      ]),
    );
    renderArchiveRepository([]);

    expect(screen.getByText('原始记录已删除')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '查看依据' }));
    expect(screen.getByText('这是保留的理解，原始记录已删除。')).not.toBeNull();
    expect(screen.queryByText('出现 0 次')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '萃取原则' }));
    expect(screen.getByLabelText('刻录新原则')).not.toBeNull();
    expect(
      (
        screen.getByLabelText(
          /在重要决定前，你会先为自己留出一点重新判断的空间。/,
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('does not repeat linked principle content inside a pattern card', () => {
    renderArchiveRepository(
      [
        makeEntry({
          id: 'prepare-one',
          title: '演示前准备',
          content: '我提前整理了所有材料。',
          tags: [],
        }),
        makeEntry({
          id: 'prepare-two',
          title: '出发前确认',
          content: '我提前确认了路线和时间。',
          tags: [],
        }),
      ],
      vi.fn(),
      [{ id: 'principle-1', text: '先做最小步骤', year: 2026, createdAt: 1, showOnHome: true }],
      [
        {
          id: 'link-1',
          patternId: 'pattern-b0vcyv',
          principleId: 'principle-1',
          relation: 'adjust',
          status: 'confirmed',
          createdBy: 'user',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    );

    fireEvent.click(screen.getByRole('tab', { name: '模式' }));
    fireEvent.click(screen.getByRole('button', { name: '确认模式' }));

    expect(screen.queryByText('先做最小步骤')).toBeNull();
    expect(screen.queryByText('已回应')).toBeNull();
    expect(screen.queryByRole('button', { name: '调整' })).toBeNull();
    expect(screen.queryByRole('button', { name: '写原则' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关联原则' })).toBeNull();
    expect(screen.getByRole('button', { name: '萃取原则' })).not.toBeNull();
  });

  it('keeps relationship metrics in the background while showing the evolution result', () => {
    const entries = [
      makeEntry({
        id: 'prepare-one',
        title: '演示前准备',
        content: '我提前整理了所有材料。',
        tags: [],
      }),
      makeEntry({
        id: 'prepare-two',
        title: '出发前确认',
        content: '我提前确认了路线和时间。',
        tags: [],
      }),
      makeEntry({
        id: 'feedback-one',
        title: '原则验证',
        content: '今天先准备再行动，推进顺利。',
        tags: [],
        principleFeedback: [
          { principleId: 'principle-1', outcome: 'helpful', createdAt: 300 },
          { principleId: 'principle-1', outcome: 'unhelpful', createdAt: 400 },
        ],
      }),
    ];

    renderArchiveRepository(
      entries,
      vi.fn(),
      [
        {
          id: 'principle-1',
          text: '先做最小步骤',
          year: 2026,
          createdAt: 1,
          showOnHome: true,
        },
      ],
      [
        {
          id: 'link-1',
          patternId: 'pattern-b0vcyv',
          principleId: 'principle-1',
          relation: 'adjust',
          status: 'confirmed',
          createdBy: 'user',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    );

    fireEvent.click(screen.getByRole('tab', { name: '模式' }));
    fireEvent.click(screen.getByRole('button', { name: '确认模式' }));

    expect(screen.getByLabelText('已确认 · 转变中')).not.toBeNull();
    expect(screen.queryByText('回应 1')).toBeNull();
    expect(screen.queryByText('验证 1')).toBeNull();
    expect(screen.queryByText('复核 1')).toBeNull();
    expect(screen.queryByText('先做最小步骤')).toBeNull();
  });

  it('keeps pattern-principle mapping actions out of the principles display', () => {
    const onAddPatternPrincipleLink = vi.fn();
    const onUpdatePrinciple = vi.fn();
    renderArchiveRepository(
      [
        makeEntry({
          id: 'prepare-one',
          title: '演示前准备',
          content: '我提前整理了所有材料。',
          tags: [],
        }),
        makeEntry({
          id: 'prepare-two',
          title: '出发前确认',
          content: '我提前确认了路线和时间。',
          tags: [],
        }),
      ],
      vi.fn(),
      [
        {
          id: 'principle-1',
          text: '先做最小步骤',
          year: 2026,
          createdAt: 1,
          showOnHome: true,
        },
      ],
      [],
      { onAddPatternPrincipleLink, onUpdatePrinciple },
    );

    fireEvent.click(screen.getByRole('tab', { name: '模式' }));
    fireEvent.click(screen.getByRole('button', { name: '确认模式' }));
    fireEvent.click(screen.getByRole('tab', { name: '原则' }));
    fireEvent.click(screen.getByRole('button', { name: '未分类' }));

    expect(screen.queryByRole('button', { name: /调整回应：先做最小步骤/ })).toBeNull();
    expect(screen.queryByText(/面对重要任务或沟通时，你会先整理、确认或规划/)).toBeNull();
    expect(onAddPatternPrincipleLink).not.toHaveBeenCalled();
    expect(onUpdatePrinciple).not.toHaveBeenCalled();
  });
});

describe('Past deletion safety', () => {
  it('cancel leaves records and selection intact; failed deletion can be retried', async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error('删除失败，请重试'))
      .mockResolvedValueOnce(undefined);
    renderRepository([makeEntry()], vi.fn(), [], [], { onDeleteEntries: remove });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    fireEvent.click(screen.getByRole('button', { name: '删除 1 条' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '删除 1 条' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain(
        '删除失败',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(remove).toHaveBeenLastCalledWith(['entry-video'], true);
  });
  it('clears selection when search changes so hidden records cannot be deleted', () => {
    renderRepository([makeEntry()]);
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    fireEvent.change(
      within(screen.getByRole('dialog', { name: '管理记录' })).getByRole('searchbox'),
      { target: { value: '没有匹配' } },
    );
    expect(screen.queryByRole('button', { name: '删除 1 条' })).toBeNull();
  });
});
