# The kids' app (apps/app)

The Scratch 3 editor with the German AI assistant, at ai-scratch.dev. The assistant reads and changes the kid's project, points at parts of the editor, adds library sprites and backdrops, and draws new sprites as SVG. Kids are coding beginners who know a little Scratch; adults supervise them.

Code paths in this file and in the root `docs/` (`src/…`, `e2e/`, `eval/`, `scripts/`, `slides/`) are relative to this folder. The topic notes in `docs/` are mostly about this app: start with `docs/architecture.md`.

## Commands

Run them here (or from the root with `-w apps/app`). The `.env` is `apps/app/.env` (template: `.env.example`).

| Command | What it does |
|---|---|
| `npm run dev` | Vite on :5173 (hot reload) + the API server on :3000 |
| `npm run typecheck` | TypeScript (`tsc -b`) |
| `npm test` | unit and component tests (Vitest, headless scratch-vm, no network) |
| `npm run build` | type check, Vite build, copy + precompress the Scratch bundle into `dist/` |
| `npm run e2e` | Playwright against the production build, model mocked |
| `npm run test:live` | the OpenRouter path with a real key; costs cents, local only |
| `npm run eval:guard` | the labelled kid messages against the real Jev guard; rewrites `docs/kids-protection.md` (never edit it by hand) |
| `npm run eval:games` | the game harness with the real model; costs money, local only (`game-test` skill) |
| `npm run build --prefix slides` | the slide deck (own packages: `npm ci --prefix slides`), before `npm run build` |

## Architecture

- **Editor:** the `@scratch/scratch-gui` standalone build, **unmodified**, in a same-origin iframe, driven through the VM API. Leave Scratch unmodified wherever possible.
- **Host:** Vite + React 19, Tailwind 4 + shadcn/ui.
- **Backend:** Hono + Vercel AI SDK v7. Tools run in the browser on the live VM. The server rebuilds the model input every turn and stores no conversations (only a local log with `LOG_DIR`).
- **Model:** Claude Haiku 5.5 (effort high) through the Anthropic API directly; requests need the `anthropic-workspace-id` header. With a parent's own key, the same model through OpenRouter (`src/server/model.ts`).
- **Scripts:** the model reads and writes the nested-JSON DSL, never raw sb3.
- **Prior work:** the tested prototype in `/home/rainer/github/ki-scratch`; its `docs/report.md` holds the measurements behind these choices (its README is outdated).

## Conventions

- **Where code runs decides where it lives:** `src/shared` (browser and Node), `src/editor` (inside the Scratch iframe, also the "frage KI" block), `src/client` (the React host), `src/server` (Hono), `slides/` (the Slidev deck, own packages, served at `/slides/`).
- **Relative imports end in `.ts`/`.tsx`.** Node runs the server's TypeScript directly (type stripping, no build step), so only erasable syntax: no enums, namespaces or parameter properties.
- **Packages are found through Node's resolver** (`createRequire(…).resolve`), never through a `node_modules/…` path: npm hoists them to the workspace root.
- **Browser-only packages are devDependencies** (Vite bundles them); a new server import must be a dependency, or the container fails at start.
- **Tools come in families** (project, ui, asset): definitions and prompt text in `src/shared/tools`, executors (`ToolHandlers`) run in the browser on the live VM, strictly one at a time (`src/client/scratch/tool-runner.ts`). Tool error messages are read by the model, so they say in English what to fix.
- **The scratch-vm API is typed by hand** in `src/shared/scratch/vm-types.ts`; add members there when you use more of it.
- **`.npmrc` sets `legacy-peer-deps`:** `@scratch/scratch-gui` declares React 18 peers, but we only use its standalone bundle, which ships its own React.
- **Tests:** unit tests next to the code use the headless VM (`test/support/headless-vm.ts`); server tests fake Anthropic's SSE (`test/support/anthropic-sse.ts`); e2e mocks `/api/chat` with streams built by the AI SDK (`e2e/helpers/mock-chat.ts`), and any page error fails a test. The assistant itself is tested with the `game-test` skill (real model), not with Claude in Chrome (`docs/testing.md`).
- **Verify against the real app before claiming a UI fix works.** Example: the GUI drops sprite-thumbnail updates sent within ~500 ms of each other; only the browser showed that.

## Requirements and decisions

- **Scope:** German UI, desktop only, no image uploads. Projects are saved and loaded through Scratch's *Datei* menu: its own .sb3 entries plus ours for the **CoderDojo Locker** (`docs/locker.md`). The Locker belongs to a friend of Rainer's: don't change it.
- **Access:** without a valid access code the chat is locked (Scratch works); the code comes from the chat panel or `?code=`, the browser remembers it, codes are not case-sensitive. **Or a parent's own OpenRouter key** with a spending limit; it is never stored or logged on the server (`docs/limits-and-safety.md`). Teacher codes from the office replace the per-school codes (`docs/platform-plan.md`).
- **Sessions:** a random id per page load (`X-Session-Id`, no cookie, intentionally not secure); warn before closing the tab; no session resume. **"Rückgängig"** under each answer that changed the project restores it as it was before the kid's message; the copies live in browser memory only.
- **Logging:** the event's AI calls are kept in Azure Blob for research (never delete them). **Since 2026-10-27 no conversations are stored**; token stats stay in memory (`/api/stats`).
- **KI-Energie** (`src/shared/energy.ts`): **3 hearts**, one refills every 20 s (`admin_` codes are exempt), and the **Gedächtnis** gauge against an **80k** context limit, freed by hand ("Zusammenfassen" or "Neu anfangen"). The server enforces what the client shows.
- **Teaching mode:** the kid designs the game; the assistant leads with questions and builds only small, clearly defined parts (usually one script), never a whole game. Answers are short. A stricter "AI supports" mode may come later; keep the prompt and tool selection open for it.
- **Kids protection** (`src/server/guard.ts`): Jev (TypeSafe) screens every new kid message; flagged ones get a fixed German answer and never reach Claude. Lean on purpose, because adults supervise: no screening of replies, and if Jev fails the message goes through. **Output limits** in `src/server/output-guard.ts`. After changing questions or thresholds, run `npm run eval:guard`.
- **Owned by Rainer, don't design:** the video tutorial.
