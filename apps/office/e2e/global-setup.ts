import { fileURLToPath } from 'node:url';
import { createDb, createPool, migrateDb } from '@ai-scratch/db';
import { ensureAdmin } from '../lib/admin-seed.ts';
import { createAuth, throwawaySecret } from '../lib/auth.ts';
import { E2E_ADMIN, E2E_DATABASE_URL } from './settings.ts';

// the admin account the tests sign in with; migrates first, because the server may still be starting
export default async function globalSetup() {
  const pool = createPool({ DATABASE_URL: E2E_DATABASE_URL });
  try {
    await migrateDb(pool, fileURLToPath(new URL('../../../packages/db/drizzle', import.meta.url)));
    const auth = createAuth({ db: createDb(pool), secret: throwawaySecret(), baseURL: 'http://localhost' });
    await ensureAdmin(auth, E2E_ADMIN);
  } finally {
    await pool.end();
  }
}
