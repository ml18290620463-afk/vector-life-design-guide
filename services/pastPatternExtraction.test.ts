import { describe, expect, it } from 'vitest';
import type { DiaryEntry, PatternPrincipleLink, Principle } from '../types';
import { derivePastPatternEvolution, extractPastPatterns } from './pastPatternExtraction';

const entry = (id: string, content: string, tags: string[] = []): DiaryEntry => ({
  id,
  title: `记录 ${id}`,
  content,
  createdAt: 100,
  tags,
  isLocked: false,
});

const findByLabel = (patterns: ReturnType<typeof extractPastPatterns>, label: string) =>
  patterns.find((pattern) => pattern.patternLabel === label);

describe('extractPastPatterns', () => {
  it('does not treat duplicate IDs, quoted advice, other people or plans as repeated observations', () => {
    for (const records of [
      [entry('one', '我会复盘。'), entry('one', '我会复盘。')],
      [entry('one', '同事经常拖延。'), entry('two', '朋友说应该复盘。')],
      [entry('one', '“先准备再行动”'), entry('two', '我打算提前准备。')],
    ])
      expect(extractPastPatterns(records)).toEqual([]);
  });

  it.each([
    ['他人经历', '同事经常拖延。', '朋友总是拖延。'],
    ['过去状态', '我以前经常拖延。', '过去我一直拖延。'],
    ['当前否定', '我现在不再拖延。', '我已经没有拖延。'],
    ['中文引用', '我听到“总是拖延”这句话。', '书里写着「拖延」。'],
    ['英文引用', '书中写着 "拖延"。', "他写了 '拖延'。"],
    ['反讽提示', '我真会拖延，才怪。', '我总拖延，反话而已。'],
    ['一次例外', '只是这次我拖延。', '我破例拖延了一次。'],
    ['已改变', '我以前经常拖延，现在已经开始行动。', '过去我拖延，如今会先做第一步。'],
  ])('does not retain delayed-action conclusions for %s', (_name, first, second) => {
    expect(
      findByLabel(extractPastPatterns([entry('a', first), entry('b', second)]), '延后行动'),
    ).toBeUndefined();
  });

  it('keeps rejected and superseded decisions suppressed when new matching records arrive', () => {
    const records = [entry('a', '我会复盘。'), entry('b', '再次回顾过程。')];
    const initial = extractPastPatterns(records)[0];
    for (const status of ['rejected', 'superseded'] as const) {
      expect(
        extractPastPatterns([...records, entry('c', '认真总结。')], [{ ...initial, status }]),
      ).toEqual([]);
    }
  });

  it('does not infer pressure from scheduling delays', () => {
    const patterns = extractPastPatterns([
      entry('one', '我推迟了安排。'),
      entry('two', '我把事情先放一放。'),
    ]);
    expect(findByLabel(patterns, '延后行动')).toBeDefined();
    expect(patterns[0].statement).not.toContain('压力');
    expect(patterns[0].outcome).toContain('仍需');
  });

  it('extracts a concrete behavioral pattern with situation, response and outcome', () => {
    const pattern = findByLabel(
      extractPastPatterns([
        entry('one', '会议前我会提前准备问题。'),
        entry('two', '沟通前先确认目标，事情顺利很多。'),
        entry('three', '普通的一天。'),
      ]),
      '行动前准备',
    );

    expect(pattern).toEqual(
      expect.objectContaining({
        status: 'pending',
        patternDomain: 'behavioral',
        trigger: '面对重要任务或沟通时',
        response: '你会先整理、确认或规划，再进入行动',
        outcome: '行动中的不确定性因此降低',
        sourceEntryIds: ['one', 'two'],
        statement: '面对重要任务或沟通时，你会先整理、确认或规划，再进入行动。',
      }),
    );
  });

  it('uses a shared event tag as context but never treats a repeated event as a pattern', () => {
    expect(
      extractPastPatterns([
        entry('one', '第一次普通记录', ['事件:职业发展', '心情:焦虑']),
        entry('two', '第二次普通记录', ['事件:职业发展', '心情:平静']),
      ]),
    ).toEqual([]);

    const pattern = findByLabel(
      extractPastPatterns([
        entry('one', '我总是提前整理资料。', ['事件:职业发展']),
        entry('two', '我会先确认目标再开始。', ['事件:职业发展']),
      ]),
      '行动前准备',
    );
    expect(pattern).toEqual(
      expect.objectContaining({
        trigger: '在「职业发展」相关情境中',
        statement: '在「职业发展」相关情境中，你会先整理、确认或规划，再进入行动。',
      }),
    );
  });

  it.each([
    {
      domain: 'cognitive',
      label: '风险预演',
      records: ['我反复预想会不会失败。', '我又担心最后出错。'],
    },
    {
      domain: 'emotional',
      label: '受挫后自我否定',
      records: ['结果不好时我会自责。', '这次失误让我觉得自己不行。'],
    },
    {
      domain: 'relational',
      label: '关系中优先满足他人',
      records: ['我不好意思拒绝他的请求。', '我怕别人失望就马上答应。'],
    },
    {
      domain: 'coping',
      label: '反馈校准',
      records: ['不确定时我会请教同事。', '我会征求朋友的建议。'],
    },
    {
      domain: 'cognitive',
      label: '换角度理解',
      records: ['卡住时我会换个角度看问题。', '我开始重新理解这次失败。'],
    },
    {
      domain: 'behavioral',
      label: '拆出下一步',
      records: ['任务太大时，我会拆成小步骤。', '不知道怎么开始时，我会先做第一步。'],
    },
    {
      domain: 'emotional',
      label: '情绪回稳',
      records: ['争执后我先让自己平静下来。', '压力上来时我会缓一会儿再处理。'],
    },
    {
      domain: 'relational',
      label: '主动修复关系',
      records: ['发生误会后，我会主动联系对方。', '冷静后我会重新沟通，把误会说开。'],
    },
  ])('classifies $label as a $domain observation', ({ domain, label, records }) => {
    const pattern = findByLabel(
      extractPastPatterns(records.map((content, index) => entry(`${index}`, content))),
      label,
    );
    expect(pattern).toEqual(
      expect.objectContaining({ patternDomain: domain, patternLabel: label }),
    );
  });

  it('does not treat a negated response as a current pattern', () => {
    const patterns = extractPastPatterns([
      entry('one', '我现在已经不焦虑了。'),
      entry('two', '这次我没有焦虑。'),
    ]);

    expect(findByLabel(patterns, '不确定时紧张')).toBeUndefined();
  });

  it('recognizes a relational change without retaining the old response', () => {
    const patterns = extractPastPatterns([
      entry('one', '过去我会回避冲突，现在开始表达立场。'),
      entry('two', '以前我总是沉默，如今会主动说出想法。'),
    ]);

    expect(findByLabel(patterns, '从回避到表达')).toEqual(
      expect.objectContaining({
        patternDomain: 'relational',
        response: '你正在从延后表达，转向主动说明自己的立场',
      }),
    );
    expect(findByLabel(patterns, '冲突中延后表达')).toBeUndefined();
  });

  it('recognizes a behavioral change from delaying to taking a first step', () => {
    const patterns = extractPastPatterns([
      entry('one', '过去总是拖延，现在开始先做第一步。'),
      entry('two', '以前迟迟不动手，如今会先拆成小步骤。'),
    ]);

    expect(findByLabel(patterns, '从延后到启动')).toEqual(
      expect.objectContaining({
        patternDomain: 'behavioral',
        response: '你正在从推迟开始，转向先做出一个可执行步骤',
      }),
    );
    expect(findByLabel(patterns, '延后行动')).toBeUndefined();
  });

  it('keeps a user-confirmed expression and structured observation while adding evidence', () => {
    const initial = findByLabel(
      extractPastPatterns([entry('one', '我会复盘。'), entry('two', '再次回顾过程。')], [], 100),
      '反思校准',
    )!;
    const patterns = extractPastPatterns(
      [entry('one', '我会复盘。'), entry('two', '再次回顾过程。'), entry('three', '认真总结。')],
      [
        {
          ...initial,
          statement: '这是我确认过的表达。',
          trigger: '每次完成重要项目后',
          status: 'confirmed',
          confirmedAt: 150,
          confirmedBy: 'user',
          summaryKind: 'past-pattern',
        },
      ],
      200,
    );
    const pattern = findByLabel(patterns, '反思校准');

    expect(pattern).toEqual(
      expect.objectContaining({
        status: 'confirmed',
        statement: '这是我确认过的表达。',
        trigger: '每次完成重要项目后',
        sourceEntryIds: ['one', 'two', 'three'],
        confirmedAt: 150,
        confirmedBy: 'user',
      }),
    );
  });

  it('does not infer a pattern from one occurrence, a sample, or a locked future record', () => {
    expect(
      extractPastPatterns(
        [
          entry('one', '我会复盘。'),
          { ...entry('sample', '我也会复盘。'), isSample: true },
          { ...entry('future', '我还会复盘。'), unlockAt: 500 },
        ],
        [],
        200,
      ),
    ).toEqual([]);
  });
});

describe('derivePastPatternEvolution', () => {
  it('keeps an unlinked repeated pattern in the strengthening stage', () => {
    const pattern = findByLabel(
      extractPastPatterns([entry('one', '我会复盘。'), entry('two', '再次回顾过程。')], [], 200),
      '反思校准',
    )!;

    expect(
      derivePastPatternEvolution({
        pattern,
        entries: [entry('one', '我会复盘。'), entry('two', '再次回顾过程。')],
        now: 300,
      }),
    ).toEqual(
      expect.objectContaining({
        stage: 'strengthening',
        sourceCount: 2,
        linkedPrincipleCount: 0,
        validationCount: 0,
        challengeCount: 0,
      }),
    );
  });

  it('turns linked principle feedback into a lightweight shifting status', () => {
    const pattern = findByLabel(
      extractPastPatterns(
        [entry('one', '我提前整理材料。'), entry('two', '我会先确认目标。')],
        [],
        200,
      ),
      '行动前准备',
    )!;
    const principle: Principle = {
      id: 'principle-1',
      text: '先准备再行动',
      year: 2026,
      createdAt: 250,
      showOnHome: true,
      sourcePatternIds: [pattern.id],
    };
    const feedbackEntry = {
      ...entry('three', '今天继续先准备再行动。'),
      principleFeedback: [
        { principleId: 'principle-1', outcome: 'helpful' as const, createdAt: 300 },
      ],
    };

    expect(
      derivePastPatternEvolution({
        pattern,
        entries: [
          entry('one', '我提前整理材料。'),
          entry('two', '我会先确认目标。'),
          feedbackEntry,
        ],
        principles: [principle],
        now: 350,
      }),
    ).toEqual(
      expect.objectContaining({
        stage: 'shifting',
        linkedPrincipleCount: 1,
        validationCount: 1,
        challengeCount: 0,
      }),
    );
  });

  it('counts flexible pattern-principle links without repeating principle content', () => {
    const pattern = findByLabel(
      extractPastPatterns(
        [entry('one', '我会拆成小步骤。'), entry('two', '我先做第一步。')],
        [],
        200,
      ),
      '拆出下一步',
    )!;
    const link: PatternPrincipleLink = {
      id: 'link-1',
      patternId: pattern.id,
      principleId: 'principle-1',
      relation: 'continue',
      status: 'confirmed',
      createdBy: 'user',
      createdAt: 250,
      updatedAt: 250,
    };

    expect(
      derivePastPatternEvolution({
        pattern,
        entries: [entry('one', '我会拆成小步骤。'), entry('two', '我先做第一步。')],
        principles: [
          {
            id: 'principle-1',
            text: '先做最小步骤',
            year: 2026,
            createdAt: 250,
            showOnHome: true,
            helpfulCount: 2,
          },
        ],
        links: [link],
        now: 300,
      }),
    ).toEqual(
      expect.objectContaining({
        stage: 'shifting',
        linkedPrincipleCount: 1,
        validationCount: 2,
      }),
    );
  });
});
