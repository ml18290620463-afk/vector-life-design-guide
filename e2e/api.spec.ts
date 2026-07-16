import { expect, test } from '@playwright/test';

test('rejects invalid record payloads', async ({ request }) => {
  const response = await request.post('/api/v1/records', {
    data: { text: '', mood_tags: [], event_tags: [] },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBeTruthy();
});

test('accepts a valid Now record payload', async ({ request }) => {
  const response = await request.post('/api/v1/records', {
    data: {
      text: '完成 Sprint 1 稳定基线',
      mood_tags: ['平静'],
      event_tags: ['职业发展'],
      source: 'manual',
      created_at: new Date().toISOString(),
      display_time: '现在',
      materials: [],
    },
  });
  expect(response.status()).toBe(201);
  expect(await response.json()).toMatchObject({ sync_status: 'synced' });
});

test('Avatar asks a follow-up when there is not enough recordable information', async ({
  request,
}) => {
  const response = await request.post('/api/v1/avatar/summarize', {
    data: { messages: [{ role: 'user', content: '今天还好' }], followup_round: 0 },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ is_sparse: true, can_summarize: false });
});
