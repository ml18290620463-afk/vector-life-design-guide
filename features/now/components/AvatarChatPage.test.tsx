import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AvatarChatPage } from './AvatarChatPage';
import type { DiaryEntry } from '../../../types';
import type { NowDraft, RecordPreviewPayload } from '../types/now';
import {
  readAvatarAtomicMemories,
  writeAvatarAtomicMemory,
  writeAvatarSession,
} from '../../../services/avatarMemory';

const draft = (): NowDraft => ({
  text: '',
  materials: [],
  mood_tags: [],
  event_tags: [],
  record_time: '2026-07-09T10:30:00.000Z',
  display_time: '2026年7月9日10点30分',
  updated_at: '2026-07-09T10:30:00.000Z',
});

const entry = (): DiaryEntry => ({
  id: 'entry-1',
  title: '2026年7月6日13点45分',
  content: '今天客户方案被否定，我不开心。',
  createdAt: Date.parse('2026-07-06T13:45:00+08:00'),
  updatedAt: Date.parse('2026-07-06T13:45:00+08:00'),
  tags: ['心情:难过', '事件:职业发展'],
  isLocked: false,
});

describe('AvatarChatPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: '模型返回的回复' }) }),
    );
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders avatar assistant intro and accepts user input', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.getByText('说一件事。完成后生成记录。')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('输入想记录的内容'), {
      target: { value: '今天客户方案被否定，我不开心' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(screen.getAllByText('今天客户方案被否定，我不开心').length).toBeGreaterThan(0);
    expect(screen.getByText(/已识别：.*感受：难过/)).toBeTruthy();
    expect(screen.getByText(/找到过去：/)).toBeTruthy();
  });

  it('shows connection failures outside the dialogue and retries without duplicating the user message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'model_not_configured' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: '连接成功，继续聊吧。' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '叶子为什么是绿色？' },
    });
    fireEvent.click(screen.getByText('发送'));
    expect((await screen.findByRole('alert')).textContent).toContain('尚未连接语言模型');
    fireEvent.click(screen.getByText('重试回复'));
    expect(await screen.findByText('连接成功，继续聊吧。')).toBeTruthy();
    expect(screen.getAllByText('叶子为什么是绿色？')).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages.at(-1).content).toBe(
      '叶子为什么是绿色？',
    );
  });

  it('uses compact mobile header label', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        mobileShell
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
      />,
    );

    expect(screen.getByText('记录协助')).toBeTruthy();
    expect(screen.getByText('协助')).toBeTruthy();
  });

  it('keeps direct input without the invitation or three conversation prompts', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    expect(screen.queryByText('一起想清楚')).toBeNull();
    expect(screen.queryByRole('region', { name: '开聊方向' })).toBeNull();
    for (const prompt of ['回看我的惯性', '想清眼前的选择', '让今天靠近我的愿景']) {
      expect(screen.queryByText(prompt)).toBeNull();
    }
    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '我想聊聊今天' },
    });
    expect(screen.getByRole('textbox', { name: '对话内容' })).toHaveProperty(
      'value',
      '我想聊聊今天',
    );
  });

  it('restores general chat and sends saved turns with the next question', async () => {
    writeAvatarSession({
      id: 'avatar-session-old',
      mode: 'general',
      context: { mode: 'general', source: 'global' },
      messages: [
        {
          id: 'msg-old',
          role: 'user',
          type: 'text',
          content: '这是一段旧聊天',
          created_at: '2026-07-09T10:30:00.000Z',
        },
      ],
      references: [],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
    });

    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    expect(screen.getByText('这是一段旧聊天')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '我们刚才聊了什么？' },
    });
    fireEvent.click(screen.getByText('发送'));
    await screen.findByText('模型返回的回复');
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      '这是一段旧聊天',
      '我们刚才聊了什么？',
    ]);
    expect(screen.queryByText('一起想清楚')).toBeNull();
    expect(screen.queryByRole('region', { name: '开聊方向' })).toBeNull();
  });

  it('renders a long restored conversation in windows without losing earlier messages', () => {
    writeAvatarSession({
      id: 'avatar-session-long',
      mode: 'general',
      context: { mode: 'general', source: 'global' },
      messages: Array.from({ length: 65 }, (_, index) => ({
        id: `message-${index}`,
        role: index % 2 ? ('assistant' as const) : ('user' as const),
        type: 'text' as const,
        content: `长对话第 ${index + 1} 条`,
        created_at: '2026-07-09T10:30:00.000Z',
      })),
      references: [],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
    });
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );
    expect(screen.queryByText('长对话第 1 条')).toBeNull();
    expect(screen.getByText('长对话第 65 条')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看更早消息（5）' }));
    expect(screen.getByText('长对话第 1 条')).toBeTruthy();
  });

  it('does not expose standalone avatar appearance customization', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    expect(screen.queryByRole('button', { name: '定制分身形象' })).toBeNull();
    expect(screen.queryByText('定制形象')).toBeNull();
    expect(screen.queryByLabelText('怎么称呼它')).toBeNull();
    expect(localStorage.getItem('vector:avatar:appearance:v1')).toBeNull();
  });

  it('answers a greeting in general companion mode with a natural avatar reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ reply: '你好，今天过得怎么样？' }) }),
    );
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(await screen.findByText('你好，今天过得怎么样？')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/avatar/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.queryByText(/不急着往旧记录上套/)).toBeNull();
    expect(screen.queryByText(/已识别/)).toBeNull();
  });

  it('keeps responding in companion mode when no saved memory answers the question', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: '想省事可以吃一碗热汤面，加个鸡蛋和青菜。' }),
      }),
    );
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '我不知道今天晚上吃什么' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(await screen.findByText('想省事可以吃一碗热汤面，加个鸡蛋和青菜。')).toBeTruthy();
    expect(screen.queryByText(/不急着往旧记录上套/)).toBeNull();
  });

  it('treats direct negative feedback toward the avatar as relationship calibration, not missing context', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reply: '刚才我没听懂你的意思，抱歉。我会先听你说。' }),
      }),
    );
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '我讨厌你' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(await screen.findByText('刚才我没听懂你的意思，抱歉。我会先听你说。')).toBeTruthy();
    expect(screen.queryByText(/这里没有足够信息/)).toBeNull();
  });

  it('keeps model chat available without the removed mode switch', async () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开分身设置' }));
    expect(screen.queryByRole('button', { name: '陪聊' })).toBeNull();
    expect(screen.queryByRole('button', { name: '工具' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '返回分身' }));

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '帮我找客户相关记录' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(await screen.findByText('模型返回的回复')).toBeTruthy();
    expect(screen.queryByText(/我找到 1 条比较相关的记录/)).toBeNull();
  });

  it('shows searchable results and edits or forgets memories without exposing tag management', () => {
    writeAvatarAtomicMemory({
      id: 'memory-ui-tag-1',
      statement: '用户正在优化分身记忆标签系统',
      nature: 'explicit',
      facets: ['value'],
      tags: ['分身产品', '记忆系统'],
      contexts: [],
      sourceRefs: [{ source: 'message', id: 'msg-ui-1' }],
      confidence: 0.82,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 1,
      confirmedAt: 1,
      confirmedBy: 'user',
    });
    writeAvatarAtomicMemory({
      id: 'memory-ui-tag-2',
      statement: '用户把职业发展作为一个长期线索',
      nature: 'explicit',
      facets: ['domain_background'],
      tags: ['职业发展'],
      contexts: [],
      sourceRefs: [{ source: 'entry', id: 'entry-ui-2' }],
      confidence: 0.74,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 2,
      confirmedAt: 2,
      confirmedBy: 'user',
    });

    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '记忆档案' }));
    expect(screen.queryByText('管理标签')).toBeNull();
    expect(screen.queryByText('工具与记录')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /基础与处境/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记忆' }), {
      target: { value: '职业发展' },
    });
    expect(screen.queryByText('用户正在优化分身记忆标签系统')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '用户把职业发展作为一个长期线索' }));
    fireEvent.click(screen.getByRole('button', { name: '调整表述' }));
    fireEvent.change(screen.getByRole('textbox', { name: '记忆内容' }), {
      target: { value: '职业发展中我更看重自主性' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    const revisedMemory = readAvatarAtomicMemories().find(
      (memory) => memory.statement === '职业发展中我更看重自主性',
    );
    expect(revisedMemory?.status).toBe('confirmed');
    expect(revisedMemory?.previousVersionId).toBe('memory-ui-tag-2');
    expect(readAvatarAtomicMemories().find((memory) => memory.id === 'memory-ui-tag-2')?.status).toBe(
      'superseded',
    );
    fireEvent.click(screen.getByRole('button', { name: '职业发展中我更看重自主性' }));
    fireEvent.click(screen.getByRole('button', { name: '暂不采用' }));
    expect(readAvatarAtomicMemories().find((m) => m.id === revisedMemory?.id)?.status).toBe(
      'confirmed',
    );
    fireEvent.click(screen.getByRole('button', { name: '暂不采用' }));
    expect(readAvatarAtomicMemories().find((m) => m.id === revisedMemory?.id)?.status).toBe(
      'rejected',
    );
    expect(readAvatarAtomicMemories().find((m) => m.id === 'memory-ui-tag-2')?.status).toBe(
      'superseded',
    );
    expect(screen.queryByText('职业发展中我更看重自主性')).toBeNull();
  });

  it('lets companion chat produce a summary candidate without auto-saving', async () => {
    const onSend = vi
      .fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()
      .mockResolvedValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidate: {
            statement: '用户喜欢安静的工作环境',
            kind: 'preference',
            sourceIndexes: [0],
          },
          mood_tags: ['压力'],
          event_tags: ['职业发展'],
          is_sparse: false,
          followup_question: null,
        }),
      }),
    );

    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={onSend}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '我喜欢安静的工作环境' },
    });
    fireEvent.click(screen.getByText('发送'));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提炼记忆' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByText('提炼记忆'));

    expect(await screen.findByRole('dialog', { name: '记住这条关于你的信息？' })).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
    expect(readAvatarAtomicMemories()).toHaveLength(0);
    expect((screen.getByRole('textbox', { name: '提炼的信息' }) as HTMLTextAreaElement).value).toBe(
      '用户喜欢安静的工作环境',
    );
    fireEvent.click(screen.getByRole('button', { name: '确认记住' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      statement: '用户喜欢安静的工作环境',
      facets: ['preference'],
      status: 'confirmed',
    });
  });

  it.each(['candidate', 'empty', 'error'])(
    'handles automatic fact extraction: %s',
    async (outcome) => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (!url.includes('/memory/extract'))
          return { ok: true, json: async () => ({ reply: '了解你的偏好。' }) };
        if (outcome === 'error') throw new Error('offline');
        return {
          ok: true,
          json: async () => ({
            candidate:
              outcome === 'empty'
                ? null
                : { statement: '用户喜欢安静的工作环境', kind: 'preference', sourceIndexes: [0] },
          }),
        };
      });
      vi.stubGlobal('fetch', fetchMock);
      render(
        <AvatarChatPage
          draft={draft()}
          setDraft={vi.fn()}
          pastEntries={[]}
          sending={false}
          onBack={vi.fn()}
          onRouteChange={vi.fn()}
          onSend={vi.fn()}
          showToast={vi.fn()}
          launchContext={{ mode: 'general', source: 'global' }}
        />,
      );
      fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
        target: { value: '我喜欢安静的工作环境' },
      });
      fireEvent.click(screen.getByText('发送'));
      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([url]) => url.includes('/memory/extract'))).toBe(true),
      );
      await waitFor(() =>
        expect(
          (screen.getByRole('button', { name: '提炼记忆' }) as HTMLButtonElement).disabled,
        ).toBe(false),
      );
      expect(readAvatarAtomicMemories()).toHaveLength(0);
      if (outcome === 'candidate') {
        expect(await screen.findByRole('dialog', { name: '记住这条关于你的信息？' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '暂不记住' }));
      } else {
        expect(screen.queryByRole('dialog')).toBeNull();
      }
      expect(readAvatarAtomicMemories()).toHaveLength(0);
    },
  );

  it('requires confirmation and categorizes the edited memory automatically', () => {
    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={vi.fn()}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '记忆档案' }));
    for (const label of [
      '基础事实',
      '事件经历',
      '认知观点',
      '行为习惯',
      '目标计划',
      '状态偏好',
      '关系任务',
      '表达风格',
    ]) {
      expect(screen.queryByRole('button', { name: new RegExp(label) })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: '新增记忆' }));
    expect((screen.getByRole('button', { name: '确认记住' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByRole('textbox', { name: '提炼的信息' }), {
      target: { value: '未确认内容' },
    });
    expect(readAvatarAtomicMemories()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '暂不记住' }));
    expect(readAvatarAtomicMemories()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '新增记忆' }));
    fireEvent.change(screen.getByRole('textbox', { name: '提炼的信息' }), {
      target: { value: '我倾向使用简短直接的语句' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认记住' }));
    expect(readAvatarAtomicMemories()).toHaveLength(1);
    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      statement: '我倾向使用简短直接的语句',
      category: 'expression',
      status: 'confirmed',
      confirmedBy: 'user',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /偏好与边界/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记忆' }), {
      target: { value: '不存在的记忆' },
    });
    expect(screen.queryByText('我倾向使用简短直接的语句')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索记忆' }), {
      target: { value: '简短' },
    });
    expect(screen.getByText('我倾向使用简短直接的语句')).toBeTruthy();
  });

  it('does not auto-record from the general avatar even when the user says record', () => {
    const onSend = vi
      .fn<(preview: RecordPreviewPayload, sessionId: string) => Promise<boolean>>()
      .mockResolvedValue(true);

    render(
      <AvatarChatPage
        draft={draft()}
        setDraft={vi.fn()}
        pastEntries={[entry()]}
        sending={false}
        onBack={vi.fn()}
        onRouteChange={vi.fn()}
        onSend={onSend}
        showToast={vi.fn()}
        launchContext={{ mode: 'general', source: 'global' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '对话内容' }), {
      target: { value: '请帮我记录今天客户方案被否定，我有点压力' },
    });
    fireEvent.click(screen.getByText('发送'));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByText('发送记录')).toBeNull();
  });
});
