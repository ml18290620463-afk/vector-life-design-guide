import { aiPrivacyToken } from './aiPrivacy';
import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import type { AvatarSession, AvatarMemorySourceRef } from '../features/avatar/types';
import {
  resolveAvatarSourceEvidence,
  resolveOntologyEvidence,
  computeOntologyEvidenceGate,
} from './avatarSourceEvidence';

const entry: DiaryEntry = {
  id: 'e',
  title: '',
  content: '我的经历',
  tags: [],
  createdAt: 1,
  aiVisibility: 'allowed' as const,
  isLocked: false,
  supplements: [{ id: 's', content: '补充事实', createdAt: 2 }],
};
const refs: AvatarMemorySourceRef[] = [
  { source: 'entry', id: 'e', excerpt: '我的经历' },
  { source: 'entry', id: 'e', supplementId: 's', excerpt: '补充事实' },
];
const session: AvatarSession = {
  id: 'chat',
  mode: 'general',
  context: { mode: 'general', source: 'global' },
  messages: [
    {
      aiPrivacyToken: aiPrivacyToken([entry]),
      id: 'm',
      role: 'user',
      type: 'text',
      content: '我的想法',
      created_at: '2026-01-01',
    },
  ],
  references: [],
  createdAt: 1,
  updatedAt: 1,
};
const chatRef: AvatarMemorySourceRef = {
  source: 'message',
  id: 'm',
  sessionId: 'chat',
  excerpt: '我的想法',
};

describe('live source evidence', () => {
  it('resolves original, supplement and user dialogue independently', () => {
    expect(resolveAvatarSourceEvidence([...refs, chatRef], [entry], [session], 10)).toHaveLength(3);
  });
  it('hides deleted, locked and encrypted originals, including their supplements', () => {
    for (const entries of [[], [{ ...entry, isLocked: true }], [{ ...entry, isEncrypted: true }]]) {
      expect(resolveAvatarSourceEvidence(refs, entries, [], 10)).toEqual([]);
    }
  });
  it('rejects fabricated excerpts, wrong supplements and encrypted supplements', () => {
    expect(
      resolveAvatarSourceEvidence(
        [
          { ...refs[0], excerpt: '不存在' },
          { ...refs[1], supplementId: 'missing' },
        ],
        [entry],
        [],
        10,
      ),
    ).toEqual([]);
    expect(
      resolveAvatarSourceEvidence(
        [refs[1]],
        [{ ...entry, supplements: [{ ...entry.supplements![0], isEncrypted: true }] }],
        [],
        10,
      ),
    ).toEqual([]);
  });
  it('does not use deleted conversations, wrong sessions or assistant statements', () => {
    expect(resolveAvatarSourceEvidence([chatRef], [], [], 10)).toEqual([]);
    expect(
      resolveAvatarSourceEvidence([{ ...chatRef, sessionId: 'wrong' }], [], [session], 10),
    ).toEqual([]);
    expect(
      resolveAvatarSourceEvidence(
        [chatRef],
        [],
        [{ ...session, messages: [{ ...session.messages[0], role: 'assistant' }] }],
        10,
      ),
    ).toEqual([]);
  });
  it('hides dialogue bound to an inaccessible experience', () => {
    const bound = { ...session, context: { ...session.context, entryId: 'e' } };
    expect(resolveAvatarSourceEvidence([chatRef], [], [bound], 10)).toEqual([]);
    expect(
      resolveAvatarSourceEvidence([chatRef], [{ ...entry, isLocked: true }], [bound], 10),
    ).toEqual([]);
    expect(resolveAvatarSourceEvidence([chatRef], [entry], [bound], 10)).toEqual([chatRef]);
  });
});

describe('v2 live evidence permission boundary', () => {
  const edge: import('../features/avatar/types').EvidencedByEdge = {
    id: 'edge',
    schemaVersion: 2,
    type: 'EVIDENCED_BY',
    fromId: 'cognition',
    toId: 'e',
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceKind: 'past_experience',
    verbatimQuote: '我的经历',
    quoteVerifiedByServer: true,
    sourceOccurredAt: '2026-01-01T00:00:00.000Z',
    lastKnownSourceState: 'accessible',
  };
  it('ignores cached accessible state after privacy, lock, seal, encryption or deletion changes', () => {
    expect(resolveOntologyEvidence([edge], [entry], [], 10)).toEqual([edge]);
    for (const originals of [
      [],
      [{ ...entry, aiVisibility: 'private' as const }],
      [{ ...entry, isLocked: true }],
      [{ ...entry, isEncrypted: true }],
      [{ ...entry, unlockAt: 100 }],
    ]) {
      expect(resolveOntologyEvidence([edge], originals, [], 10)).toEqual([]);
    }
  });
  it('requires server verification and an exact live quote', () => {
    expect(
      resolveOntologyEvidence([{ ...edge, quoteVerifiedByServer: false }], [entry], []),
    ).toEqual([]);
    expect(resolveOntologyEvidence([{ ...edge, verbatimQuote: '伪造' }], [entry], [])).toEqual([]);
    expect(
      resolveOntologyEvidence([{ ...edge, sourceKind: 'action_review' }], [entry], []),
    ).toEqual([]);
  });
  it('requires matching indexed user message and rejects assistant evidence', () => {
    const chat = {
      ...edge,
      toId: 'm',
      sourceKind: 'chat_user_message' as const,
      sessionId: 'chat',
      userMessageIndex: 0,
      verbatimQuote: '我的想法',
    };
    expect(
      resolveOntologyEvidence([chat], [entry], [session], 10, aiPrivacyToken([entry])),
    ).toEqual([chat]);
    expect(
      resolveOntologyEvidence(
        [{ ...chat, userMessageIndex: 1 }],
        [entry],
        [session],
        10,
        aiPrivacyToken([entry]),
      ),
    ).toEqual([]);
    expect(
      resolveOntologyEvidence(
        [chat],
        [entry],
        [{ ...session, messages: [{ ...session.messages[0], role: 'assistant' }] }],
        10,
        aiPrivacyToken([entry]),
      ),
    ).toEqual([]);
    expect(resolveOntologyEvidence([chat], [entry], [session], 10)).toEqual([]);
  });
});

describe('v2 authoritative confirmation gate', () => {
  const now = Date.UTC(2026, 1, 1);
  const object = { id: 'c', domain: 'my_understanding' as const };
  const evidence = (
    id: string,
    toId: string,
  ): import('../features/avatar/types').EvidencedByEdge => ({
    id,
    toId,
    fromId: 'c',
    schemaVersion: 2,
    type: 'EVIDENCED_BY',
    sourceKind: 'past_experience',
    verbatimQuote: '我的经历',
    quoteVerifiedByServer: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sourceOccurredAt: '2026-01-01T00:00:00.000Z',
    lastKnownSourceState: 'accessible',
  });
  it('accepts live supplements but rejects encrypted, future and inaccessible parent evidence', () => {
    const edge = { ...evidence('supplement', 'e'), verbatimQuote: '补充事实' };
    expect(resolveOntologyEvidence([edge], [entry], [], now)).toHaveLength(1);
    for (const original of [
      { ...entry, supplements: [{ ...entry.supplements![0], isEncrypted: true }] },
      { ...entry, supplements: [{ ...entry.supplements![0], createdAt: now + 1 }] },
      { ...entry, supplements: [] },
      { ...entry, isLocked: true },
      { ...entry, isEncrypted: true },
      { ...entry, aiVisibility: 'private' as const },
    ]) {
      expect(resolveOntologyEvidence([edge], [original], [], now)).toEqual([]);
      expect(computeOntologyEvidenceGate({ id: 'c', domain: 'about_me' }, [edge], [original], [], now)
        .isReadyForConfirmation).toBe(false);
    }
  });
  it('requires a live verified original even for an explicit expression', () => {
    const explicit = { id: 'c', domain: 'about_me' as const };
    expect(computeOntologyEvidenceGate(explicit, [], [entry], [], now).isReadyForConfirmation).toBe(
      false,
    );
    const edges = [evidence('one', 'e')];
    expect(
      computeOntologyEvidenceGate(explicit, edges, [entry], [], now).isReadyForConfirmation,
    ).toBe(true);
    expect(
      computeOntologyEvidenceGate(explicit, edges, [{ ...entry, aiVisibility: 'private' }], [], now)
        .isReadyForConfirmation,
    ).toBe(false);
    expect(
      computeOntologyEvidenceGate(
        explicit,
        [{ ...edges[0], quoteVerifiedByServer: false }],
        [entry],
        [],
        now,
      ).isReadyForConfirmation,
    ).toBe(false);
  });
  it('does not count duplicate quotes, source-kind aliases or fabricated dates independently', () => {
    const gate = computeOntologyEvidenceGate(
      object,
      [
        evidence('one', 'e'),
        {
          ...evidence('two', 'e'),
          sourceKind: 'now_entry',
          sourceOccurredAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      [entry],
      [],
      now,
    );
    expect(gate).toMatchObject({
      independentExperienceCount: 1,
      distinctDateCount: 1,
      isReadyForConfirmation: false,
    });
  });
  it('requires live independent experiences across dates and loses eligibility on revocation', () => {
    const second = { ...entry, id: 'e2', createdAt: 86400001 };
    const edges = [evidence('one', 'e'), evidence('two', 'e2')];
    expect(computeOntologyEvidenceGate(object, edges, [entry, second], [], now)).toMatchObject({
      independentExperienceCount: 2,
      distinctDateCount: 2,
      isReadyForConfirmation: true,
    });
    expect(
      computeOntologyEvidenceGate(
        object,
        edges,
        [entry, { ...second, aiVisibility: 'private' }],
        [],
        now,
      ).isReadyForConfirmation,
    ).toBe(false);
    expect(
      computeOntologyEvidenceGate(
        object,
        edges,
        [entry, { ...second, createdAt: entry.createdAt }],
        [],
        now,
      ).isReadyForConfirmation,
    ).toBe(false);
  });
  it('requires three distinct user messages and independent sessions or dates', () => {
    const token = aiPrivacyToken([entry]);
    const first: AvatarSession = {
      ...session,
      messages: ['m1', 'm2', 'm3'].map((id) => ({
        ...session.messages[0],
        id,
        aiPrivacyToken: token,
      })),
    };
    const second: AvatarSession = {
      ...first,
      id: 'second',
      messages: [first.messages[2]],
    };
    const chatEdge = (id: string, sessionId: string, index: number, messageId: string) => ({
      ...evidence(id, messageId),
      sourceKind: 'chat_user_message' as const,
      sessionId,
      userMessageIndex: index,
      verbatimQuote: '我的想法',
    });
    const edges = first.messages.map((m, i) => chatEdge(`edge-${i}`, first.id, i, m.id));
    expect(computeOntologyEvidenceGate(object, edges, [entry], [first], now, token)).toMatchObject({
      distinctUserMessageCount: 3,
      distinctSessionCount: 1,
      isReadyForConfirmation: false,
    });
    // Copying an existing message to a second session cannot create independence.
    expect(
      computeOntologyEvidenceGate(
        object,
        [...edges, chatEdge('copy', second.id, 0, 'm3')],
        [entry],
        [first, second],
        now,
        token,
      ),
    ).toMatchObject({
      distinctUserMessageCount: 3,
      distinctSessionCount: 1,
      isReadyForConfirmation: false,
    });
    second.messages = [{ ...second.messages[0], id: 'm4' }];
    expect(
      computeOntologyEvidenceGate(
        object,
        [...edges.slice(0, 2), chatEdge('new', second.id, 0, 'm4')],
        [entry],
        [first, second],
        now,
        token,
      ),
    ).toMatchObject({
      distinctUserMessageCount: 3,
      distinctSessionCount: 2,
      isReadyForConfirmation: true,
    });
    first.messages[2] = { ...first.messages[2], created_at: '2026-01-02' };
    expect(computeOntologyEvidenceGate(object, edges, [entry], [first], now, token)).toMatchObject({
      distinctDateCount: 2,
      isReadyForConfirmation: true,
    });
  });
  it('does not accept another object’s evidence or future-dated originals', () => {
    expect(
      computeOntologyEvidenceGate(
        object,
        [{ ...evidence('one', 'e'), fromId: 'other' }],
        [entry],
        [],
        now,
      ).independentExperienceCount,
    ).toBe(0);
    expect(
      computeOntologyEvidenceGate(
        object,
        [evidence('one', 'e')],
        [{ ...entry, createdAt: now + 1 }],
        [],
        now,
      ).independentExperienceCount,
    ).toBe(0);
  });
});
