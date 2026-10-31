// Only for `npm run auth:schema`: better-auth's CLI reads the plugins from here and writes the auth tables into
// packages/db. It never connects (a mock database).
import { schema } from '@ai-scratch/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createAuth, throwawaySecret } from '../lib/auth.ts';

export const auth = createAuth({
  db: drizzle.mock({ schema }),
  secret: throwawaySecret(),
  baseURL: 'http://localhost:3100',
});
