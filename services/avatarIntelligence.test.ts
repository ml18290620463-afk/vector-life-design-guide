import { describe, expect, it } from 'vitest';
import { buildAvatarGrowthPreview } from './avatarIntelligence';

describe('avatarIntelligence', () => {
  it('extracts experience signals and keeps writes pending for user confirmation', async () => {
    const preview = await buildAvatarGrowthPreview(
      {
        messages: [
          {
            role: 'user',
            content:
              '今天和同事沟通项目后很疲惫，我意识到自己不想一直承担别人的情绪，接下来我要更清楚地表达边界。',
            createdAt: 100,
          },
        ],
        source: 'now',
        sourceEntryId: 'entry-now',
        occurredAt: 100,
      },
      { now: 100 },
    );

    expect(preview.extraction.summary).toContain('同事沟通项目');
    expect(preview.extraction.moodTags).toContain('疲惫');
    expect(preview.extraction.eventTags).toContain('工作事业');
    expect(preview.extraction.eventTags).toContain('人际交往');
    expect(preview.extraction.signals.map((signal) => signal.facet)).toEqual(
      expect.arrayContaining(['event', 'emotion', 'thought', 'boundary', 'commitment']),
    );
    expect(preview.memoryCandidates.some((candidate) => candidate.scope === 'longTerm')).toBe(true);
    expect(preview.atomicMemoryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facets: expect.arrayContaining(['boundary']),
          status: 'candidate',
        }),
        expect.objectContaining({
          facets: expect.arrayContaining(['motivation']),
          status: 'candidate',
        }),
      ]),
    );
    expect(new Set(preview.atomicMemoryCandidates.map((item) => item.statement)).size).toBe(
      preview.atomicMemoryCandidates.length,
    );
    expect(preview.temporalFacts.length).toBeGreaterThan(0);
    expect(preview.writePolicy).toEqual({
      requiresUserConfirmation: true,
      mem0: 'pending',
      graphiti: 'pending',
    });
  });

  it('links new facts to related past entries and flags likely conflicts with old understandings', async () => {
    const preview = await buildAvatarGrowthPreview(
      {
        messages: [
          {
            role: 'user',
            content: '今天我不再想一直承担关系里的情绪压力，这次我决定先照顾自己的边界。',
          },
        ],
        sourceEntryId: 'entry-new',
        occurredAt: 200,
      },
      {
        entries: [
          {
            id: 'entry-old',
            title: '一次关系复盘',
            content: '我总是承担朋友的情绪，后来觉得压力很大。',
            tags: ['事件:人际关系', '心情:疲惫'],
            createdAt: 100,
          },
        ],
        understandings: [
          {
            id: 'understanding-old',
            statement: '用户一直习惯承担关系里的情绪压力。',
            status: 'confirmed',
            sourceEntryIds: ['entry-old'],
            createdAt: 100,
          },
        ],
        now: 200,
      },
    );

    expect(preview.recallEntryIds).toContain('entry-old');
    expect(preview.temporalEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toId: 'entry-old', relation: 'sameTheme' }),
      ]),
    );
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          previousUnderstandingId: 'understanding-old',
        }),
      ]),
    );
  });
});

describe('avatar evidence boundaries', () => {
  it('never derives personal memories from assistant or system messages', async () => {
    const preview = await buildAvatarGrowthPreview({
      messages: [
        { role: 'assistant', content: '我一直喜欢旅行，接下来我要完成项目。' },
        { role: 'system', content: '我计划成为医生。' },
        { role: 'user', content: '你好' },
      ],
    });
    expect(preview.extraction.signals).toEqual([]);
    expect(preview.atomicMemoryCandidates).toEqual([]);
  });

  it('keeps a passing mood in context and out of durable memory', async () => {
    const preview = await buildAvatarGrowthPreview({
      messages: [{ role: 'user', content: '今天我觉得很累，现在不想工作。' }],
    });
    expect(preview.extraction.signals.some((signal) => signal.facet === 'emotion')).toBe(true);
    expect(preview.memoryCandidates).toEqual([]);
    expect(preview.atomicMemoryCandidates).toEqual([]);
  });

  it('retains stable preferences as unconfirmed candidates with user evidence', async () => {
    const preview = await buildAvatarGrowthPreview({
      messages: [
        { role: 'assistant', content: '你喜欢什么？' },
        { role: 'user', content: '我一直喜欢简洁的表达。', createdAt: 123 },
      ],
      occurredAt: 456,
    });
    expect(preview.atomicMemoryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'candidate',
          facets: ['preference'],
          sourceRefs: [expect.objectContaining({ id: 'message-2', createdAt: 123 })],
        }),
      ]),
    );
  });
});
