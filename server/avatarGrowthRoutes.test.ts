import express from 'express';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAvatarGrowthRoutes } from './avatarGrowthRoutes';
import { callCustomModel } from './avatarCustomModel';

vi.mock('./avatarCustomModel', async (original) => ({
  ...(await original<typeof import('./avatarCustomModel')>()),
  callCustomModel: vi.fn(),
}));

const modelConfig = {
  baseUrl: 'https://models.example.com/v1',
  apiKey: 'user-secret-key',
  model: 'user-selected-model',
};
const invokeRoute = async (body: unknown) => {
  const server = express();
  registerAvatarGrowthRoutes(server);
  const route = server.router.stack.find((layer) => layer.route?.path === '/api/v1/avatar/growth-preview')?.route?.stack[0]?.handle;
  if (!route) throw new Error('growth preview route not registered');
  const headers = new Map<string, (...args: unknown[]) => void>();
  const response = {
    writableEnded: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; this.writableEnded = true; return this; },
    on(event: string, callback: (...args: unknown[]) => void) { headers.set(event, callback); return this; },
    off(event: string) { headers.delete(event); return this; },
  };
  await route({ body } as Request, response as unknown as Response);
  return response;
};
const payload = {
  modelConfig,
  source: 'past',
  sourceEntryId: 'entry-current',
  occurredAt: 10,
  messages: [{ role: 'user', content: '我遇到压力时会先独自梳理。', createdAt: 10 }],
  evidenceSources: [{ entryId: 'entry-current', content: '我遇到压力时会先独自梳理。', createdAt: 10 }],
  entries: [{ id: 'secret-entry', title: 'archive-secret', content: '这条不应送给模型', createdAt: 1, tags: [] }],
  understandings: [],
};
beforeEach(() => vi.clearAllMocks());

describe('avatar growth preview', () => {
  it('uses the selected model and returns only candidates grounded in original evidence', async () => {
    vi.mocked(callCustomModel).mockResolvedValue(JSON.stringify({ candidates: [{
      statement: '用户遇到压力时可能先独自梳理',
      kind: 'pattern_candidate',
      patternKey: '压力下先独自梳理',
      sourceIndexes: [0],
      evidences: ['我遇到压力时会先独自梳理。'],
    }] }));
    const response = await invokeRoute(payload);
    expect(response.statusCode).toBe(502); // A single record cannot substantiate a pattern.
    expect((response.body as { error: string }).error).toBe('model_unavailable');
    expect(JSON.stringify(vi.mocked(callCustomModel).mock.calls[0][1])).not.toContain('archive-secret');
    expect(callCustomModel).toHaveBeenCalledWith(
      { ...modelConfig, endpoint: 'chat' },
      expect.any(Array),
      expect.any(AbortSignal),
    );
    const modelMessages = vi.mocked(callCustomModel).mock.calls[0][1];
    expect(modelMessages[1].content).toContain('我遇到压力时会先独自梳理。');
    expect(modelMessages[1].content).not.toContain('archive-secret');
    expect(JSON.stringify(response.body)).not.toContain('user-secret-key');
  });

  it('rejects model evidence that does not occur in the referenced original record', async () => {
    vi.mocked(callCustomModel).mockResolvedValue(JSON.stringify({ candidates: [{
      statement: '用户偏好独自梳理',
      kind: 'preference',
      sourceIndexes: [0],
      evidences: ['我从未说过的内容'],
    }] }));
    const response = await invokeRoute(payload);
    expect(response.statusCode).toBe(502);
    expect((response.body as { error: string }).error).toBe('model_unavailable');
  });

  it('requires a user-selected model configuration', async () => {
    const response = await invokeRoute({ ...payload, modelConfig: undefined });
    expect(response.statusCode).toBe(400);
    expect((response.body as { error: string }).error).toBe('invalid_model_config');
    expect(callCustomModel).not.toHaveBeenCalled();
  });
});
