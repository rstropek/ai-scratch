# AI-Scratch

The official Scratch 3 editor with a German AI helper ("KI-Helfer") beside it. Kids describe what they want,
and the helper asks questions, builds small parts of their game, points at things in the editor, adds sprites
and backdrops from the Scratch library, and draws new sprites.

It is for kids aged 10–14, coding beginners who know a little Scratch, with adults in the room. It started as the
app of **Digiferien**, a one-day AI workshop in October 2026 (about 200 kids at 10 Austrian schools, each working
through a video tutorial at their own pace). Since then it has been an **ongoing offering for schools** at
https://ai-scratch.dev: teachers and parents create the access codes in the office (https://office.ai-scratch.dev),
from a free budget or their own OpenRouter key.

## How it works

```
Browser                                         Server (Hono, Azure)            AI services
┌──────────────────┬───────────────────────┐    ┌─────────────────────┐        ┌────────────────────┐
│ Chat (React)     │ Scratch 3 editor      │───▶│ access code, limits │───────▶│ Claude Haiku 5.5   │
│ runs the AI's    │ (unmodified, iframe)  │◀───│ builds the AI input │        │ (Anthropic, or the │
│ tools ──────────▶│ live project          │    │ counts tokens, cost │        │ adult's OpenRouter │
└──────────────────┴───────────────────────┘    └──────────┬──────────┘        │ key)               │
                                                           │ codes, budgets,   │ Jev (TypeSafe):    │
                                                           ▼ usage             │ kids protection    │
Office (Next.js, office.ai-scratch.dev) ─────────────▶ Postgres                └────────────────────┘
adults: accounts, codes, keys
```

- **The AI works on the live project in the browser.** Its tools (read and add scripts, point at a block,
  add a sprite …) run right in the editor, so the kid watches the changes happen.
- **The kid is the game designer.** The helper leads with questions and builds only small, clearly defined
  parts, usually one script at a time. Answers are short.
- **Scripts in a format models get right.** The AI reads and writes a compact JSON form of real Scratch
  blocks, which the app compiles into blocks: 96% correct in our tests, against 80% for raw Scratch project
  data.
- **No conversations are stored** (since the event; the logs from the event day are kept for research).
- **Saving:** Scratch's *Datei* menu saves the project as an .sb3 file, or in the kid's **CoderDojo Locker**
  ("Im Locker speichern" / "Aus dem Locker laden" / "Locker in neuem Tab öffnen", with the code on their
  Locker sticker;
  [docs/locker.md](docs/locker.md)). Nothing else is stored for the kid, and
  the chat ends when the tab closes.

## What kids see

- **Left: the chat.** Its purple top bar continues Scratch's menu bar and holds the font size buttons, a
  toggle for the AI's tool calls (off by default; kids see "baut an deinem Projekt…") and a fold button. The
  chat width and input height can be dragged; the browser remembers these settings.
- **KI-Energie** under the top bar: **3 hearts** (one per message, one refills every 20 s) and the
  **Gedächtnis** gauge, which fills as the conversation grows. When it is full, the kid clicks
  "Zusammenfassen" or "Neu anfangen". Both teach that AI isn't free or unlimited.
- **"Rückgängig"** under every AI answer that changed the project puts the project back to how it was before
  that answer (Scratch's own undo can't undo AI changes).
- **Right: the Scratch 3 editor**, unmodified, plus one block category of ours: **KI** with
  `frage KI [ ]`, so kids can build their own chatbot (first one question at a time, then one that remembers
  by joining the conversation into a variable). Each question costs a heart, like a chat message, and is
  screened like one. Projects with this block open only in this app, not on scratch.mit.edu.
  Details: [docs/ki-block.md](docs/ki-block.md).
- Until an **access code** is entered (or comes with the link as `?code=`), only the chat is locked; Scratch and
  the Locker work. Teachers and parents create the codes in the office (office.ai-scratch.dev), from the free
  budget or their own OpenRouter key; each code has its own time window and budget
  ([docs/budgets.md](docs/budgets.md)).

## The slide deck

The slides Rainer records into the video tutorial live in [apps/app/slides/](apps/app/slides/README.md): a standalone
[Slidev](https://sli.dev) app in a sticker-album look, with its own packages, sharing only the Scratch
colours with the app. The app serves the built deck at **`/slides/`** without an access code
(https://ai-scratch.dev/slides/, presenter view at `/slides/presenter/`).

## Keeping kids safe and costs bounded

- **Adults supervise** every session; the technical layers are deliberately lean.
- **Kids protection:** every kid message (and every text of the "frage KI" block) is screened by TypeSafe's Jev before it reaches Claude. Flagged
  messages get a fixed German answer, for example a kid in distress is sent to an adult. What was tested:
  [docs/kids-protection.md](docs/kids-protection.md).
- **Limits:** hearts per kid, the Gedächtnis limit, a cap on answer length and on AI steps per message.
- **Access codes** from the office, each with its own time window and budget. The free budget is capped at 100 $ a
  month in total and 10 $ per account ([docs/budgets.md](docs/budgets.md)).

## Sample prompts

Handy for trying the assistant by hand; each one exercises a different tool family.

| Prompt | Exercises |
|---|---|
| Wo finde ich den Block "wiederhole fortlaufend"? Ich will ihn selbst einbauen! | pointing at the palette (ui tools) |
| Bau: 3 mal 50 Schritte gehen und 1 Sekunde warten. Zeig mir dann, wo im Skript gewartet wird. | building scripts, then pointing at a block |
| Füge eine Fledermaus hinzu, die mit den Flügeln schlägt. | library sprite + animation script |
| Ich mache ein Weltraumspiel. Gib mir einen passenden Hintergrund. | library backdrop |
| Zeichne mir einen grünen Drachen als neue Figur. | drawing an SVG sprite |
| Wo kann ich mein Projekt speichern? | explaining the editor (file menu) |

## Run it locally

Requires Node.js 24 or later. The repo is an npm workspace: `npm install` runs once at the root; the kids' app
lives in `apps/app`, the teachers' office (Next.js) in `apps/office`, the database package in `packages/db`.

```bash
npm install
cp apps/app/.env.example apps/app/.env   # then fill in ANTHROPIC_API_KEY and JEV_API_KEY
npm run dev                              # the kids' app: http://localhost:5173/?code=test
```

`TEST_CODES=test` works without the office. Codes from a local office also need its Postgres (below) and its
`KEY_ENCRYPTION_KEY` in `apps/app/.env`.

The office needs Docker for its local Postgres:

```bash
docker compose up -d db                        # Postgres 17 on localhost:5432
cp apps/office/.env.example apps/office/.env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run seed:admin -w apps/office              # your admin account; asks for a password
npm run dev:office                             # http://localhost:3100
```

The kids' app reads `apps/app/.env`:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` (or `PGHOST`, `PGDATABASE`, `PGUSER` on Azure) | the office's database: codes, the key pool, usage; empty: only `TEST_CODES` work |
| `KEY_ENCRYPTION_KEY` | opens the sealed pool keys and adults' OpenRouter keys; the office's value (required with a database) |
| `TEST_CODES` | dev and tests only, never on Azure: comma-separated codes without a database; codes starting with `admin_` have no heart limit |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` | the key that pays for `TEST_CODES` (required with them); the workspace header for identity-linked keys |
| `ANTHROPIC_BASE_URL` | default `https://api.anthropic.com`; tests point it at a fake |
| `ANTHROPIC_FEDERATION_AUDIENCE`, `ANTHROPIC_FEDERATION_CLIENT_ID` | our Azure identity for federated pool entries (`docs/anthropic-federation.md`) |
| `BUDGET_TOTAL_USD_MONTH`, `BUDGET_ACCOUNT_USD_MONTH`, `FREE_CODES_PER_ACCOUNT_MONTH`, `CODE_BUDGET_USD`, `CODE_MAX_HOURS` | the budgets (`docs/budgets.md`), the same as the office's; defaults 100, 10, 5, 5, 4 |
| `RESEND_API_KEY`, `MAIL_FROM` | the 80 % budget warnings to the admins; without a key they only go to the log; default sender `AI-Scratch <office@mail.ai-scratch.dev>` |
| `JEV_API_KEY` | TypeSafe key for the kids-protection guard (server only) |
| `MODEL` | default `claude-haiku-5-5` |
| `EFFORT` | the chat's thinking effort, default `high` |
| `INSTRUCTIONS_FILE` | replaces the built-in system prompt + tool instructions (for prompt variants in `eval:games`; not for production) |
| `JEV_MODEL` | default `jev-1.13.0` (the guard thresholds are tuned against it) |
| `PORT`, `DIST_DIR` | default `3000`, `dist` |
| `LOG_DIR` | stores every AI call and guard check there (game harness, e2e, debugging); unset by default and in production: nothing is stored |
| `LOCKER_URL` | the CoderDojo Locker for saving games, default `https://locker.coderdojo.net` |
| `OPENROUTER_URL`, `OPENROUTER_MODEL` | for codes on adults' own keys; default `https://openrouter.ai/api/v1`, `anthropic/claude-haiku-5.5` |
| `OPENROUTER_API_KEY` | only for `npm run test:live` (a key with a spending limit); the server never reads it |

### Commands

At the root: `npm run check` (Biome over the whole repo + each workspace's type check), `npm test` and
`npm run build` (all workspaces). The kids' app's commands run in `apps/app` (or from the root with
`-w apps/app`, for example `npm run e2e -w apps/app`):

| Command | What it does |
|---|---|
| `npm run dev` | Vite on http://localhost:5173 (hot reload) + API server on :3000 |
| `npm run build` | type check, Vite build, copy + precompress the Scratch bundle into `dist/` |
| `npm start` | production server: API + `dist/` on :3000 (the slide deck at `/slides/` once `npm run build --prefix slides` has run before `npm run build`) |
| `npm test` | unit and component tests (Vitest, headless scratch-vm, no network) |
| `npm run e2e` | Playwright against the production build, model mocked |
| `npm run test:live` | a code on an own OpenRouter key, with the real key in `.env` (`OPENROUTER_API_KEY`): two chat turns, "Zusammenfassen", "frage KI"; about 2 cents |
| `npm run eval:games` | a simulated kid builds a game (Memory, Fangspiel, Fang mich, Space Shooter, Minesweeper) with the real app and model, a bot plays and checks each version ([eval/games](apps/app/eval/games/README.md)); costs real money |
| `npm run eval:guard` | runs the labelled kid messages against the real Jev guard, writes [docs/kids-protection.md](docs/kids-protection.md) |
| `npm run typecheck` | TypeScript |

`npm run lint:fix` (root) applies Biome's fixes.

## Deployment (Azure)

Every push to `main` is tested and deployed straight to **production** for each app it changes; there are no staging slots.
A deploy restarts the app and interrupts kids mid-answer, so **don't push changes to the kids' app while kids are
using it**. The reasons behind the setup and the traps we hit:
[docs/deployment.md](docs/deployment.md).

| What | Where |
|---|---|
| Web app | `ai-scratch` in RG `2026-digitalferien`, on the existing P0v3 plan `ts-web-playground`: **https://ai-scratch.dev** (also `www.`, and the old https://ai-scratch.azurewebsites.net); `GET /healthz` shows the running commit, `/slides/` the slide deck, `/digiferien-2026-live` the event's video page |
| Domain | `ai-scratch.dev` and `office.ai-scratch.dev`, DNS at Cloudflare (`cf` CLI, `npm install --global cf`): CNAMEs to the web apps plus `asuid` TXT records, DNS only; free App Service managed certificates. Mail goes out through Resend from `mail.ai-scratch.dev` |
| Secrets | Key Vault `kv-digiferien`, read by the apps' managed identities |
| Research logs | storage account `stdigiferien`, container `logs`: one JSON blob per AI call and per guard check of the event, no longer written. No retention rule; Rainer deletes them by hand |
| App logs | Log Analytics workspace `log-ai-scratch`: both apps' console output (their errors) and App Service's platform events, 30 days ([docs/deployment.md](docs/deployment.md#logs)) |
| Image | `acrars2025.azurecr.io/ai-scratch:<commit>` |
| Office | `ai-scratch-office` on the same plan: **https://office.ai-scratch.dev**; image `acrars2025.azurecr.io/ai-scratch-office:<commit>` |
| Database | Postgres Flexible Server `ai-scratch-db` (northeurope, Burstable B1ms), database `aiscratch`, Entra login only ([docs/database.md](docs/database.md)) |
| Workflows | [deploy.yml](.github/workflows/deploy.yml) (every push and PR: all tests; push to `main` → production of each app it changes); GitHub logs in with OIDC |

Operations (`az login` with Owner on the subscription; the scripts are safe to re-run):

- **Changed `JEV_API_KEY` or `RESEND_API_KEY` in `apps/app/.env`:** run `apps/app/scripts/azure/provision.sh`, then
  restart the app (`az webapp restart -g 2026-digitalferien -n ai-scratch`). Codes and the key pool live in the
  office.
- **GitHub login** (once): `apps/app/scripts/azure/github-identity.sh`.
- **Office and database:** `apps/office/scripts/azure/provision.sh`, then `apps/office/scripts/azure/domain.sh`.
- **Read the app logs** (for a bug report): Logs in the portal on `log-ai-scratch`, or live with
  `az webapp log tail -g 2026-digitalferien -n ai-scratch-office` (or `-n ai-scratch`).
- **Download the research logs:** `az storage blob download-batch --auth-mode login --account-name stdigiferien -s logs -d <dir>`.

## Project layout

```
apps/app/                   the kids' app (ai-scratch.dev):
  index.html, editor.html     host page, editor iframe page
  live.html                   the event's video page (/digiferien-2026-live)
  src/shared/                 runs in the browser and in Node: script format, block catalog, tools, prompt
  src/editor/                 inside the iframe: mounts Scratch, UI pointer, "frage KI" block, Locker menu entries, exposes window.ki
  src/client/                 React host: chat panel, access gate, tool runner, Locker dialog, video page
  src/server/                 Hono: /api/chat, /api/compact, /api/ask, /api/locker, access codes and budgets, guards,
                              call log (opt-in), stats
  test/support/               headless scratch-vm, fake Anthropic streams, fixtures
  e2e/                        Playwright specs
  eval/guard/                 labelled kid messages + runner for the kids-protection guard
  eval/games/                 game harness: simulated kid + real app + a bot that plays the result
  slides/                     the Slidev deck for the video tutorial (own packages), served at /slides/
  scripts/                    postinstall workaround, Scratch bundle preparation, Azure setup (scripts/azure)
  Dockerfile                  its image; built from the repo root
apps/office/                the teachers' office (office.ai-scratch.dev, Next.js): registration, codes, own keys, the admin's pool
packages/db/                Postgres schema, migrations and connection (Drizzle), shared by both apps
docs/                       architecture notes per topic, kids-protection report, platform plan
tsconfig.base.json          strict compiler options shared by both apps
```

## More

- [docs/](docs/README.md): how the app works inside, per topic: decisions, constraints and traps.
- [AGENTS.md](AGENTS.md): background, requirements and working rules (for coding agents and humans).
- The measurements behind the main choices (Scratch integration, script format, model, chat framework) come
  from the prototype's report in the separate `ki-scratch` repo.

## Licence

AGPL-3.0-only, like Scratch itself. See [LICENSE](LICENSE).
