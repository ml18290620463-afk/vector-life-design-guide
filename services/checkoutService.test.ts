import { describe, expect, it, vi } from 'vitest';
import { startCheckout, claimToken } from './checkoutService';

const okResponse = (body: object): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const errResponse = (status: number, body: object): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('services/checkoutService', () => {
  describe('startCheckout', () => {
    it('happy path returns the url + sessionId', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          okResponse({ url: 'https://checkout.stripe.com/x', sessionId: 'cs_AAA' }),
        );
      const res = await startCheckout({
        tier: 'stardust',
        period: 'monthly',
        installId: 'install-A',
        fetchImpl,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.url).toBe('https://checkout.stripe.com/x');
        expect(res.sessionId).toBe('cs_AAA');
      }
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/checkout/create-session',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('400 → invalid-input', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(errResponse(400, { error: 'bad tier' }));
      const res = await startCheckout({
        tier: 'stardust',
        period: 'monthly',
        installId: 'A',
        fetchImpl,
      });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('invalid-input');
      expect(res.detail).toBe('bad tier');
    });

    it('503 → sku-not-configured', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(errResponse(503, { error: 'no price' }));
      const res = await startCheckout({
        tier: 'owner',
        period: 'lifetime',
        installId: 'A',
        fetchImpl,
      });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('sku-not-configured');
    });

    it('502 → stripe-rejected', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(errResponse(502, {}));
      const res = await startCheckout({
        tier: 'stardust',
        period: 'monthly',
        installId: 'A',
        fetchImpl,
      });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('stripe-rejected');
    });

    it('network error → unreachable', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const res = await startCheckout({
        tier: 'stardust',
        period: 'monthly',
        installId: 'A',
        fetchImpl,
      });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('unreachable');
    });

    it('malformed body → unknown', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
        );
      const res = await startCheckout({
        tier: 'stardust',
        period: 'monthly',
        installId: 'A',
        fetchImpl,
      });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('unknown');
    });
  });

  describe('claimToken', () => {
    it('200 → token returned', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 'vector-license-v1.A.B' }));
      const res = await claimToken({ sessionId: 'cs_AAA', fetchImpl });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.token).toBe('vector-license-v1.A.B');
    });

    it('404 → not-ready', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(errResponse(404, {}));
      const res = await claimToken({ sessionId: 'cs_X', fetchImpl });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('not-ready');
    });

    it('400 → invalid-input', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(errResponse(400, {}));
      const res = await claimToken({ sessionId: 'cs_X', fetchImpl });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('invalid-input');
    });

    it('network error → unreachable', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const res = await claimToken({ sessionId: 'cs_X', fetchImpl });
      if (res.ok !== false) throw new Error('expected fail');
      expect(res.reason).toBe('unreachable');
    });
  });
});
