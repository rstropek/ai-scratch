// Access code check: one code per school, sent by the client on every /api call.
import type { Context, MiddlewareHandler } from 'hono';
import { normalizeCode } from '../shared/access.ts';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';

/** The request's access code, normalized like the configured ones. */
export const accessCodeOf = (c: Context): string => normalizeCode(c.req.header(ACCESS_CODE_HEADER) ?? '');

/** `codes` are normalized (config.ts). */
export const requireAccessCode =
  (codes: ReadonlySet<string>): MiddlewareHandler =>
  async (c, next) => {
    if (!codes.has(accessCodeOf(c))) return c.json({ error: 'Falscher Zugangscode' }, 401);
    await next();
  };
