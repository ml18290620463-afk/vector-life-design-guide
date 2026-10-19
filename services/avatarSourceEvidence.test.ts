import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../types';
import type { AvatarSession, AvatarMemorySourceRef } from '../features/avatar/types';
import { resolveAvatarSourceEvidence } from './avatarSourceEvidence';

const entry: DiaryEntry = {
  id: 'e',
  title: '',
  content: '我的经历',
  tags: [],
  createdAt: 1,
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
    { id: 'm', role: 'user', type: 'text', content: '我的想法', created_at: '2026-01-01' },
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
