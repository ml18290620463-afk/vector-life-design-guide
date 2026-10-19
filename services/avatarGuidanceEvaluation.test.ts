import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuidanceSource } from './avatarGuidance';
import {
  buildGroundedGuidance,
  sourceMatchesTemporalScope,
} from './avatarGuidance';
import { isSameDurableMemoryAssertion } from './avatarMemoryShared';
import {
  CANDIDATE_MEMORY_TTL,
  readAvatarAtomicMemories,
  writeAvatarAtomicMemory,
} from './avatarMemoryAtoms';
import type { AvatarAtomicMemory } from '../features/avatar/types';

/**
 * A fixed, offline regression set for source selection and memory boundaries.
 * It evaluates our deterministic safety layer, not the quality of any chosen AI model.
 */
const source = (patch: Partial<GuidanceSource>): GuidanceSource => ({
  id: 'source',
  kind: '偏好',
  text: '用户目前偏好安静的工作环境',
  module: 'past',
  temporalStatus: 'current_understanding',
  ...patch,
});

const candidate = (patch: Partial<AvatarAtomicMemory> = {}): AvatarAtomicMemory => ({
  id: 'candidate',
  statement: '用户偏好安静的工作环境',
  nature: 'explicit',
  facets: ['preference'],
  tags: [],
  contexts: [],
  sourceRefs: [{ source: 'message', id: 'dialogue', excerpt: '我喜欢安静的环境' }],
  confidence: 0.7,
  status: 'candidate',
  sensitivity: 'normal',
  createdAt: Date.now(),
  ...patch,
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('avatar guidance fixed evaluation set', () => {
  it('uses a current confirmed understanding for a current question', () => {
    const current = source({ id: 'current', text: '用户目前偏好安静的工作环境' });

    const result = buildGroundedGuidance('我现在适合在什么环境工作？', [current], undefined, {
      preferredSourceIds: ['current'],
    });

    expect(sourceMatchesTemporalScope(current, '我现在适合在什么环境工作？')).toBe(true);
    expect(result.sources.map((item) => item.id)).toEqual(['current']);
  });

  it('does not turn a past event into a current-state claim, but retrieves it for review', () => {
    const past = source({
      id: 'past-state',
      kind: '背景',
      text: '2025 年一次项目冲突后感到疲惫',
      nature: 'state',
      temporalStatus: 'historical_fact',
      evidence: [{ text: '项目冲突后感到疲惫', occurredAt: new Date(2025, 5, 2).getTime(), source: 'entry' }],
    });

    const current = buildGroundedGuidance('我现在是否仍然容易疲惫？', [past], undefined, {
      preferredSourceIds: ['past-state'],
    });
    const review = buildGroundedGuidance('回看过去项目冲突时的状态', [past], undefined, {
      preferredSourceIds: ['past-state'],
    });

    expect(current.sources).toEqual([]);
    expect(current.text).toContain('不能据此判断你现在的感受');
    expect(review.sources.map((item) => item.id)).toEqual(['past-state']);
  });

  it('keeps an old superseded understanding out of current guidance, while allowing comparison', () => {
    const oldUnderstanding = source({
      id: 'old-understanding',
      text: '用户曾把高强度工作视为首要目标',
      temporalStatus: 'historical_understanding',
    });
    const currentUnderstanding = source({
      id: 'current-understanding',
      text: '用户目前更重视稳定节奏与长期投入',
    });

    const current = buildGroundedGuidance('我现在该怎样安排工作节奏？', [oldUnderstanding, currentUnderstanding], undefined, {
      preferredSourceIds: ['old-understanding', 'current-understanding'],
    });
    const comparison = buildGroundedGuidance('回看我对工作节奏的变化', [oldUnderstanding, currentUnderstanding], undefined, {
      preferredSourceIds: ['old-understanding', 'current-understanding'],
    });

    expect(current.sources.map((item) => item.id)).toEqual(['current-understanding']);
    expect(comparison.sources.map((item) => item.id)).toEqual(
      expect.arrayContaining(['old-understanding', 'current-understanding']),
    );
  });

  it('labels dialogue self-reports as dialogue rather than recorded experiences', () => {
    const dialogue = source({
      id: 'dialogue',
      text: '用户喜欢简洁的表达',
      evidence: [{ text: '我喜欢简洁的表达', occurredAt: 1, source: 'message' }],
    });

    const result = buildGroundedGuidance('我对表达有什么偏好？', [dialogue], undefined, {
      preferredSourceIds: ['dialogue'],
    });

    expect(result.text).toContain('一次对话中提到过');
    expect(result.text).not.toContain('经历记录');
  });

  it('merges equivalent durable assertions only when claim type and real context agree', () => {
    const concise = {
      statement: '用户偏好简洁直接的界面',
      facets: ['preference'],
      nature: 'explicit',
      contexts: ['产品体验'],
    };

    expect(
      isSameDurableMemoryAssertion(concise, {
        ...concise,
        statement: '用户喜欢直接、简洁的界面',
      }),
    ).toBe(true);
    expect(
      isSameDurableMemoryAssertion(concise, {
        ...concise,
        contexts: ['社交沟通'],
      }),
    ).toBe(false);
    expect(
      isSameDurableMemoryAssertion(concise, {
        ...concise,
        nature: 'inferred',
      }),
    ).toBe(false);
  });

  it('physically removes an unconfirmed candidate after 24 hours before it can become guidance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:00:00.000Z'));
    writeAvatarAtomicMemory(candidate());

    vi.advanceTimersByTime(CANDIDATE_MEMORY_TTL);

    expect(readAvatarAtomicMemories()).toEqual([]);
  });
});
