# AI-Scratch

The official, unmodified Scratch 3 editor with a German AI chat assistant beside it, for kids aged 10–14. It started as the app of **Digiferien**, a one-day workshop (about 200 kids at 10 schools, October 2026). Since then it has been an **ongoing offering for schools** at ai-scratch.dev: teachers apply for free, budget-limited access codes. **This is production software:** real kids use it. The plan and its open points: `docs/platform-plan.md`.

## Layout

An npm workspace. Each app has its own `AGENTS.md`; read it before working there.

- `apps/app`: the kids' app at ai-scratch.dev (Vite + React + Hono).
- `apps/office`: the teachers' office at office.ai-scratch.dev (Next.js).
- `packages/db`: the Postgres schema, migrations and connection (Drizzle), for both apps (`docs/database.md`).
- `docs/`: topic-specific technical notes, maintained by agents for agents. Index: `docs/README.md`. Read the matching note before changing an area; update it in the same change when a decision or trap changes. As brief as possible: gotchas, patterns, principles; never a prose version of the code.
- Shared at the root: `biome.json`, `tsconfig.base.json` (the strict compiler options every workspace extends), `.npmrc`, `compose.yaml` (the local Postgres).

## Commands

Run `npm install` at the root only (Node 24+). From the root:

| Command | What it does |
|---|---|
| `npm run check` | Biome over the whole repo, then each app's type check |
| `npm run lint:fix` | Biome with fixes |
| `npm test` | every workspace's unit and component tests |
| `npm run build` | builds both apps |
| `docker compose up -d db` | the local Postgres (databases `aiscratch`, `aiscratch_e2e`) |
| `npm run e2e -w apps/app`, `npm run e2e -w apps/office` | each app's Playwright tests (they build first; the office's need the local Postgres) |
| `npm run dev`, `npm run dev:office` | the kids' app (http://localhost:5173), the office (http://localhost:3100) |

Any workspace script runs from the root with `-w <folder>`. App-specific commands are in the app's `AGENTS.md`.

## Rules

- **TypeScript with strict type checking** everywhere (`tsconfig.base.json`).
- **Biome** for linting and formatting; no ESLint or Prettier.
- **Vite** builds the kids' app (Next.js builds the office itself). **Vitest** for unit and component tests, **Playwright** for e2e tests, in both apps.
- **No warnings, no errors.** At the end of every coding session, `npm run check`, the builds and all tests pass without warnings. Don't silence a warning to get there; fix the cause, or tell Rainer when only a third-party package can.
- **Deterministic tools over hand edits** for scaffolding, configuration and dependencies: `npm install <pkg>` (versions are saved exact), `npm pkg set`, `npm install-scripts approve|deny`, generators like `create-next-app`. Hand edits aren't forbidden, but the tool comes first.
- **Data access through Drizzle** (Postgres): its query builder, relational queries and `drizzle-kit` migrations. Hand-written SQL is allowed, but the exception.
- **Tests: unit > component > e2e.** All three layers are used, but prefer fast, reliable tests of small units over slow e2e tests.
- **CI runs every test it can.** Only tests that need local resources (real API keys, money) run locally only.
- **Language:** German only for now (kids, teachers, emails); English comes later, so keep user-facing texts in one place. Code, comments and model-facing tool messages are English.
- **Licence:** AGPL-3.0-only; the code is public.

## Working agreements

- Secrets live in each app's `.env` (git-ignored, server-side only). Never print or commit keys.
- Don't commit or push unless Rainer asks.
- Ask Rainer about product and design decisions; decide technical questions yourself.
- Everything runs on **Microsoft Azure** (subscription "Microsoft Azure Sponsorship"), set up with the `az` CLI. Details and traps: `docs/deployment.md`.
