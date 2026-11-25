import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../types/now';
const mocks = vi.hoisted(() => ({ request: vi.fn(), privacy: vi.fn() }));
vi.mock('./avatarRequest', () => ({ avatarRequest: mocks.request }));
vi.mock('./avatarModel', () => ({ readAvatarModel: () => null }));
vi.mock('../../../services/aiPrivacy', () => ({
  readAIPrivacy: mocks.privacy,
  isAIMessageAllowed: (message: ChatMessage) => message.aiPrivacyToken !== 'revoked',
  canAIReadEntry: () => true,
}));
import { extractAvatarFacts } from './avatar';
const message = (index: number, role: ChatMessage['role'] = 'user'): ChatMessage => ({
  id: `message-${index}`,
  role,
  type: 'text',
  content: `原话${index}：我偏好安静`,
  created_at: '2026-11-24T00:00:00.000Z',
});
const respond = (sourceIndexes: number[], evidences: string[]) => {
  mocks.request.mockResolvedValue({
    response: { ok: true },
    result: {
      candidates: [{ statement: '我偏好安静', kind: 'preference', sourceIndexes, evidences }],
    },
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.privacy.mockResolvedValue({ entries: [], token: 'request-token' });
});
describe('extraction evidence transport', () => {
  it('keeps original indices across privacy filtering and the 120-message window', async () => {
    const messages = Array.from({ length: 125 }, (_, i) => message(i));
    messages[122].aiPrivacyToken = 'revoked';
    respond([0, 119], ['原话4', '原话124']);
    const [candidate] = await extractAvatarFacts(messages, []);
    expect(candidate.evidenceAnchors.map((anchor) => anchor.userMessageIndex)).toEqual([4, 124]);
    expect(candidate.evidenceAnchors.map((anchor) => anchor.verbatimQuote)).toEqual([
      '原话4',
      '原话124',
    ]);
    expect(candidate.aiPrivacyToken).toBe('request-token');
    expect(JSON.parse(mocks.request.mock.calls[0][2].body).messages).toHaveLength(120);
  });
  it('captures source content before the asynchronous request completes', async () => {
    const messages = [message(0)];
    mocks.request.mockImplementation(async () => {
      messages[0].content = 'later edit';
      return {
        response: { ok: true },
        result: {
          candidates: [
            {
              statement: '我偏好安静',
              kind: 'preference',
              sourceIndexes: [0],
              evidences: ['原话0'],
            },
          ],
        },
      };
    });
    const [candidate] = await extractAvatarFacts(messages, []);
    expect(candidate.sources[0].content).toBe('原话0：我偏好安静');
  });
  it.each([
    { indexes: [1], quotes: ['原话1'] },
    { indexes: [0], quotes: ['编造的引文'] },
    { indexes: [], quotes: [] },
    { indexes: [0, 0], quotes: ['原话0', '原话0'] },
    { indexes: [0.5], quotes: ['原话0'] },
    { indexes: [99], quotes: ['原话0'] },
    { indexes: [0], quotes: [] },
  ])('rejects invalid evidence %#', async ({ indexes, quotes }) => {
    respond(indexes, quotes);
    await expect(extractAvatarFacts([message(0), message(1, 'assistant')], [])).rejects.toThrow(
      'invalid_memory_source',
    );
  });
  it('rejects evidence longer than the 700-character boundary', async () => {
    const original = { ...message(0), content: '长'.repeat(701) };
    respond([0], [original.content]);
    await expect(extractAvatarFacts([original], [])).rejects.toThrow('invalid_memory_source');
  });
});
