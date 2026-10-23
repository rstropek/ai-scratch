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
- **The model.** Nothing in `npm test` or e2e calls Claude. The prototype's model eval isn't ported yet;
  prompt and tool wording changes are checked by hand or by replaying logs.
- **Jev.** `npm run eval:guard` calls the real guard model and rewrites
  [kids-protection.md](kids-protection.md); run it after changing guard questions or thresholds.
- **CI runs only** `npm run check` and the unit/component tests. Run `npm run e2e` locally before pushing UI
  changes.

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
