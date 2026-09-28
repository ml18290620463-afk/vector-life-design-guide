import { describe, expect, it } from 'vitest';
import type { ActionItem, Principle } from '../types';
import type { FutureState, Goal, Vision } from '../types/future';
import {
  resolveAvatarKnowledge,
  avatarMemoryIdForGoal,
  avatarMemoryIdForPrinciple,
  avatarMemoryIdForVision,
  projectActionToAvatarMemory,
  projectFutureRelations,
  projectGoalToAvatarMemory,
  projectPrincipleToAvatarMemory,
  projectVisionToAvatarMemory,
} from './avatarKnowledgeProjection';
import { emptyFutureState } from './futureRepository';

describe('avatar knowledge projection', () => {
  it('projects a user principle as confirmed hidden value memory', () => {
    const principle: Principle = {
      id: 'principle-1',
      text: '不再用牺牲睡眠换取短期进度',
      tags: ['健康'],
      year: 2026,
      createdAt: 10,
      showOnHome: false,
      sourcePatternIds: ['pattern-1'],
      derivedFromEntryIds: ['entry-1'],
      application: { trigger: '临近截止日期', action: '先缩小任务范围' },
    };

    const [memory] = projectPrincipleToAvatarMemory(principle);

    expect(memory).toMatchObject({
      id: avatarMemoryIdForPrinciple('principle-1'),
      nature: 'commitment',
      status: 'confirmed',
      confirmedBy: 'user',
    });
    expect(memory.facets).toEqual(expect.arrayContaining(['value', 'boundary', 'motivation']));
    expect(memory.sourceRefs.map((ref) => `${ref.source}:${ref.id}`)).toEqual(
      expect.arrayContaining(['principle:principle-1', 'pattern:pattern-1', 'entry:entry-1']),
    );
  });

  it('projects future vision and goal as direction memories without todo semantics', () => {
    const vision: Vision = {
      id: 'vision-1',
      text: '成为更接近山林的人',
      status: 'active',
      revision: 1,
      createdAt: 10,
      updatedAt: 20,
    };
    const goal: Goal = {
      id: 'goal-1',
      title: '一年爬十座山',
      visionId: vision.id,
      measurement: { kind: 'quantity', target: 10, unit: '座', precision: 0, distinctItems: true },
      status: 'active',
      tags: ['自然'],
      revision: 1,
      createdAt: 30,
      updatedAt: 40,
    };

    expect(projectVisionToAvatarMemory(vision)[0]).toMatchObject({
      id: avatarMemoryIdForVision('vision-1'),
      facets: ['aspirational_self', 'motivation'],
      status: 'confirmed',
    });
    const [goalMemory] = projectGoalToAvatarMemory(goal, vision);
    expect(goalMemory).toMatchObject({
      id: avatarMemoryIdForGoal('goal-1'),
      nature: 'commitment',
      status: 'confirmed',
    });
    expect(goalMemory.contexts).toEqual(
      expect.arrayContaining(['自然', '目标 10座', '服务愿景：成为更接近山林的人']),
    );
  });

  it('creates only explicit structural relations between action, goal, vision, and principle', () => {
    const state: FutureState = {
      ...emptyFutureState(),
      visions: [
        {
          id: 'vision-1',
          text: '亲近自然',
          status: 'active',
          revision: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      goals: [
        {
          id: 'goal-1',
          title: '爬十座山',
          visionId: 'vision-1',
          measurement: {
            kind: 'quantity',
            target: 10,
            unit: '座',
            precision: 0,
            distinctItems: true,
          },
          status: 'active',
          tags: [],
          revision: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    const action: ActionItem = {
      id: 'action-1',
      title: '周末查路线',
      status: 'pending',
      goalId: 'goal-1',
      principleId: 'principle-1',
      createdAt: 1,
    };

    expect(projectActionToAvatarMemory(action)[0].sourceRefs.map((ref) => ref.source)).toEqual([
      'action',
      'future',
      'principle',
    ]);
    expect(projectFutureRelations(state, [action]).map((item) => item.kind)).toEqual([
      'serves',
      'serves',
      'constrains',
    ]);
  });
});

it('uses canonical content after conversion without suppressing independent equal text or reviving removed plans', () => {
  const original = {
    id: 'proposal-1',
    statement: '今晚散步',
    nature: 'commitment' as const,
    facets: [],
    tags: [],
    contexts: [],
    sourceRefs: [],
    status: 'confirmed' as const,
    confidence: 1,
    sensitivity: 'normal' as const,
    createdAt: 1,
  };
  const future = {
    ...emptyFutureState(),
    archiveOrigins: {
      'proposal-1': {
        kind: 'action' as const,
        id: 'action-1',
        sourceRefs: [{ source: 'message' as const, id: 'chat-1' }],
      },
    },
  };
  const input = {
    memories: [original, { ...original, id: 'independent' }],
    principles: [],
    future,
  };
  const action: ActionItem = { id: 'action-1', title: '明晚散步', status: 'pending', createdAt: 1 };
  const projected = resolveAvatarKnowledge({ ...input, actions: [action] }).memories;
  expect(projected.map((m) => m.id)).not.toContain('proposal-1');
  expect(projected.find((m) => m.id === 'independent')?.statement).toBe('今晚散步');
  const canonical = projected.find((m) => m.sourceRefs[0]?.id === action.id)!;
  expect(canonical.statement).toContain('明晚散步');
  expect(canonical.sourceRefs).toContainEqual({ source: 'message', id: 'chat-1' });
  expect(
    resolveAvatarKnowledge({
      ...input,
      actions: [{ ...action, status: 'completed' }],
    }).memories.find((m) => m.id === canonical.id)?.status,
  ).toBe('retained');
  expect(resolveAvatarKnowledge({ ...input, actions: [] }).memories.map((m) => m.id)).toEqual([
    'independent',
  ]);
});
