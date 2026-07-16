import { beforeEach, describe, expect, it } from 'vitest';
import {
  readAvatarSession,
  readAvatarUnderstandings,
  sanitizeAvatarSessions,
  writeAvatarSession,
  writeAvatarUnderstanding,
} from './avatarMemory';

describe('avatarMemory', () => {
  beforeEach(() => localStorage.clear());

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

  it('supersedes the previous confirmed understanding', () => {
    writeAvatarUnderstanding({
      id: 'v1', statement: '旧理解', status: 'confirmed', sourceEntryIds: [], createdAt: 1,
    });
    writeAvatarUnderstanding({
      id: 'v2', statement: '新理解', status: 'confirmed', sourceEntryIds: [], createdAt: 2,
      previousVersionId: 'v1',
    });
    expect(readAvatarUnderstandings().map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'v2', status: 'confirmed' },
      { id: 'v1', status: 'superseded' },
    ]);
  });
});
