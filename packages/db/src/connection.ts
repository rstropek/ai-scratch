// The Postgres connection: a password URL locally and in CI, Entra tokens (no password) on Azure.
import { DefaultAzureCredential } from '@azure/identity';
import type { PoolConfig } from 'pg';

/** the scope of Azure Database for PostgreSQL's Entra tokens */
const ENTRA_SCOPE = 'https://ossrdbms-aad.database.windows.net/.default';

/**
 * `DATABASE_URL` wins (local Docker, CI). Otherwise `PGHOST`, `PGDATABASE` and `PGUSER` name an Azure server and
 * its Entra role: the app's managed identity on Azure, your `az login` on your machine.
 */
export const poolConfig = (env: Record<string, string | undefined> = process.env): PoolConfig => {
  const url = env.DATABASE_URL?.trim();
  if (url) return { connectionString: url };
  const host = env.PGHOST?.trim();
  const database = env.PGDATABASE?.trim();
  const user = env.PGUSER?.trim();
  if (!host || !database || !user)
    throw new Error('Set DATABASE_URL, or PGHOST, PGDATABASE and PGUSER for an Entra login to Azure');
  const credential = new DefaultAzureCredential();
  return {
    host,
    database,
    user,
    port: 5432,
    ssl: true,
    // pg asks for a password per new connection; tokens last about an hour and the credential caches them
    password: async () => (await credential.getToken(ENTRA_SCOPE)).token,
  };
};
