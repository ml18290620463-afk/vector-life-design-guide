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
  it('keeps original and supplemental evidence distinct with their recording times', async () => {
    const extract = (sourceSupplementId: string | undefined, occurredAt: number) =>
      buildAvatarGrowthPreview({
        messages: [{ role: 'user', content: '我一直喜欢简洁的表达。', createdAt: occurredAt }],
        source: 'past',
        sourceEntryId: 'original',
        sourceSupplementId,
        occurredAt,
      });
    const original = await extract(undefined, 100);
    const supplement = await extract('supplement', 200);
    expect(original.atomicMemoryCandidates.length).toBeGreaterThan(0);
    expect(supplement.atomicMemoryCandidates.length).toBeGreaterThan(0);
    const originalIds = new Set(original.atomicMemoryCandidates.map((item) => item.id));
    for (const memory of supplement.atomicMemoryCandidates) {
      expect(originalIds.has(memory.id)).toBe(false);
      expect(memory.createdAt).toBe(200);
      expect(memory.sourceRefs).toContainEqual(
        expect.objectContaining({
          id: 'original',
          supplementId: 'supplement',
          createdAt: 200,
        }),
      );
    }
  });
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

  it('requires two independent experiences before proposing a recurring pattern', async () => {
    const extraction = {
      summary: '我会先反复预演',
      signals: [
        {
          facet: 'thought' as const,
          text: '我会先反复预演',
          confidence: 0.76,
          evidence: [{ source: 'message' as const, id: 'message-2', excerpt: '我会先反复预演' }],
        },
      ],
      moodTags: [],
      eventTags: ['工作事业'],
      completeness: 60,
      nextQuestion: null,
      needsUserConfirmation: true as const,
      sourceEntryId: 'entry-current',
      occurredAt: 200,
    };
    const providers = {
      extraction: { extract: async () => extraction },
      memory: {
        propose: async () => [
          {
            id: 'memory-pattern',
            statement: '我会先反复预演',
            scope: 'longTerm' as const,
            confidence: 0.76,
            reason: 'test',
            sourceEntryIds: ['entry-current'],
            evidence: extraction.signals[0]!.evidence,
          },
        ],
      },
      graph: { propose: async () => ({ facts: [], edges: [], conflicts: [] }) },
    };

    const oneSource = await buildAvatarGrowthPreview({ messages: [] }, {}, providers);
    expect(oneSource.atomicMemoryCandidates).toEqual([]);

    const twoSources = await buildAvatarGrowthPreview(
      { messages: [] },
      {
        evidenceSources: [
          { entryId: 'unused', createdAt: 10 },
          { entryId: 'entry-earlier', createdAt: 100 },
        ],
      },
      providers,
    );
    expect(twoSources.atomicMemoryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facets: ['cognitive_pattern'],
          status: 'candidate',
          sourceRefs: expect.arrayContaining([
            expect.objectContaining({ source: 'entry', id: 'entry-current' }),
            expect.objectContaining({ source: 'entry', id: 'entry-earlier' }),
          ]),
        }),
      ]),
    );
  });

  it('withholds a recurring pattern when it conflicts with confirmed understanding', async () => {
    const extraction = {
      summary: '我会先反复预演',
      signals: [
        {
          facet: 'thought' as const,
          text: '我会先反复预演',
          confidence: 0.76,
          evidence: [{ source: 'message' as const, id: 'message-2', excerpt: '我会先反复预演' }],
        },
      ],
      moodTags: [],
      eventTags: ['工作事业'],
      completeness: 60,
      nextQuestion: null,
      needsUserConfirmation: true as const,
      sourceEntryId: 'entry-current',
      occurredAt: 200,
    };
    const preview = await buildAvatarGrowthPreview(
      { messages: [] },
      {
        evidenceSources: [
          { entryId: 'unused', createdAt: 10 },
          { entryId: 'entry-earlier', createdAt: 100 },
        ],
      },
      {
        extraction: { extract: async () => extraction },
        memory: {
          propose: async () => [
            {
              id: 'memory-pattern',
              statement: '我会先反复预演',
              scope: 'longTerm' as const,
              confidence: 0.76,
              reason: 'test',
              sourceEntryIds: ['entry-current'],
              evidence: extraction.signals[0]!.evidence,
            },
          ],
        },
        graph: {
          propose: async () => ({
            facts: [],
            edges: [],
            conflicts: [
              {
                currentFactId: 'fact-current',
                previousUnderstandingId: 'understanding-old',
                previousStatement: '旧认识',
                reason: 'test',
                confidence: 0.62,
              },
            ],
          }),
        },
      },
    );
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.atomicMemoryCandidates).toEqual([]);
  });
});
