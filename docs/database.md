# Database

Postgres with Drizzle, in `packages/db` (`@ai-scratch/db`, TypeScript source, no build). Used by the office now,
by the kids' app later. Setup: [deployment.md](deployment.md#office-and-database).

## Schema and migrations

- **One schema** in `packages/db/src/schema`. `auth.ts` is **generated** by better-auth's CLI
  (`npm run auth:schema -w apps/office`, after a plugin or auth option change); don't edit it by hand.
- **Migrations are generated, never written:** change the schema, then `npm run generate -w packages/db -- --name <what>`.
  Commit `drizzle/` with the change. Biome skips `drizzle/`.
- **The office migrates on start** (`instrumentation.ts`, before it takes requests), behind a Postgres advisory
  lock, so several instances, a deploy and the e2e setup can start at once.
- **A deploy migrates production while the old container still serves** (App Service starts the new container
  before it switches over). A migration must therefore work with the old code for that minute: add columns and
  tables first, drop them a release later. There is no staging database: CI's e2e tests run the migrations on
  an empty Postgres first.
- The migrations sit at `packages/db/drizzle` relative to the office in the repo and in the image (Next.js's
  `outputFileTracingIncludes` copies them into the standalone output).
- better-auth checks the schema against its plugins at start and logs "Drizzle schema mismatch" when they differ.

## Connection

- `DATABASE_URL` (local Docker, CI) or `PGHOST`/`PGDATABASE`/`PGUSER` with an **Entra token as password** (Azure:
  the web app's managed identity; on your machine: your `az login`). No database password exists on Azure
  (`--password-auth Disabled`).
- **Roles:** the office's managed identity has the role `ai-scratch-office`, which owns the database `aiscratch`,
  so the tables its migrations create are its own. The Entra admin (Rainer's `az login`) is a member of the role.
  Created by `apps/office/scripts/azure/provision.sh` with `pgaadauth_create_principal_with_oid`, so the role
  name doesn't depend on the identity's display name.
- **Azure trap:** schema `public` of a new database belongs to `azure_pg_admin`, not to the database's owner, so
  owning the database isn't enough ("permission denied for schema public" at the first migration).
  provision.sh hands the schema to the office's role.
- `npm run sql -w packages/db < file.sql` runs SQL against the database in the environment (the provisioning
  script uses it instead of psql).
- **Reaching Azure from your machine:** the firewall allows Azure services and the IP `provision.sh` last ran
  from (rule `admin-workstation`). Re-run it after your IP changes.

## Code

- **Code takes `Database`** (`PgDatabase` over the schema), not a driver's type: the apps use node-postgres,
  unit tests PGlite.
- **Unit tests run on PGlite** (`@ai-scratch/db/testing`: in-memory Postgres in WebAssembly, real migrations, no
  Docker). e2e tests use the real server: `docker compose up -d db` locally, a service container in CI.
- `@azure/identity` stays out of the office's bundle (`serverExternalPackages`): MSAL requires modules
  dynamically.
