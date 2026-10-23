# Digiferien KI-Scratch

The official, unmodified Scratch 3 editor with a German AI chat assistant beside it, built for the
Digiferien workshop (kids 10–16). The assistant reads and changes the project, points at parts of the
editor, adds library sprites and backdrops, and draws new sprites as SVG.

Background, requirements and decisions: [AGENTS.md](AGENTS.md).

## Setup

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env   # then fill in the Anthropic key and the access codes
```

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (server only) |
| `ANTHROPIC_WORKSPACE_ID` | sent as `anthropic-workspace-id`; needed for identity-linked keys |
| `ACCESS_CODES` | comma-separated, one per school |
| `MODEL` | default `claude-haiku-5-5` |
| `PORT`, `LOG_DIR`, `DIST_DIR` | default `3000`, `logs`, `dist` |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite on http://localhost:5173/?code=test (hot reload) + API server on :3000 |
| `npm run build` | type check, Vite build, copy + precompress the Scratch bundle into `dist/` |
| `npm start` | production server: API + `dist/` on :3000 |
| `npm test` | unit and component tests (Vitest, headless scratch-vm, no network) |
| `npm run e2e` | Playwright against the production build, model mocked |
| `npm run check` | Biome + TypeScript |
| `npm run lint:fix` | Biome with fixes |

## Layout

```
index.html, editor.html   host page, editor iframe page
src/shared/               runs in the browser and in Node: script format, block catalog, tools
src/editor/               inside the iframe: mounts Scratch, UI pointer, exposes window.ki
src/client/               React host: chat panel, tool runner
src/server/               Hono: /api/chat, access code, research log, stats
test/support/             headless scratch-vm, fake Anthropic streams, fixtures
e2e/                      Playwright specs
scripts/                  postinstall workaround, Scratch bundle preparation
```

## Licence

AGPL-3.0-only, like Scratch itself. See [LICENSE](LICENSE).
