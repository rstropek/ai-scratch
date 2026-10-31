// npm run migrate -w packages/db: applies the migrations to the database in the environment (connection.ts)
import { createPool } from './client.ts';
import { migrateDb } from './migrate.ts';
import { MIGRATIONS_FOLDER } from './migrations-folder.ts';

const pool = createPool();
try {
  await migrateDb(pool, MIGRATIONS_FOLDER);
  console.log('Migrations applied');
} finally {
  await pool.end();
}
