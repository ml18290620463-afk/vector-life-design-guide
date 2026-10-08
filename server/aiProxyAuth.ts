import type { Request, Response, NextFunction } from 'express';

export interface AiProxyAuthOptions {
  /** Browser Origins that may call the proxy without a token (same-origin). */
  allowedOrigins: ReadonlySet<string>;
  /** Optional shared bearer token for non-browser / cross-origin clients. */
  accessToken: string;
}

const hasValidAccessToken = (req: Request, accessToken: string): boolean => {
  if (!accessToken) return false;
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return Boolean(match && match[1] === accessToken);
};

/**
 * Combined origin + token gate for the AI proxy endpoints.
 *
 *  - Browser request from an allowed Origin: pass (token optional).
 *  - Browser request from a foreign Origin: pass only with a valid bearer
 *    token; otherwise 403.
 *  - Non-browser request (no Origin header, e.g. curl, scripts):
 *      * if no access token configured: pass.
 *      * otherwise must carry a valid bearer token; otherwise 401.
 *
 * This way same-origin browser fetches keep working with no client config,
 * while shared-network / public deployments can lock everything down with a
 * single token.
 */
export const createAiProxyAuth = (options: AiProxyAuthOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('origin');
    const tokenOk = hasValidAccessToken(req, options.accessToken);

    if (!origin) {
      if (!options.accessToken || tokenOk) {
        next();
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (options.allowedOrigins.has(origin) || tokenOk) {
      next();
      return;
    }

    res.status(403).json({ error: 'Origin not allowed' });
  };
};
