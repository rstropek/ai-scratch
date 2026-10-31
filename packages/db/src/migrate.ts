import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type pg from 'pg';

/** any fixed number: the advisory lock that serialises migrations */
const MIGRATION_LOCK = 47_112_026;

/**
 * Applies drizzle-kit's migrations from `migrationsFolder`. Several instances (scale-out, a slot swap, the e2e
 * setup next to the server) may start at once: an advisory lock lets one migrate while the others wait.
 */
export const migrateDb = async (pool: pg.Pool, migrationsFolder: string): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
};
