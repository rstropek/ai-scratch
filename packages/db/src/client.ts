import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { poolConfig } from './connection.ts';
import * as schema from './schema/index.ts';

export type Schema = typeof schema;
/** node-postgres in the apps, PGlite in tests: code takes this type, not a driver's */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export const createPool = (env: Record<string, string | undefined> = process.env) =>
  new pg.Pool({ ...poolConfig(env), max: 10 });

export const createDb = (pool: pg.Pool): Database => drizzle(pool, { schema });
