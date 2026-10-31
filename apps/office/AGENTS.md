# The teachers' office (apps/office)

Next.js (App Router) at office.ai-scratch.dev: registration and teacher applications, the area for teachers and parents (access codes, own OpenRouter keys) and Rainer's admin. **So far (iteration 2):** login, registration of parents and teachers with an email link, teachers' applications for the free budget screened by Jev, the admin's account list with accept/reject and a manual free-budget switch, password reset (`docs/registration.md`). What comes next, and what is decided, proposed or open: `docs/platform-plan.md`. Database and migrations: `docs/database.md`.

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
- **No open sign-up** (`disableSignUp`). Accounts come from the confirmation page (`lib/registration.ts`) and `npm run seed:admin`; `auth.api.createUser` works without a session only server-side.
- **URLs are English** (`/login`, `/register`, `/apply`, `/admin`), page texts German (Rainer).
- **Mail, Turnstile and Jev are created on first use** (`lib/services.ts`, settings in `lib/env.ts` `loadServicesEnv`), like the auth instance; server actions get them through `lib/deps.ts`. `lib/registration.ts` and `lib/applications.ts` take their dependencies as arguments, so unit tests run them on PGlite with fakes.
- **Server actions return `FormState`** (`lib/form-state.ts`): field errors, a banner, and the answers, because React resets a form after its action. Limits the forms and the server share live in `lib/rules.ts` (no imports: client components load it).
- **User-facing texts live in `lib/texts.ts`** (German, `Sie` for teachers). Long texts (legal pages) live in `content/`, one file each, rendered inside `Prose`; read `docs/legal-texts.md` before changing one.
- **Public info pages** (legal texts, no login) sit in the route group `app/(info)/` with their own layout; they stay static (no `headers()`, no session).
- **The look follows `docs/office-design.html`** (Rainer approved it): Scratch 3's palette like the kids' app, at adult density.
- **No duplicated styling (Rainer's rule).** Colours, type sizes, radii, the font and the focus halo exist only as tokens in `app/globals.css`; Tailwind's own palette and type scale are switched off there, so use the tokens (`bg-primary`, `text-muted`, `text-sm`, `rounded-field`, `focus-visible:focus-ring`) and never raw values. The first time a UI element is needed, it becomes a component in `components/ui/` (layout pieces like the shell in `components/`), and every later use goes through it, so all appearances look and behave the same. Extend a component with a prop rather than restyling it at the call site; `className` is for placement (margins, width, grid), not looks.
- **Shared with the kids' app only what must be identical.** The two apps keep their own CSS and components, even where values match today.
- `next-env.d.ts` and `.next/` are generated and git-ignored. `next dev` re-adds the block below when it's missing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
