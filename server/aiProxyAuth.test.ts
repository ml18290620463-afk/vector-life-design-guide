import { describe, expect, it, vi } from 'vitest';
import { createAiProxyAuth } from './aiProxyAuth';
import type { Request, Response } from 'express';

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  statusCode: number | null;
  body: unknown;
}

const buildRes = (): MockRes => {
  const res: Partial<Response> & MockRes = {
    statusCode: null,
    body: null,
    status: vi.fn(function (this: MockRes, code: number) {
      this.statusCode = code;
      return this as unknown as Response;
    }),
    json: vi.fn(function (this: MockRes, payload: unknown) {
      this.body = payload;
      return this as unknown as Response;
    }),
  };
  res.status = res.status.bind(res);
  res.json = res.json.bind(res);
  return res as MockRes;
};

const buildReq = (headers: Record<string, string> = {}): Request => {
  const lookup: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lookup[key.toLowerCase()] = value;
  }
  return {
    get(name: string) {
      return lookup[name.toLowerCase()];
    },
  } as unknown as Request;
};

const allowed = new Set(['http://localhost:3000', 'https://app.example']);

describe('createAiProxyAuth', () => {
  it('passes browser requests from allowed origins without a token', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: '' });
    const next = vi.fn();
    const res = buildRes();
    middleware(buildReq({ Origin: 'http://localhost:3000' }), res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it('rejects browser requests from a foreign origin with 403', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: '' });
    const next = vi.fn();
    const res = buildRes();
    middleware(buildReq({ Origin: 'http://evil.example' }), res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('lets a foreign origin through when it carries the right bearer token', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: 'secret' });
    const next = vi.fn();
    const res = buildRes();
    middleware(
      buildReq({ Origin: 'http://evil.example', Authorization: 'Bearer secret' }),
      res as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it('rejects foreign origin with wrong token (still 403, not 401)', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: 'secret' });
    const next = vi.fn();
    const res = buildRes();
    middleware(
      buildReq({ Origin: 'http://evil.example', Authorization: 'Bearer wrong' }),
      res as unknown as Response,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('passes non-browser requests when no token is configured', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: '' });
    const next = vi.fn();
    const res = buildRes();
    middleware(buildReq(), res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('requires a valid token for non-browser requests when token is configured', () => {
    const middleware = createAiProxyAuth({ allowedOrigins: allowed, accessToken: 'secret' });
    const next = vi.fn();

    const resNoToken = buildRes();
    middleware(buildReq(), resNoToken as unknown as Response, next);
    expect(resNoToken.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();

    const resBadToken = buildRes();
    middleware(
      buildReq({ Authorization: 'Bearer wrong' }),
      resBadToken as unknown as Response,
      next,
    );
    expect(resBadToken.statusCode).toBe(401);

    const resGoodToken = buildRes();
    middleware(
      buildReq({ Authorization: 'Bearer secret' }),
      resGoodToken as unknown as Response,
      next,
    );
    expect(resGoodToken.statusCode).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });
});
