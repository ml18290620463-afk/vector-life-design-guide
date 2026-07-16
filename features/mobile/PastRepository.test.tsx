import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PastRepository } from './PastRepository';
import type { DiaryEntry } from '../../types';

afterEach(cleanup);

const makeVideoEntry = (): DiaryEntry => ({
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
});

describe('PastRepository', () => {
  it('renders uploaded video materials as playable controls', () => {
    const { container } = render(
      <PastRepository
        language="zh"
        entries={[makeVideoEntry()]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.controls).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.getAttribute('src')).toBe('data:video/mp4;base64,AAAA');
    expect(screen.queryByText('clip.mp4')).toBeNull();
    expect(screen.queryByText('视频素材')).toBeNull();
  });

  it('renders recorded audio as the original audio player without labels', () => {
    const { container } = render(
      <PastRepository
        language="zh"
        entries={[
          {
            ...makeVideoEntry(),
            id: 'entry-audio',
            title: '录音记录',
            content: '今天保存了一段录音。',
            nowMaterials: [
              {
                id: 'audio-1',
                type: 'audio',
                url: 'data:audio/webm;base64,BBBB',
                local_path: 'voice.webm',
                meta: { title: '录音 5s', duration_ms: 5000 },
                sort_order: 0,
              },
            ],
          },
        ]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.controls).toBe(true);
    expect(audio?.getAttribute('preload')).toBe('metadata');
    expect(audio?.getAttribute('src')).toBe('data:audio/webm;base64,BBBB');
    expect(screen.getByText('▶ 播放录音')).not.toBeNull();
    expect(screen.queryByText('录音 5s')).toBeNull();
    expect(screen.queryByText('voice.webm')).toBeNull();
    expect(screen.queryByText('录音素材')).toBeNull();
  });

  it('shows only audio when an audio record has no body text', () => {
    const { container } = render(
      <PastRepository
        language="zh"
        entries={[
          {
            ...makeVideoEntry(),
            id: 'entry-audio-only',
            title: '2026年7月6日13点45分',
            content: '\n素材:\n- audio: 录音 5s',
            nowMaterials: [
              {
                id: 'audio-only',
                type: 'audio',
                url: 'data:audio/webm;base64,DDDD',
                sort_order: 0,
              },
            ],
          },
        ]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    expect(container.querySelector('audio')).not.toBeNull();
    expect(screen.queryByText('（无正文）')).toBeNull();
    expect(screen.queryByText('(empty)')).toBeNull();
    expect(screen.queryByText(/audio:/i)).toBeNull();
  });

  it('renders timeline time with year, month and day', () => {
    render(
      <PastRepository
        language="zh"
        entries={[makeVideoEntry()]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    expect(screen.getByText(/2026年7月6日/)).not.toBeNull();
  });

  it('renders legacy audio attachments as playable original audio', () => {
    const { container } = render(
      <PastRepository
        language="zh"
        entries={[
          {
            ...makeVideoEntry(),
            id: 'entry-attachment-audio',
            title: '旧录音记录',
            content: '旧数据里保存了一段录音。',
            nowMaterials: [],
            attachment: {
              type: 'audio',
              data: 'data:audio/mp3;base64,CCCC',
              name: 'old-audio.mp3',
              mimeType: 'audio/mp3',
            },
          },
        ]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('data:audio/mp3;base64,CCCC');
    expect(screen.queryByText('old-audio.mp3')).toBeNull();
  });

  it('restores playable audio from legacy material data urls', () => {
    const { container } = render(
      <PastRepository
        language="zh"
        entries={[
          {
            ...makeVideoEntry(),
            id: 'entry-legacy-audio-line',
            title: '旧录音行',
            content: '\n素材:\n- audio: data:audio/webm;base64,EEEE',
            nowMaterials: undefined,
          },
        ]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('data:audio/webm;base64,EEEE');
    expect(screen.getByText('▶ 播放录音')).not.toBeNull();
    expect(screen.queryByText(/audio:/i)).toBeNull();
  });

  it('renders links as title cards without legacy link prefixes', () => {
    render(
      <PastRepository
        language="zh"
        entries={[
          {
            ...makeVideoEntry(),
            id: 'entry-link',
            title: '链接记录',
            content: '\n素材:\n- link: https://example.com/article',
            nowMaterials: [
              {
                id: 'link-1',
                type: 'link',
                url: 'https://example.com/page',
                meta: { title: '一篇值得保存的文章' },
                sort_order: 0,
              },
            ],
          },
        ]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    expect(screen.getByText('一篇值得保存的文章')).not.toBeNull();
    expect(screen.getByText('https://example.com/article')).not.toBeNull();
    expect(screen.queryByText(/link:/i)).toBeNull();
  });

  it('supports the same distillation workflow on mobile past', () => {
    const onAddPrinciple = vi.fn();
    render(
      <PastRepository
        language="zh"
        entries={[makeVideoEntry()]}
        principles={[]}
        onAddPrinciple={onAddPrinciple}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '经验' }));
    expect(screen.getByText('把记录变成原则')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /确认记忆/ }));
    expect(onAddPrinciple).toHaveBeenCalledWith('重要经验先写场景目标动作结果', 2026, true, [
      'entry-video',
    ]);
  });

  it('collects principle feedback in the context of a newly saved record', () => {
    const onUpdateEntry = vi.fn();
    const onUpdatePrinciple = vi.fn();
    const principle = {
      id: 'principle-1',
      text: '重要沟通前先定义目标',
      year: 2026,
      createdAt: 1,
      showOnHome: true,
      confidence: 0.5,
    };
    const entry = {
      ...makeVideoEntry(),
      relatedPrincipleIds: [principle.id],
    };

    render(
      <PastRepository
        language="zh"
        entries={[entry]}
        principles={[principle]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdateEntry={onUpdateEntry}
        onUpdatePrinciple={onUpdatePrinciple}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '有效' }));

    expect(onUpdateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        principleFeedback: [
          expect.objectContaining({ principleId: principle.id, outcome: 'helpful' }),
        ],
      }),
    );
    expect(onUpdatePrinciple).toHaveBeenCalledWith(
      expect.objectContaining({ id: principle.id, confidence: 0.62, helpfulCount: 1 }),
    );
  });

  it('keeps semantic recalls collapsed until the user chooses to explore them', () => {
    const onSelectEntry = vi.fn();
    const relatedEntry = {
      ...makeVideoEntry(),
      id: 'related-entry',
      title: '过去的项目沟通',
      createdAt: 1,
    };
    const latestEntry = {
      ...makeVideoEntry(),
      id: 'latest-entry',
      createdAt: 2,
      relatedEntryIds: [relatedEntry.id],
    };

    render(
      <PastRepository
        language="zh"
        entries={[latestEntry, relatedEntry]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={onSelectEntry}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '查看关联经验 过去的项目沟通' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /已关联到过去 1 条经验/ }));
    fireEvent.click(screen.getByRole('button', { name: '查看关联经验 过去的项目沟通' }));

    expect(onSelectEntry).toHaveBeenCalledWith(relatedEntry);
  });

  it('guides newly saved records from timeline into distillation', () => {
    render(
      <PastRepository
        language="zh"
        entries={[makeVideoEntry()]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    expect(screen.getByText('下一步')).not.toBeNull();
    expect(screen.getByText('最新写入')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '去提炼' }));

    expect(screen.getByText('把记录变成原则')).not.toBeNull();
  });

  it('opens record details from a clear timeline action', () => {
    const onSelectEntry = vi.fn();
    const entry = makeVideoEntry();
    render(
      <PastRepository
        language="zh"
        entries={[entry]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={onSelectEntry}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '查看记录 视频记录' }));
    expect(onSelectEntry).toHaveBeenCalledWith(entry);
  });

  it('groups distillation and the principles library under experience', () => {
    render(
      <PastRepository
        language="zh"
        entries={[makeVideoEntry()]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '经验' }));
    expect(screen.getByRole('tab', { name: /待提炼/ })).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /原则库/ }));
    expect(screen.getByText('原则库')).not.toBeNull();
  });

  it('opens the full archive filter hub on mobile', () => {
    render(
      <PastRepository
        language="zh"
        entries={[{ ...makeVideoEntry(), isArchived: true }]}
        principles={[]}
        onAddPrinciple={vi.fn()}
        onDeletePrinciple={vi.fn()}
        onUpdatePrinciple={vi.fn()}
        onSelectEntry={vi.fn()}
        containers={[{ id: 'container-1', name: '成长', createdAt: 1 }]}
        onAddContainer={vi.fn()}
        onDeleteContainer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '归档' }));
    fireEvent.click(screen.getByRole('button', { name: '打开归档筛选' }));

    expect(screen.getByText('存储包 / 容器')).not.toBeNull();
    expect(screen.getByText('标签云集')).not.toBeNull();
    expect(screen.getByText('时间维度')).not.toBeNull();
    expect(screen.getByText('全量星图')).not.toBeNull();
    expect(screen.getByText('成长')).not.toBeNull();
  });
});
