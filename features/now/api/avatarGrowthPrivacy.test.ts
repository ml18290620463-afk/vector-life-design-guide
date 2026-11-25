import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), privacy: vi.fn() }));
vi.mock('./avatarRequest', () => ({ avatarRequest: mocks.request }));
vi.mock('./avatarModel', () => ({ readAvatarModel: () => ({ model: 'test' }) }));
vi.mock('../../../services/aiPrivacy', () => ({
  readAIPrivacy: mocks.privacy,
  canAIReadEntry: () => true,
  isAIMessageAllowed: () => true,
}));
import { previewAvatarGrowth } from './avatar';
const args = () => ({
  messages: [],
  source: 'past' as const,
  sourceEntryId: 'e1',
  occurredAt: 100,
  evidenceSources: [{ entryId: 'e1', content: '用户原话', createdAt: 100 }],
  entries: [],
  understandings: [{ id: 'eligible', statement: '伪造内容' }, { id: 'revoked' }, { id: 'outside' }],
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.privacy.mockResolvedValue({
    token: 'current-token',
    entries: [{ id: 'e1', content: '用户原话' }],
    cognitiveContext: [
      {
        object: { id: 'eligible', statement: '已核验认识', createdAt: '2026-11-24T00:00:00Z' },
        evidence: [{ toId: 'e1' }],
      },
      {
        object: { id: 'outside', statement: '其他来源的认识', createdAt: '2026-11-24T00:00:00Z' },
        evidence: [{ toId: 'e2' }],
      },
    ],
  });
  mocks.request.mockResolvedValue({
    response: { ok: true },
    result: { atomicMemoryCandidates: [] },
  });
});
it('uses authoritative v2 content and excludes revoked or out-of-request evidence', async () => {
  await previewAvatarGrowth(args());
  const [token, , request] = mocks.request.mock.calls[0];
  expect(token).toBe('current-token');
  expect(JSON.parse(request.body).understandings).toEqual([
    {
      id: 'eligible',
      statement: '已核验认识',
      status: 'confirmed',
      sourceEntryIds: ['e1'],
      createdAt: Date.parse('2026-11-24T00:00:00Z'),
      aiVisibility: 'allowed',
    },
  ]);
});
it('does not disclose unrequested cognition', async () => {
  await previewAvatarGrowth({ ...args(), understandings: [] });
  expect(JSON.parse(mocks.request.mock.calls[0][2].body).understandings).toEqual([]);
});
it('rejects altered source text before sending the request', async () => {
  const request = args();
  request.evidenceSources[0].content = '伪造原文';
  await expect(previewAvatarGrowth(request)).rejects.toThrow('记录未授权 AI 读取');
  expect(mocks.request).not.toHaveBeenCalled();
});
