import { describe, expect, it } from 'vitest';
import {
  buildGuidanceSources,
  buildGroundedGuidance,
  detectAvatarConversationIntent,
  extractAvatarName,
  GUIDANCE_STARTERS,
} from './avatarGuidance';
import { emptyFutureState } from './futureRepository';
import type { AvatarAtomicMemory, AvatarUnderstandingVersion } from '../features/avatar/types';
import type { Principle } from '../types';

const pattern: AvatarUnderstandingVersion = {
  id: 'pattern',
  statement: '面对登山安排，我会反复推迟出发',
  status: 'confirmed',
  sourceEntryIds: ['entry'],
  createdAt: 1,
};
const principle: Principle = {
  id: 'principle',
  text: '先做力所能及的一步',
  year: 2026,
  createdAt: 1,
  showOnHome: false,
  sourcePatternIds: ['pattern'],
};
const fixture = () => ({
  entries: [
    { id: 'entry', title: '登山', content: '推迟出发', tags: [], createdAt: 1, isLocked: false },
  ],
  patterns: [pattern],
  principles: [principle],
  actions: [],
  future: emptyFutureState(),
});

describe('read-only avatar guidance', () => {
  it('uses only confirmed patterns with extant evidence or explicit retention', () => {
    const input = fixture();
    input.patterns = [
      pattern,
      { ...pattern, id: 'pending', status: 'pending' },
      { ...pattern, id: 'deleted', sourceEntryIds: ['gone'] },
      { ...pattern, id: 'kept', sourceEntryIds: [], retainedAfterSourceDeletion: true },
    ];
    expect(
      buildGuidanceSources(input)
        .filter((s) => s.kind === '模式')
        .map((s) => s.id),
    ).toEqual(['pattern', 'kept']);
  });
  it('connects a pattern and its chosen principle without changing either', () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const result = buildGroundedGuidance('登山时我会推迟出发', buildGuidanceSources(input));
    expect(result.sources.map((s) => s.kind)).toEqual(['模式', '原则']);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.text).not.toContain('你应该');
  });
  it('keeps a requested period bounded to dated evidence and historical validity', () => {
    const sources = [
      {
        id: 'march',
        kind: '背景' as const,
        text: '三月的项目复盘',
        module: 'past' as const,
        evidence: [{ text: '三月项目复盘', occurredAt: new Date(2026, 2, 12).getTime() }],
      },
      {
        id: 'may',
        kind: '背景' as const,
        text: '五月的项目复盘',
        module: 'past' as const,
        evidence: [{ text: '五月项目复盘', occurredAt: new Date(2026, 4, 12).getTime() }],
      },
    ];
    const result = buildGroundedGuidance('2026年3月项目复盘', sources, undefined, {
      range: { start: new Date(2026, 2, 1).getTime(), end: new Date(2026, 3, 1).getTime() },
      preferredSourceIds: ['march'],
    });
    expect(result.sources.map((source) => source.id)).toEqual(['march']);
  });
  it('keeps two independent matching diary records rather than treating one as the whole period', () => {
    const sources = ['one', 'two'].map((id, index) => ({
      id,
      kind: '背景' as const,
      text: `项目复盘 ${index + 1}`,
      module: 'past' as const,
      evidence: [
        { text: `项目复盘 ${index + 1}`, occurredAt: new Date(2026, 2, index + 1).getTime() },
      ],
    }));
    expect(
      buildGroundedGuidance('项目复盘', sources, undefined, {
        preferredSourceIds: ['one', 'two'],
      }).sources.map((source) => source.id),
    ).toEqual(['one', 'two']);
  });
  it('offers useful starter context and refuses unrelated confident claims', () => {
    const sources = buildGuidanceSources(fixture());
    expect(buildGroundedGuidance(GUIDANCE_STARTERS[0], sources).sources.length).toBe(2);
    expect(buildGroundedGuidance('今天吃什么', sources).sources).toEqual([]);
    expect(buildGroundedGuidance('今天吃什么', sources).text).toContain('不能装作知道答案');
    expect(buildGroundedGuidance('继续', sources, GUIDANCE_STARTERS[0]).sources.length).toBe(2);
  });
  it('keeps general avatar replies conversational instead of exposing extraction panels', () => {
    const text = buildGroundedGuidance('登山时我会推迟出发', buildGuidanceSources(fixture())).text;
    expect(text).not.toContain('可以一起对照');
    expect(text).not.toContain('模式「');
    expect(text).not.toContain('原则「');
    expect(text).not.toContain('已识别');
    expect(text).not.toContain('你应该');
  });
  it('responds to identity, naming, and action intent like a conversational avatar', () => {
    expect(buildGroundedGuidance('你叫什么名字', buildGuidanceSources(fixture())).text).toContain(
      '我是你的分身',
    );
    expect(buildGroundedGuidance('以后叫你小鹿', buildGuidanceSources(fixture())).text).toContain(
      '确认保存',
    );
    expect(extractAvatarName('以后叫你小鹿')).toBe('小鹿');
    const actionReply = buildGroundedGuidance(
      '我想明天去爬山',
      buildGuidanceSources(fixture()),
    ).text;
    expect(actionReply).toContain('不替你直接安排');
    expect(actionReply).toContain('接下来的一步');
  });
  it('responds to simple greetings without falling back to a mechanical guidance template', () => {
    const sources = buildGuidanceSources(fixture());
    expect(detectAvatarConversationIntent('你好')).toBe('smalltalk');

    const hello = buildGroundedGuidance('你好', sources).text;
    expect(hello).toContain('我在');
    expect(hello).not.toContain('不急着往旧记录上套');
    expect(hello).not.toContain('已识别');
    expect(hello).not.toContain('你应该');

    const areYouThere = buildGroundedGuidance('在吗', sources).text;
    expect(areYouThere).toContain('在');
    expect(areYouThere).toContain('你的节奏');
    expect(areYouThere).not.toContain('不急着往旧记录上套');
  });

  it('keeps talking usefully when there is no saved answer or matching memory', () => {
    const sources = buildGuidanceSources(fixture());

    const dinner = buildGroundedGuidance('我不知道今天晚上吃什么', sources).text;
    expect(dinner).toContain('不能装作知道答案');
    expect(dinner).toContain('省事');
    expect(dinner).toContain('热');
    expect(dinner).not.toContain('不急着往旧记录上套');
    expect(dinner).not.toContain('我在听。你不用整理成问题');

    expect(detectAvatarConversationIntent('你现在又开始胡说')).toBe('complaint');
    const complaint = buildGroundedGuidance('你现在又开始胡说', sources).text;
    expect(complaint).toContain('你说得对');
    expect(complaint).toContain('不能装作知道');
    expect(complaint).not.toContain('不急着往旧记录上套');

    expect(detectAvatarConversationIntent('我讨厌你')).toBe('complaint');
    expect(detectAvatarConversationIntent('你太烦了')).toBe('complaint');
    const directedComplaint = buildGroundedGuidance('我讨厌你', sources).text;
    expect(directedComplaint).toContain('不是在给我补资料');
    expect(directedComplaint).toContain('不满');
    expect(directedComplaint).toContain('不会当成“用户长期讨厌分身”的记忆保存');
    expect(directedComplaint).not.toContain('这里没有足够信息');
    expect(directedComplaint).not.toContain('补一句背景');
  });

  it('detects conversational intent and adjusts friend/coach proportion', () => {
    const sources = buildGuidanceSources(fixture());
    expect(detectAvatarConversationIntent('你可以做什么呢')).toBe('capability');
    expect(detectAvatarConversationIntent('你能干什么')).toBe('capability');
    expect(detectAvatarConversationIntent('你能干嘛呀')).toBe('capability');
    expect(detectAvatarConversationIntent('我现在很焦虑')).toBe('emotion');
    expect(detectAvatarConversationIntent('你建议我怎么做')).toBe('advice');
    expect(detectAvatarConversationIntent('重要选择先留出思考时间，这条原则怎么用？')).toBe(
      'advice',
    );
    expect(detectAvatarConversationIntent('我想明天去爬山')).toBe('action');

    const capability = buildGroundedGuidance('你可以做什么呢', sources).text;
    expect(capability).toContain('听你说');
    expect(capability).toContain('像朋友一样陪你');
    expect(capability).toContain('认真帮你拆');
    expect(capability).not.toContain('后台');
    expect(capability).not.toContain('偏好');
    expect(capability).not.toContain('边界');
    expect(capability).not.toContain('习惯');

    expect(buildGroundedGuidance('我现在很焦虑', sources).text).toContain('先陪你');
    expect(buildGroundedGuidance('你建议我怎么做', sources).text).toContain('可执行的选择');
  });
  it('uses confirmed avatar memories as hidden cross-module context without creating commitments', () => {
    const input = fixture();
    const sources = buildGuidanceSources({
      ...input,
      avatarMemories: [
        {
          id: 'memory-preference',
          statement: '用户偏好简洁、少解释、直接执行的界面',
          nature: 'explicit',
          facets: ['preference'],
          tags: ['产品体验'],
          contexts: ['产品体验'],
          sourceRefs: [{ source: 'entry', id: 'entry' }],
          confidence: 0.86,
          status: 'confirmed',
          sensitivity: 'normal',
          createdAt: 1,
          confirmedBy: 'user',
          confirmedAt: 1,
        },
      ],
    });

    expect(sources.find((source) => source.id === 'memory-preference')).toMatchObject({
      kind: '偏好',
      module: 'past',
    });
    expect(buildGroundedGuidance('界面需要更简洁', sources).text).not.toContain('你应该');
  });
  it('reads current progress and follows action-goal-vision links, excluding inactive plans', () => {
    const input = fixture();
    input.future.visions = [
      { id: 'vision', text: '亲近自然', status: 'active', revision: 1, createdAt: 1, updatedAt: 1 },
    ];
    input.future.goals = [
      {
        id: 'goal',
        title: '登十座山',
        visionId: 'vision',
        status: 'active',
        measurement: {
          kind: 'quantity',
          target: 10,
          unit: '座',
          precision: 0,
          distinctItems: true,
        },
        tags: [],
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    input.future.events = ['one', 'duplicate'].map((id) => ({
      id,
      goalId: 'goal',
      operationId: id,
      semanticKey: id,
      value: { kind: 'quantity', amount: 1, itemId: 'mountain' },
      occurredOn: '2026-09-15',
      sourceState: 'standalone',
      confirmedBy: 'user',
      status: 'valid',
      goalRevision: 1,
      createdAt: 1,
    }));
    const args = {
      ...input,
      actions: [
        {
          id: 'action',
          title: '周末出发',
          goalId: 'goal',
          status: 'pending' as const,
          createdAt: 1,
        },
      ],
    };
    let sources = buildGuidanceSources(args);
    expect(sources.find((s) => s.kind === '目标')?.detail).toBe('1 / 10 座');
    expect(buildGroundedGuidance('周末出发', sources).sources.map((s) => s.kind)).toContain('目标');
    expect(buildGroundedGuidance('周末出发', sources).sources.map((s) => s.kind)).toContain('愿景');
    input.future.goals[0].status = 'paused';
    sources = buildGuidanceSources(args);
    expect(sources.some((s) => s.kind === '目标' || s.kind === '行动')).toBe(false);
  });
});

const atomic = (overrides: Partial<AvatarAtomicMemory> = {}): AvatarAtomicMemory => ({
  id: 'name',
  statement: '用户为分身取名为「小树」',
  nature: 'explicit',
  facets: ['preference'],
  tags: [],
  contexts: [],
  sourceRefs: [{ source: 'entry', id: 'entry' }],
  confidence: 0.7,
  status: 'confirmed',
  sensitivity: 'normal',
  createdAt: 1,
  confirmedAt: 1,
  confirmedBy: 'user',
  ...overrides,
});

describe('six-layer recall boundaries', () => {
  it('uses the latest reviewed name independently of question keyword ranking', () => {
    const sources = buildGuidanceSources({
      ...fixture(),
      avatarMemories: [
        atomic(),
        atomic({ id: 'new-name', statement: '用户为分身取名为「小鹿」', confirmedAt: 2 }),
      ],
    });
    expect(buildGroundedGuidance('你叫什么名字', sources).text).toContain('分身「小鹿」');
  });
  it('does not use unreviewed, expired, future, or inferred names', () => {
    const now = Date.now();
    const sources = buildGuidanceSources({
      ...fixture(),
      avatarMemories: [
        atomic({ id: 'candidate', status: 'candidate' }),
        atomic({ id: 'rejected', status: 'rejected' }),
        atomic({ id: 'expired', validTo: now }),
        atomic({ id: 'future', validFrom: now + 60000 }),
        atomic({ id: 'inferred', nature: 'inferred' }),
      ],
    });
    expect(sources.filter((s) => s.avatarName)).toHaveLength(0);
    expect(buildGroundedGuidance('你叫什么名字', sources).text).not.toContain('「小树」');
  });
  it('rechecks expiry when using previously collected context', () => {
    const sources = buildGuidanceSources({
      ...fixture(),
      now: 1,
      avatarMemories: [atomic({ validTo: 2 })],
    });
    expect(sources.some((s) => s.avatarName)).toBe(true);
    expect(buildGroundedGuidance('你叫什么名字', sources).text).not.toContain('「小树」');
  });
  it('preserves the distinction between inference, past state and unfinished plans', () => {
    for (const [nature, wording] of [
      ['inferred', '仍需验证'],
      ['state', '不能据此判断你现在的感受'],
      ['commitment', '是否完成还需要核实'],
    ] as const) {
      const sources = buildGuidanceSources({
        ...fixture(),
        avatarMemories: [atomic({ statement: '散步让我更平静', nature })],
      });
      expect(buildGroundedGuidance('散步让我更平静', sources).text).toContain(wording);
    }
  });
});
