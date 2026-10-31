import { describe, expect, it } from 'vitest';
import { poolConfig } from './connection.ts';

describe('poolConfig', () => {
  it('uses DATABASE_URL when it is set', () => {
    const url = 'postgres://office:pw@localhost:5432/office';
    expect(poolConfig({ DATABASE_URL: url, PGHOST: 'ignored' })).toEqual({ connectionString: url });
  });

  it('logs in to Azure with an Entra token instead of a password', async () => {
    const config = poolConfig({ PGHOST: 'db.postgres.database.azure.com', PGDATABASE: 'office', PGUSER: 'app' });
    expect(config).toMatchObject({
      host: 'db.postgres.database.azure.com',
      database: 'office',
      user: 'app',
      ssl: true,
    });
    expect(typeof config.password).toBe('function');
  });

  it('refuses an incomplete Azure configuration', () => {
    expect(() => poolConfig({ PGHOST: 'db.postgres.database.azure.com' })).toThrow(/DATABASE_URL, or PGHOST/);
  });
});
