// In-memory Postgres (PGlite) with all migrations applied, for unit tests: no Docker, no network.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from './client.ts';
import { MIGRATIONS_FOLDER } from './migrations-folder.ts';
import * as schema from './schema/index.ts';

export const createTestDb = async (): Promise<{ db: Database; close: () => Promise<void> }> => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
};
