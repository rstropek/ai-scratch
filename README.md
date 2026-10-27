# Digiferien KI-Scratch

The official Scratch 3 editor with a German AI helper ("KI-Helfer") beside it. Kids describe what they want,
and the helper asks questions, builds small parts of their game, points at things in the editor, adds sprites
and backdrops from the Scratch library, and draws new sprites.

It was built for **Digiferien**, a one-day AI workshop: about 200 kids aged 10–16 at 10 Austrian schools,
coding beginners who know a little Scratch. Each kid works through a video tutorial at their own pace, with
adults in the room.

## How it works

```
Browser                                         Server (Hono, Azure)            AI services
┌──────────────────┬───────────────────────┐    ┌─────────────────────┐        ┌───────────────────┐
│ Chat (React)     │ Scratch 3 editor      │───▶│ access code, limits │───────▶│ Claude Haiku 5.5  │
│ runs the AI's    │ (unmodified, iframe)  │◀───│ builds the AI input │        │ (Anthropic)       │
│ tools ──────────▶│ live project          │    │ counts tokens, cost │───────▶│ Jev (TypeSafe):   │
└──────────────────┴───────────────────────┘    └─────────────────────┘        │ kids protection   │
                                                                               └───────────────────┘
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
- Until the school's **access code** is entered (or comes with the link as `?code=`), only the chat is locked;
  Scratch works.

## The slide deck

The slides Rainer records into the video tutorial live in [slides/](slides/README.md): a standalone
[Slidev](https://sli.dev) app in a sticker-album look, with its own packages, sharing only the Scratch
colours with the app. The app serves the built deck at **`/slides/`** without an access code
(https://ai-scratch.azurewebsites.net/slides/, presenter view at `/slides/presenter/`).

## Keeping kids safe and costs bounded

- **Adults supervise** every session; the technical layers are deliberately lean.
- **Kids protection:** every kid message (and every text of the "frage KI" block) is screened by TypeSafe's Jev before it reaches Claude. Flagged
  messages get a fixed German answer, for example a kid in distress is sent to an adult. What was tested:
  [docs/kids-protection.md](docs/kids-protection.md).
- **Limits:** hearts per kid, the Gedächtnis limit, a cap on answer length and on AI steps per message.
- **Access codes**, one per school. **Budget:** 200 €/month.

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

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env   # then fill in the Anthropic and TypeSafe keys and the access codes
npm run dev            # http://localhost:5173/?code=<one of your access codes>
```

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (server only) |
| `ANTHROPIC_WORKSPACE_ID` | sent as `anthropic-workspace-id`; needed for identity-linked keys |
| `ACCESS_CODES` | comma-separated, one per school; not case-sensitive; codes starting with `admin_` have no heart limit (testing) |
| `JEV_API_KEY` | TypeSafe key for the kids-protection guard (server only) |
| `MODEL` | default `claude-haiku-5-5` |
| `EFFORT` | the chat's thinking effort, default `high` |
| `INSTRUCTIONS_FILE` | replaces the built-in system prompt + tool instructions (for prompt variants in `eval:games`; not for production) |
| `JEV_MODEL` | default `jev-1.13.0` (the guard thresholds are tuned against it) |
| `PORT`, `DIST_DIR` | default `3000`, `dist` |
| `LOG_DIR` | stores every AI call and guard check there (game harness, e2e, debugging); unset by default and in production: nothing is stored |
| `LOCKER_URL` | the CoderDojo Locker for saving games, default `https://locker.coderdojo.net` |

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite on http://localhost:5173 (hot reload) + API server on :3000 |
| `npm run build` | type check, Vite build, copy + precompress the Scratch bundle into `dist/` |
| `npm start` | production server: API + `dist/` on :3000 (the slide deck at `/slides/` once `npm run build --prefix slides` has run before `npm run build`) |
| `npm test` | unit and component tests (Vitest, headless scratch-vm, no network) |
| `npm run e2e` | Playwright against the production build, model mocked |
| `npm run eval:games` | a simulated kid builds a game (Memory, Fangspiel, Fang mich, Space Shooter, Minesweeper) with the real app and model, a bot plays and checks each version ([eval/games](eval/games/README.md)); costs real money |
| `npm run eval:guard` | runs the labelled kid messages against the real Jev guard, writes [docs/kids-protection.md](docs/kids-protection.md) |
| `npm run check` | Biome + TypeScript |
| `npm run lint:fix` | Biome with fixes |

## Deployment (Azure)

Every push to `main` is tested and deployed to the **staging** slot. **Production** changes only through the
manual *Swap to production* workflow; running it again rolls back. **No swaps during the event:** a swap
restarts production and interrupts kids mid-answer. The reasons behind the setup and the traps we hit:
[docs/deployment.md](docs/deployment.md).

| What | Where |
|---|---|
| Web app | `ai-scratch` in RG `2026-digitalferien`, on the existing P0v3 plan `ts-web-playground`: https://ai-scratch.azurewebsites.net, staging https://ai-scratch-staging.azurewebsites.net; `GET /healthz` shows the running commit, `/slides/` the slide deck |
| Secrets | Key Vault `kv-digiferien`, read by the app's managed identity |
| Research logs | storage account `stdigiferien`, container `logs`: one JSON blob per AI call and per guard check of the event, no longer written. No retention rule; Rainer deletes them by hand |
| Image | `acrars2025.azurecr.io/ai-scratch:<commit>` |
| Workflows | [deploy.yml](.github/workflows/deploy.yml) (push to `main` → staging), [swap.yml](.github/workflows/swap.yml) (manual → production); GitHub logs in with OIDC |

Operations (`az login` with Owner on the subscription; both scripts are safe to re-run):

- **Changed keys or access codes in `.env`:** run `scripts/azure/provision.sh`, then restart both slots
  (`az webapp restart -g 2026-digitalferien -n ai-scratch`, and again with `--slot staging`).
- **GitHub login** (once): `scripts/azure/github-identity.sh`.
- **Download the logs:** `az storage blob download-batch --auth-mode login --account-name stdigiferien -s logs -d <dir>`.

## Project layout

```
index.html, editor.html   host page, editor iframe page
src/shared/               runs in the browser and in Node: script format, block catalog, tools, prompt
src/editor/               inside the iframe: mounts Scratch, UI pointer, "frage KI" block, Locker menu entries, exposes window.ki
src/client/               React host: chat panel, access gate, tool runner, Locker dialog
src/server/               Hono: /api/chat, /api/ask, /api/locker, access code, guards, call log (opt-in), stats
test/support/             headless scratch-vm, fake Anthropic streams, fixtures
e2e/                      Playwright specs
eval/guard/               labelled kid messages + runner for the kids-protection guard
eval/games/               game harness: simulated kid + real app + a bot that plays the result
slides/                   the Slidev deck for the video tutorial (own packages), served at /slides/
docs/                     architecture notes per topic, kids-protection report, pre-event checklist
scripts/                  postinstall workaround, Scratch bundle preparation, Azure setup (scripts/azure)
```

## More

- [docs/](docs/README.md): how the app works inside, per topic: decisions, constraints and traps.
- [AGENTS.md](AGENTS.md): background, requirements and working rules (for coding agents and humans).
- The measurements behind the main choices (Scratch integration, script format, model, chat framework) come
  from the prototype's report in the separate `ki-scratch` repo.

## Licence

AGPL-3.0-only, like Scratch itself. See [LICENSE](LICENSE).
