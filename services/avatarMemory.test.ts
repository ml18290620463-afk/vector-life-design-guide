import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveAvatarMemoryTag,
  buildAvatarMemoryTagOverview,
  mergeAvatarMemoryTags,
  readAvatarMemoryTags,
  renameAvatarMemoryTag,
  restoreAvatarMemoryTag,
  updateAvatarMemoryTags,
  pruneAvatarAtomicMemoriesBySourceIds,
  pruneAvatarMemoryRelationsByMemoryIds,
  readAvatarAtomicMemories,
  readAvatarMemoryRelations,
  readAvatarSession,
  readAvatarConversation,
  readAvatarUnderstandings,
  pruneAvatarUnderstandingsByEntryIds,
  reconcileAvatarUnderstandingsWithEntries,
  sanitizeAvatarAtomicMemories,
  sanitizeAvatarUnderstandings,
  sanitizeAvatarSessions,
  updateAvatarAtomicMemoryStatus,
  supersedeAvatarAtomicMemory,
  supersedeAvatarUnderstanding,
  isPatternMemoryReadyForConfirmation,
  upsertAvatarMemoryRelations,
  upsertAvatarAtomicMemories,
  writeAvatarAtomicMemory,
  updateAvatarUnderstandingStatus,
  writeAvatarSession,
  writeAvatarUnderstanding,
} from './avatarMemory';
import type { AvatarMemoryFacet } from '../features/avatar/types';

describe('avatarMemory', () => {
  beforeEach(() => localStorage.clear());

  it('only surfaces conversational pattern observations after evidence accumulates across days', () => {
    const base = {
      id: 'pattern-observation',
      statement: '用户在复杂选择前倾向先厘清判断依据',
      nature: 'inferred' as const,
      category: 'judgment' as const,
      facets: ['cognitive_pattern'] as AvatarMemoryFacet[],
      tags: [],
      contexts: ['对话记忆', '待验证模式'],
      confidence: 0.5,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt: 1,
    };
    expect(
      isPatternMemoryReadyForConfirmation({
        ...base,
        sourceRefs: [
          { source: 'message', id: 'one', createdAt: Date.parse('2026-09-20T08:00:00Z') },
          { source: 'message', id: 'two', createdAt: Date.parse('2026-09-20T09:00:00Z') },
          { source: 'message', id: 'three', createdAt: Date.parse('2026-09-20T10:00:00Z') },
        ],
      }),
    ).toBe(false);
    expect(
      isPatternMemoryReadyForConfirmation({
        ...base,
        sourceRefs: [
          { source: 'message', id: 'one', createdAt: Date.parse('2026-09-20T08:00:00Z') },
          { source: 'message', id: 'two', createdAt: Date.parse('2026-09-20T09:00:00Z') },
          { source: 'message', id: 'three', createdAt: Date.parse('2026-09-21T10:00:00Z') },
        ],
      }),
    ).toBe(true);
  });

  it('accepts evidence from independent conversations on the same day, but not repeated turns in one conversation', () => {
    const base = {
      id: 'pattern-observation',
      statement: '用户在复杂选择前倾向先厘清判断依据',
      nature: 'inferred' as const,
      category: 'judgment' as const,
      facets: ['cognitive_pattern'] as AvatarMemoryFacet[],
      tags: [],
      contexts: ['对话记忆', '待验证模式'],
      confidence: 0.5,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt: 1,
    };
    const sameDay = Date.parse('2026-09-20T08:00:00Z');
    expect(
      isPatternMemoryReadyForConfirmation({
        ...base,
        sourceRefs: [
          { source: 'message', id: 'one', createdAt: sameDay, sessionId: 'session-a' },
          { source: 'message', id: 'two', createdAt: sameDay + 1, sessionId: 'session-a' },
          { source: 'message', id: 'three', createdAt: sameDay + 2, sessionId: 'session-a' },
        ],
      }),
    ).toBe(false);
    expect(
      isPatternMemoryReadyForConfirmation({
        ...base,
        sourceRefs: [
          { source: 'message', id: 'one', createdAt: sameDay, sessionId: 'session-a' },
          { source: 'message', id: 'two', createdAt: sameDay + 1, sessionId: 'session-b' },
          { source: 'message', id: 'three', createdAt: sameDay + 2, sessionId: 'session-b' },
        ],
      }),
    ).toBe(true);
  });

  it('merges unconfirmed pattern observations only when their conservative keys match', () => {
    const makePattern = (
      id: string,
      statement: string,
      patternKey: string,
      sourceId: string,
      createdAt: number,
    ) => ({
      id,
      statement,
      nature: 'inferred' as const,
      category: 'judgment' as const,
      facets: ['cognitive_pattern'] as AvatarMemoryFacet[],
      patternKey,
      tags: [],
      contexts: ['对话记忆', '待验证模式'],
      sourceRefs: [{ source: 'message' as const, id: sourceId, createdAt }],
      confidence: 0.5,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt,
    });
    expect(
      writeAvatarAtomicMemory(
        makePattern('one', '用户在压力下可能先独处梳理', '压力下先独处梳理', 'm1', 1),
      ),
    ).toBe(true);
    expect(
      writeAvatarAtomicMemory(
        makePattern('two', '面对复杂压力时用户通常先一个人想清楚', '压力下先独处梳理', 'm2', 2),
      ),
    ).toBe(true);
    expect(readAvatarAtomicMemories()).toHaveLength(1);
    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      id: 'one',
      patternKey: '压力下先独处梳理',
    });
    expect(readAvatarAtomicMemories()[0].sourceRefs.map((source) => source.id)).toEqual([
      'm1',
      'm2',
    ]);
    expect(
      writeAvatarAtomicMemory(
        makePattern('three', '用户在冲突时会先延后表达', '冲突中延后表达', 'm3', 3),
      ),
    ).toBe(true);
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });

  it('does not merge a new pattern observation into a confirmed pattern', () => {
    const base = {
      statement: '用户在压力下可能先独处梳理',
      nature: 'inferred' as const,
      category: 'judgment' as const,
      facets: ['cognitive_pattern'] as AvatarMemoryFacet[],
      patternKey: '压力下先独处梳理',
      tags: [],
      contexts: [],
      sourceRefs: [{ source: 'message' as const, id: 'old', createdAt: 1 }],
      confidence: 0.5,
      sensitivity: 'normal' as const,
      createdAt: 1,
    };
    expect(
      writeAvatarAtomicMemory({
        ...base,
        id: 'confirmed',
        status: 'confirmed',
        confirmedAt: 1,
        confirmedBy: 'user',
      }),
    ).toBe(true);
    expect(
      writeAvatarAtomicMemory({
        ...base,
        id: 'candidate',
        statement: '面对压力时用户倾向先独处想清楚',
        status: 'candidate',
        sourceRefs: [{ source: 'message', id: 'new', createdAt: 2 }],
      }),
    ).toBe(true);
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });

  it('drops malformed sessions and restores a valid matching session', () => {
    expect(sanitizeAvatarSessions([{ id: 'bad' }, null])).toEqual([]);
    const session = {
      id: 'session-1',
      mode: 'recall' as const,
      context: { mode: 'recall' as const, source: 'past-search' as const, query: '项目' },
      messages: [],
      references: [],
      createdAt: 10,
      updatedAt: 20,
    };
    expect(writeAvatarSession(session)).toBe(true);
    expect(readAvatarSession(session.context)?.id).toBe('session-1');
  });

  it('recovers fragmented general chats without duplicates or unrelated conversations', () => {
    const context = { mode: 'general' as const, source: 'global' as const };
    const first = {
      id: 'name',
      role: 'user' as const,
      type: 'text' as const,
      content: '你叫Vector',
      created_at: '2026-09-01T00:00:00Z',
    };
    const second = {
      ...first,
      id: 'next',
      content: '明天去散步',
      created_at: '2026-09-02T00:00:00Z',
    };
    const base = { mode: 'general' as const, context, references: [], createdAt: 1 };
    writeAvatarSession({ ...base, id: 'old', messages: [first], updatedAt: 1 });
    writeAvatarSession({ ...base, id: 'new', messages: [first, second], updatedAt: 2 });
    writeAvatarSession({ ...base, id: 'blank', messages: [], updatedAt: 3 });
    writeAvatarSession({
      ...base,
      id: 'other',
      context: { ...context, entryId: 'different' },
      messages: [{ ...first, id: 'unrelated' }],
      updatedAt: 4,
    });
    const restored = readAvatarConversation(context)!;
    expect(restored.id).toBe('new');
    expect(restored.messages.map((m) => m.content)).toEqual(['你叫Vector', '明天去散步']);
    writeAvatarSession({ ...restored, updatedAt: 5 });
    expect(readAvatarConversation(context)?.messages).toHaveLength(2);
  });

  it('keeps a long general conversation for paged reading', () => {
    const context = { mode: 'general' as const, source: 'global' as const };
    const messages = Array.from({ length: 360 }, (_, index) => ({
      id: `long-turn-${index}`,
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      type: 'text' as const,
      content: `历史消息 ${index}`,
      created_at: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
    }));

    expect(
      writeAvatarSession({
        id: 'long-session',
        mode: 'general',
        context,
        messages,
        references: [],
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toBe(true);

    expect(readAvatarConversation(context)?.messages).toHaveLength(360);
  });

  it('supersedes the previous confirmed understanding', () => {
    writeAvatarUnderstanding({
      id: 'v1',
      statement: '旧理解',
      status: 'confirmed',
      sourceEntryIds: [],
      createdAt: 1,
    });
    writeAvatarUnderstanding({
      id: 'v2',
      statement: '新理解',
      status: 'confirmed',
      sourceEntryIds: [],
      createdAt: 2,
      previousVersionId: 'v1',
    });
    expect(readAvatarUnderstandings().map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'v2', status: 'confirmed' },
      { id: 'v1', status: 'superseded' },
    ]);
  });

  it('keeps established patterns when another independent observation is confirmed', () => {
    writeAvatarUnderstanding({
      id: 'pattern-established',
      statement: '面对复杂选择时会先独处整理',
      status: 'confirmed',
      sourceEntryIds: ['entry-1', 'entry-2'],
      createdAt: 1,
      confirmedAt: 1,
      confirmedBy: 'user',
    });
    writeAvatarUnderstanding({
      id: 'pattern-new',
      statement: '在合作中会先澄清彼此期待',
      status: 'confirmed',
      sourceEntryIds: ['entry-3', 'entry-4'],
      createdAt: 2,
      confirmedAt: 2,
      confirmedBy: 'user',
    });

    expect(readAvatarUnderstandings().map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'pattern-new', status: 'confirmed' },
      { id: 'pattern-established', status: 'confirmed' },
    ]);
  });

  it('updates one understanding without superseding other confirmed patterns', () => {
    writeAvatarUnderstanding({
      id: 'pattern-one',
      statement: '模式一',
      status: 'pending',
      sourceEntryIds: [],
      createdAt: 2,
    });
    writeAvatarUnderstanding({
      id: 'pattern-two',
      statement: '模式二',
      status: 'pending',
      sourceEntryIds: [],
      createdAt: 1,
    });
    updateAvatarUnderstandingStatus('pattern-one', 'confirmed');
    updateAvatarUnderstandingStatus('pattern-two', 'confirmed');

    expect(readAvatarUnderstandings().map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'pattern-one', status: 'confirmed' },
      { id: 'pattern-two', status: 'confirmed' },
    ]);
  });

  it('revises one confirmed pattern as a new version without changing other patterns', () => {
    writeAvatarUnderstanding({
      id: 'pattern-to-revise',
      statement: '面对压力时先独处整理',
      status: 'confirmed',
      sourceEntryIds: ['entry-1', 'entry-2'],
      createdAt: 1,
      confirmedAt: 1,
      confirmedBy: 'user',
      patternDomain: 'coping',
      patternLabel: '独处整理',
      trigger: '压力出现',
      response: '先独处',
      outcome: '恢复清晰',
    });
    writeAvatarUnderstanding({
      id: 'pattern-to-keep',
      statement: '合作前会先澄清期待',
      status: 'confirmed',
      sourceEntryIds: ['entry-3'],
      createdAt: 2,
      confirmedAt: 2,
      confirmedBy: 'user',
    });
    const now = vi.spyOn(Date, 'now').mockReturnValue(100);
    const revised = supersedeAvatarUnderstanding('pattern-to-revise', '面对持续压力时会先寻求支持');
    now.mockRestore();

    expect(revised).toMatchObject({
      statement: '面对持续压力时会先寻求支持',
      status: 'confirmed',
      previousVersionId: 'pattern-to-revise',
      sourceEntryIds: ['entry-1', 'entry-2'],
      patternDomain: 'coping',
      trigger: '压力出现',
    });
    expect(readAvatarUnderstandings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'pattern-to-revise', status: 'superseded', updatedAt: 100 }),
        expect.objectContaining({ id: 'pattern-to-keep', status: 'confirmed' }),
        expect.objectContaining({
          id: revised?.id,
          previousVersionId: 'pattern-to-revise',
          status: 'confirmed',
        }),
      ]),
    );
  });

  it('replaces a confirmed memory atomically and keeps the prior wording as a dated version', () => {
    const original = {
      id: 'current-role',
      statement: '我目前在上海从事产品设计',
      nature: 'state' as const,
      category: 'recent_state' as const,
      facets: ['domain_background' as const],
      tags: ['工作'],
      contexts: ['近况'],
      sourceRefs: [{ source: 'message' as const, id: 'message-1', createdAt: 100 }],
      confidence: 0.9,
      status: 'confirmed' as const,
      sensitivity: 'normal' as const,
      createdAt: 100,
      confirmedAt: 100,
      confirmedBy: 'user' as const,
    };
    expect(writeAvatarAtomicMemory(original)).toBe(true);
    const now = 200;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    const replacement = supersedeAvatarAtomicMemory(original.id, '我目前在杭州从事产品设计');
    dateNow.mockRestore();

    expect(replacement).toMatchObject({
      statement: '我目前在杭州从事产品设计',
      status: 'confirmed',
      previousVersionId: original.id,
      validFrom: now,
      confirmedAt: now,
      confirmedBy: 'user',
    });
    expect(readAvatarAtomicMemories()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: original.id, status: 'superseded', validTo: now }),
        expect.objectContaining({
          id: replacement?.id,
          previousVersionId: original.id,
          status: 'confirmed',
        }),
      ]),
    );
    expect(supersedeAvatarAtomicMemory(original.id, '不会覆盖已归档版本')).toBeNull();
    expect(supersedeAvatarAtomicMemory(replacement!.id, '   ')).toBeNull();
    expect(supersedeAvatarAtomicMemory('missing', '不存在')).toBeNull();
  });

  it('marks a confirmed pattern as user-confirmed avatar summary', () => {
    writeAvatarUnderstanding({
      id: 'pattern-live',
      statement: '压力出现时，我倾向于先放一放。',
      status: 'pending',
      sourceEntryIds: ['entry-1', 'entry-2'],
      createdAt: 10,
    });

    const updated = updateAvatarUnderstandingStatus('pattern-live', 'confirmed');

    expect(updated).toMatchObject({
      id: 'pattern-live',
      status: 'confirmed',
      confirmedBy: 'user',
      summaryKind: 'past-pattern',
    });
    expect(typeof updated?.confirmedAt).toBe('number');
    expect(readAvatarUnderstandings()[0]).toMatchObject({
      id: 'pattern-live',
      status: 'confirmed',
      confirmedBy: 'user',
      summaryKind: 'past-pattern',
    });
    expect(typeof readAvatarUnderstandings()[0]?.confirmedAt).toBe('number');
    // The pattern repository owns this data; the archive resolves a read-only view.
    expect(readAvatarAtomicMemories()).toEqual([]);
  });

  it('returns null when the understanding does not exist', () => {
    expect(updateAvatarUnderstandingStatus('missing', 'confirmed')).toBeNull();
  });

  it('removes orphaned patterns and retains patterns with other evidence', () => {
    writeAvatarUnderstanding({
      id: 'only-source',
      statement: '唯一来源模式',
      status: 'pending',
      sourceEntryIds: ['entry-1'],
      createdAt: 1,
    });
    writeAvatarUnderstanding({
      id: 'two-sources',
      statement: '多个来源模式',
      status: 'pending',
      sourceEntryIds: ['entry-1', 'entry-2'],
      createdAt: 2,
    });

    const result = pruneAvatarUnderstandingsByEntryIds(['entry-1']);

    expect(result.removedPatternIds).toEqual(['only-source']);
    expect(readAvatarUnderstandings()).toEqual([
      expect.objectContaining({ id: 'two-sources', sourceEntryIds: ['entry-2'] }),
    ]);
  });

  it('keeps a pattern when the user retains knowledge after deleting its only source', () => {
    writeAvatarUnderstanding({
      id: 'retained-pattern',
      statement: '用户选择保留的模式',
      status: 'confirmed',
      sourceEntryIds: ['entry-1'],
      createdAt: 1,
    });

    const result = pruneAvatarUnderstandingsByEntryIds(['entry-1'], true);

    expect(result.removedPatternIds).toEqual([]);
    expect(readAvatarUnderstandings()).toEqual([
      expect.objectContaining({
        id: 'retained-pattern',
        sourceEntryIds: [],
        retainedAfterSourceDeletion: true,
      }),
    ]);
  });

  it('repairs patterns orphaned by deletions made in older builds', () => {
    writeAvatarUnderstanding({
      id: 'legacy-orphan',
      statement: '遗留模式',
      status: 'confirmed',
      sourceEntryIds: ['deleted-entry'],
      createdAt: 1,
    });

    expect(reconcileAvatarUnderstandingsWithEntries(['existing-entry']).removedPatternIds).toEqual([
      'legacy-orphan',
    ]);
    expect(readAvatarUnderstandings()).toEqual([]);
  });

  it('keeps only supported non-clinical pattern domains', () => {
    const base = {
      statement: '具体情境中的具体反应',
      status: 'pending' as const,
      sourceEntryIds: ['entry-1', 'entry-2'],
      createdAt: 10,
    };

    const [valid, invalid] = sanitizeAvatarUnderstandings([
      { ...base, id: 'valid', patternDomain: 'cognitive' },
      { ...base, id: 'invalid', patternDomain: 'personality-disorder' },
    ]);

    expect(valid?.patternDomain).toBe('cognitive');
    expect(invalid).not.toHaveProperty('patternDomain');
  });

  it('stores fine-grained avatar atomic memories without accepting malformed facets', () => {
    const [valid, invalid] = sanitizeAvatarAtomicMemories([
      {
        id: 'memory-1',
        statement: '用户偏好清爽、少解释的界面',
        nature: 'explicit',
        facets: ['preference'],
        tags: ['界面偏好', '界面偏好', '  '],
        contexts: ['产品设计'],
        sourceRefs: [{ source: 'entry', id: 'entry-1', excerpt: '不要这么多提示语句' }],
        confidence: 2,
        status: 'candidate',
        sensitivity: 'normal',
        createdAt: 1,
      },
      {
        id: 'memory-2',
        statement: '错误分类',
        nature: 'explicit',
        facets: ['diagnosis'],
        sourceRefs: [],
        confidence: 0.5,
        status: 'candidate',
        sensitivity: 'normal',
        createdAt: 1,
      },
    ]);

    expect(valid).toMatchObject({ id: 'memory-1', facets: ['preference'], confidence: 1 });
    expect(valid?.tags).toEqual(['界面偏好']);
    expect(invalid).toBeUndefined();
    expect(writeAvatarAtomicMemory(valid!)).toBe(true);
    expect(readAvatarAtomicMemories()[0]?.statement).toContain('清爽');
  });

  it('merges identical statements from different sources while preserving every source', () => {
    const base = {
      statement: '我在重要关系中重视边界。',
      nature: 'explicit' as const,
      facets: ['boundary' as const],
      tags: ['关系'],
      contexts: ['亲密关系'],
      confidence: 0.7,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt: 10,
    };
    upsertAvatarAtomicMemories([
      { ...base, id: 'entry-memory', sourceRefs: [{ source: 'entry' as const, id: 'entry-1' }] },
      {
        ...base,
        id: 'principle-memory',
        statement: '我在重要关系中重视边界',
        tags: ['原则'],
        sourceRefs: [{ source: 'principle' as const, id: 'principle-1' }],
      },
    ]);

    expect(readAvatarAtomicMemories()).toEqual([
      expect.objectContaining({
        id: 'entry-memory',
        tags: ['关系', '原则'],
        sourceRefs: expect.arrayContaining([
          expect.objectContaining({ source: 'entry', id: 'entry-1' }),
          expect.objectContaining({ source: 'principle', id: 'principle-1' }),
        ]),
      }),
    ]);
  });

  it('does not silently merge similar but different statements', () => {
    const base = {
      nature: 'explicit' as const,
      facets: ['preference' as const],
      tags: [],
      contexts: [],
      sourceRefs: [],
      confidence: 0.7,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt: 10,
    };
    upsertAvatarAtomicMemories([
      { ...base, id: 'memory-a', statement: '我偏好清晰的表达' },
      { ...base, id: 'memory-b', statement: '我偏好简短的表达' },
    ]);
    expect(readAvatarAtomicMemories()).toHaveLength(2);
  });

  it('confirms and prunes avatar atomic memories by deleted source', () => {
    writeAvatarAtomicMemory({
      id: 'memory-source',
      statement: '用户在关系里重视边界',
      nature: 'explicit',
      facets: ['boundary'],
      tags: ['人际关系'],
      contexts: ['人际关系'],
      sourceRefs: [{ source: 'entry', id: 'entry-1' }],
      confidence: 0.82,
      status: 'candidate',
      sensitivity: 'sensitive',
      createdAt: 1,
    });

    expect(updateAvatarAtomicMemoryStatus('memory-source', 'confirmed')).toMatchObject({
      status: 'confirmed',
      confirmedBy: 'user',
    });
    const retained = pruneAvatarAtomicMemoriesBySourceIds(['entry-1'], true);
    expect(retained.removedMemoryIds).toEqual([]);
    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      id: 'memory-source',
      status: 'retained',
      sourceRefs: [],
      retainedAfterSourceDeletion: true,
    });

    writeAvatarAtomicMemory({
      id: 'memory-delete',
      statement: '只来自一条经历的临时状态',
      nature: 'state',
      facets: ['constraint'],
      tags: [],
      contexts: [],
      sourceRefs: [{ source: 'entry', id: 'entry-2' }],
      confidence: 0.6,
      status: 'candidate',
      sensitivity: 'normal',
      createdAt: 2,
    });
    const removed = pruneAvatarAtomicMemoriesBySourceIds(['entry-2']);
    expect(removed.removedMemoryIds).toEqual(['memory-delete']);
    expect(readAvatarAtomicMemories().some((memory) => memory.id === 'memory-delete')).toBe(false);
  });

  it('updates one memory tags and maintains the tag catalog', () => {
    writeAvatarAtomicMemory({
      id: 'memory-tags-update',
      statement: '用户正在整理分身产品的记忆系统',
      nature: 'explicit',
      facets: ['value'],
      tags: ['分身产品'],
      contexts: ['产品设计'],
      sourceRefs: [{ source: 'message', id: 'msg-1', excerpt: '标签统领整个记忆系统' }],
      confidence: 0.8,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 1,
      confirmedAt: 1,
      confirmedBy: 'user',
    });

    const updated = updateAvatarMemoryTags('memory-tags-update', [
      '分身产品',
      '记忆系统',
      '分身产品',
    ]);

    expect(updated?.tags).toEqual(['分身产品', '记忆系统']);
    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      id: 'memory-tags-update',
      statement: '用户正在整理分身产品的记忆系统',
      status: 'confirmed',
      nature: 'explicit',
      sourceRefs: [{ source: 'message', id: 'msg-1', excerpt: '标签统领整个记忆系统' }],
      tags: ['分身产品', '记忆系统'],
    });
    expect(readAvatarMemoryTags().map((tag) => tag.name)).toEqual(
      expect.arrayContaining(['分身产品', '记忆系统']),
    );
  });

  it('renames avatar memory tags without changing statement source or status', () => {
    writeAvatarAtomicMemory({
      id: 'memory-rename-tag',
      statement: '用户重视低成本验证产品方向',
      nature: 'explicit',
      facets: ['value'],
      tags: ['旧标签', '产品'],
      contexts: [],
      sourceRefs: [{ source: 'entry', id: 'entry-rename' }],
      confidence: 0.82,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 10,
      confirmedAt: 10,
      confirmedBy: 'user',
    });

    expect(renameAvatarMemoryTag('旧标签', '职业发展')).toBe(true);

    expect(readAvatarAtomicMemories()[0]).toMatchObject({
      id: 'memory-rename-tag',
      statement: '用户重视低成本验证产品方向',
      nature: 'explicit',
      status: 'confirmed',
      sourceRefs: [{ source: 'entry', id: 'entry-rename' }],
      tags: ['职业发展', '产品'],
    });
    expect(readAvatarMemoryTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '职业发展', status: 'active', aliases: ['旧标签'] }),
      ]),
    );
  });

  it('merges avatar memory tags and keeps unique tags', () => {
    writeAvatarAtomicMemory({
      id: 'memory-merge-tag',
      statement: '用户把分身产品作为当前实验方向',
      nature: 'commitment',
      facets: ['motivation'],
      tags: ['分身', 'AI分身', '产品实验'],
      contexts: [],
      sourceRefs: [{ source: 'message', id: 'msg-merge' }],
      confidence: 0.72,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 20,
      confirmedAt: 20,
      confirmedBy: 'user',
    });

    expect(mergeAvatarMemoryTags(['分身', 'AI分身'], '分身产品')).toBe(true);

    expect(readAvatarAtomicMemories()[0]?.tags).toEqual(['分身产品', '产品实验']);
    expect(readAvatarMemoryTags()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '分身产品', status: 'active' }),
        expect.objectContaining({ name: '分身', status: 'archived' }),
        expect.objectContaining({ name: 'AI分身', status: 'archived' }),
      ]),
    );
    expect(buildAvatarMemoryTagOverview().find((tag) => tag.name === '分身产品')?.memoryCount).toBe(
      1,
    );
  });

  it('archives and restores a tag without removing it from memories', () => {
    writeAvatarAtomicMemory({
      id: 'memory-archive-tag',
      statement: '用户希望标签统领记忆系统',
      nature: 'explicit',
      facets: ['preference'],
      tags: ['记忆系统'],
      contexts: [],
      sourceRefs: [{ source: 'message', id: 'msg-archive' }],
      confidence: 0.82,
      status: 'confirmed',
      sensitivity: 'normal',
      createdAt: 30,
      confirmedAt: 30,
      confirmedBy: 'user',
    });

    expect(archiveAvatarMemoryTag('记忆系统')).toBe(true);
    expect(readAvatarAtomicMemories()[0]?.tags).toEqual(['记忆系统']);
    expect(readAvatarMemoryTags().find((tag) => tag.name === '记忆系统')?.status).toBe('archived');
    expect(restoreAvatarMemoryTag('记忆系统')).toBe(true);
    expect(readAvatarMemoryTags().find((tag) => tag.name === '记忆系统')?.status).toBe('active');
  });

  it('keeps avatar memory relations only while both memories exist', () => {
    upsertAvatarMemoryRelations([
      {
        id: 'rel-1',
        fromId: 'memory-a',
        toId: 'memory-b',
        kind: 'supports',
        confidence: 0.7,
        createdAt: 1,
      },
    ]);

    expect(readAvatarMemoryRelations()).toHaveLength(1);
    pruneAvatarMemoryRelationsByMemoryIds(['memory-a']);
    expect(readAvatarMemoryRelations()).toEqual([]);
  });
});

describe('avatar memory revision boundaries', () => {
  beforeEach(() => localStorage.clear());
  it('preserves confirmed content across extraction and archives explicit revisions', () => {
    const memory = {
      id: 'preference',
      statement: '喜欢详细回答',
      nature: 'explicit' as const,
      facets: ['preference' as const],
      tags: [],
      contexts: [],
      sourceRefs: [],
      confidence: 0.8,
      status: 'confirmed' as const,
      sensitivity: 'normal' as const,
      createdAt: 10,
      confirmedBy: 'user' as const,
      confirmedAt: 10,
    };
    writeAvatarAtomicMemory(memory);
    upsertAvatarAtomicMemories([{ ...memory, statement: '喜欢简短回答', status: 'candidate' }]);
    expect(readAvatarAtomicMemories()).toHaveLength(1);
    expect(readAvatarAtomicMemories()[0].statement).toBe('喜欢详细回答');
    writeAvatarAtomicMemory({ ...memory, statement: '喜欢简短回答', updatedAt: 20 });
    expect(readAvatarAtomicMemories()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statement: '喜欢详细回答', status: 'superseded', validTo: 20 }),
        expect.objectContaining({
          id: 'preference',
          statement: '喜欢简短回答',
          status: 'confirmed',
        }),
      ]),
    );
  });
});

it('does not resurrect rejected or superseded memories through fresh extraction, new ids or matching pattern keys', () => {
  for (const status of ['rejected', 'superseded'] as const) {
    localStorage.clear();
    const base = {
      id: 'old',
      statement: '用户在压力下先独处',
      nature: 'inferred' as const,
      category: 'judgment' as const,
      facets: ['cognitive_pattern'] as AvatarMemoryFacet[],
      tags: [],
      contexts: [],
      confidence: 0.5,
      status: 'candidate' as const,
      sensitivity: 'normal' as const,
      createdAt: 1,
      patternKey: '压力下先独处',
      sourceRefs: [{ source: 'message' as const, id: 'msg', createdAt: 1 }],
    };
    writeAvatarAtomicMemory(base);
    updateAvatarAtomicMemoryStatus('old', status);
    upsertAvatarAtomicMemories([{ ...base, id: 'new-extraction', createdAt: 2 }]);
    upsertAvatarAtomicMemories([
      { ...base, id: 'different-wording', statement: '面对压力可能先一个人整理', createdAt: 3 },
    ]);
    upsertAvatarAtomicMemories([{ ...base, id: 'old', status: 'confirmed', createdAt: 4 }]);
    expect(readAvatarAtomicMemories()).toHaveLength(1);
    expect(readAvatarAtomicMemories()[0].status).toBe(status);
  }
});
