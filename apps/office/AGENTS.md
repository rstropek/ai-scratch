# The teachers' office (apps/office)

Next.js (App Router) at office.ai-scratch.dev: teacher applications, the teacher area (access codes, own OpenRouter keys) and Rainer's admin. **Iteration 1 so far:** email + password login (better-auth, admin plugin), one protected page. What comes next, and what is decided, proposed or open: `docs/platform-plan.md`. Database and migrations: `docs/database.md`.

## Commands

Run them here (or from the root with `-w apps/office`). The `.env` is `apps/office/.env` (template: `.env.example`); the local Postgres runs with `docker compose up -d db` at the root.

| Command | What it does |
|---|---|
| `npm run dev` | dev server on http://localhost:3100 (migrates the database on start) |
| `npm run typecheck` | `next typegen` (route types), then `tsc --noEmit` |
| `npm test` | unit tests (Node, better-auth on PGlite) and component tests (jsdom) |
| `npm run build` | standalone production build, static files copied in |
| `npm start` | the standalone build on :3100, like in the image |
| `npm run e2e` | Playwright against the standalone build and the local Postgres (database `aiscratch_e2e`) |
| `npm run seed:admin` | creates Rainer's admin account or resets its password (asks for it) |
| `npm run auth:schema` | regenerates better-auth's tables in `packages/db/src/schema/auth.ts` after a plugin change; then `npm run lint:fix` and `npm run generate -w packages/db` |
| `scripts/azure/provision.sh`, `scripts/azure/domain.sh` | Azure resources and the domain (`docs/deployment.md`) |

## Decisions

- **The kids' app never calls the office at runtime.** Both share data through the database, so a broken or redeploying office never interrupts a lesson.
- **The office's session cookie stays host-only** (no `Domain`): it must never reach ai-scratch.dev, where Scratch and kids' projects run. Both hosts are the same site, so keep better-auth's origin checks.
- **Sign-in and sign-out go through `/api/auth` from the browser** (`lib/auth-client.ts`), not through server actions: better-auth's rate limit only applies to HTTP requests, never to `auth.api` calls.
- **`lib/auth.ts` is a factory without Next.js imports**, so tests run it on PGlite and `scripts/` run it with plain Node. `lib/session.ts` holds the app's instance; it is created on first use, because `next build` imports routes without any environment. Call `headers()` before anything that needs the environment, or `next build` prerenders the page and fails.
- **Relative imports end in `.ts`/`.tsx`, no `@/` alias:** the seed script runs the same files with Node's type stripping.
- **No open sign-up** (`disableSignUp`). Accounts come from `npm run seed:admin` for now; `auth.api.createUser` works without a session only server-side.
- **User-facing texts live in `lib/texts.ts`** (German, `Sie` for teachers).
- `next-env.d.ts` and `.next/` are generated and git-ignored. `next dev` re-adds the block below when it's missing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
