// Runs the SQL from stdin against the database in the environment (connection.ts) and prints what it returns. For
// the Azure setup scripts (roles, grants), so they need neither psql nor Docker.
import { text } from 'node:stream/consumers';
import pg from 'pg';
import { poolConfig } from './connection.ts';

const client = new pg.Client(poolConfig());
await client.connect();
try {
  const results = [await client.query(await text(process.stdin))].flat();
  for (const { rows } of results) if (rows.length) console.table(rows);
} finally {
  await client.end();
}
