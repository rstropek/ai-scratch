// Access code check: one code per school, sent by the client on every /api call.
import type { MiddlewareHandler } from 'hono';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';

export const requireAccessCode =
  (codes: ReadonlySet<string>): MiddlewareHandler =>
  async (c, next) => {
    if (!codes.has(c.req.header(ACCESS_CODE_HEADER) ?? '')) return c.json({ error: 'Falscher Zugangscode' }, 401);
    await next();
  };
