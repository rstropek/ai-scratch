# Testing and debugging

How the tests are built and what they can't catch. Commands are in the [README](../README.md#commands).

## Layers

Prefer the lowest layer that can show the bug: unit > component > e2e.

- **Unit** (Vitest, Node): `src/shared`, `src/server`, client logic. Project tools run against a **headless
  scratch-vm** ([headless-vm.ts](../test/support/headless-vm.ts)): no renderer, audio or network, but scripts
  run. Tests check *behaviour* (the sprite moved, the variable counts) rather than comparing block JSON, so
  they survive harmless changes to the compiler.
- **Server tests** call the Hono app in process (`app.request()`), with a fake `fetch` injected through the app
  deps that answers with Anthropic SSE built by [anthropic-sse.ts](../test/support/anthropic-sse.ts). No
  network, no cost. `createApp` is free of side effects for this reason; keep it so.
- **Component** (Vitest, jsdom): the chat UI pieces.
- **e2e** (Playwright, Chromium): the **production build** served by the real server, with the real Scratch
  editor. `/api/chat` is mocked per test with streams the **AI SDK itself encodes**
  ([mock-chat.ts](../e2e/helpers/mock-chat.ts)), so the wire format can't drift from the SDK. The server gets
  dummy keys, so a test without a mock can never call (and pay for) the model. **Any page error fails the
  test** ([app.ts](../e2e/helpers/app.ts)).

## What the tests can't show

- **The real editor's rendering.** jsdom and the headless VM have no GUI. The thumbnail throttling and the
  editor silently dropping scripts were only visible in a browser ([scratch-editor.md](scratch-editor.md)).
  Verify UI fixes in the real app before claiming they work.
- **The model.** Nothing in `npm test` or e2e calls Claude. See [Game tests](#game-tests-the-real-model).
- **Jev.** `npm run eval:guard` calls the real guard model and rewrites
  [kids-protection.md](kids-protection.md); run it after changing guard questions or thresholds.
- **CI runs only** `npm run check` and the unit/component tests. Run `npm run e2e` locally before pushing UI
  changes.

## Game tests (the real model)

Can the assistant build a real game with a kid? The **game harness** ([eval/games](../eval/games/README.md))
answers that with the production build, the real model and the real editor in headless Chromium. After
every answer that changed the project, a bot plays the game and runs checks (Memory, Fangspiel, and the
CoderDojo classics Fang mich, Space Shooter and Minesweeper). Core checks test the basic idea; extras test
details of the classic version, since rule variations are fine. The test steps the VM frame by frame on a
virtual clock with seeded randomness, so even fast games are tested reliably and the same way every run.

- **When:** after changes to the prompt, the tool wording or tools, or the model or effort; and before the
  event. It costs real money (Haiku: about a cent per turn).
- **An agent testing by hand** (the usual way) uses the `game-test` skill
  ([SKILL.md](../.agents/skills/game-test/SKILL.md)), not Claude in Chrome. The agent plays the kid with
  `session.ts`; every command returns the answer, the tool calls and the check results as text.
  - One subagent per game, each on its own `--port`.
  - Test „Rückgängig“ when the assistant makes a mistake.
  - Try the game by hand with `try` (clicks, keys) when a check can't tell, and record it with `note`.
  - Finish with `report --judge`; `report.md` has the prompts, answers, screenshots and findings.
- **Comparing variants** (models, efforts, prompts from `--dump-prompt`): `npm run eval:games` with a
  simulated kid and `--reps`, then read the reports of the bad runs.
- **The checks are tests too.** After changing a check or adding a game, run `--references`: every working
  reference must pass, and every planted bug must fail its check. A ❌ with an odd detail may be the check's
  fault; confirm it with `play`/`project` first.
- **Traps:**
  - The harness serves `dist/`, so run `npm run build` after client changes.
  - Runs never log to Azure Blob (`LOG_BLOB_URL=''`), and run against local servers only.

## Traps

- Playwright reuses a server already listening on its port (3012) outside CI. If a stale one is running, the
  tests run against an old build.
- scratch-vm logs a lot in headless mode; the test VM mutes it. Look there if a VM error seems to vanish.

## Debugging a real session

- Find the session in the research log ([research-log.md](research-log.md)); each call record has the model
  input and the answer, including tool calls.
- **Replay its tool calls** in the dev app (`npm run dev` only: the import needs Vite, so not on the
  production build or Azure). In the browser console, run
  `const { createToolRunner } = await import('/src/client/scratch/tool-runner.ts')`, create a runner with the
  iframe's `window.ki` (`document.querySelector('iframe').contentWindow.ki`) and feed it the logged
  `tool_use` inputs in order. You then see exactly what the kid saw.
- `/api/stats` (any valid access code) shows live counters of the running instance.
