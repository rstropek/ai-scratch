import path from 'node:path';
import { createPool, migrateDb } from '@ai-scratch/db';

/**
 * Brings the database up to date before the server takes requests (instrumentation.ts). The migrations sit at the
 * same place relative to the office in the repo and in the image (Next.js's standalone server runs in apps/office).
 */
export const migrateOnStart = async (): Promise<void> => {
  const pool = createPool();
  try {
    await migrateDb(pool, path.join(process.cwd(), '../../packages/db/drizzle'));
  } finally {
    await pool.end();
  }
};
