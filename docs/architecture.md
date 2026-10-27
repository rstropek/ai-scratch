# Architecture

The big picture and the decisions behind it. Read this first, then the topic doc for the area you touch.

## One turn, end to end

1. The kid sends a message. The client takes a project snapshot (`get_project`) and freezes it into the
   message's metadata ([ChatPanel.tsx](../src/client/chat/ChatPanel.tsx)).
2. `POST /api/chat` checks, in this order, the access code, Gedächtnis, hearts and the Jev guard (so a
   message refused for full memory costs no heart, a flagged one does). Then it rebuilds the model input and
   makes **one** model call, streamed back as an AI SDK UI message stream ([chat.ts](../src/server/chat.ts)).
3. Tool calls in the answer run in the browser on the live VM, strictly one at a time, because they change
   the VM ([tool-runner.ts](../src/client/scratch/tool-runner.ts)). `useChat` posts again with the results
   (`sendAutomaticallyWhen`).
4. Repeat until an answer has no tool call. Real turns take 2–10 requests.

**One request = one model call** is forced by browser-side tools: every tool step has to pass through the
browser, so the server never runs an agent loop and stays stateless between requests. This is why the
AI SDK was chosen over CopilotKit and Mastra (ki-scratch report §8): it lets the server build every request
itself and round-trips signed thinking blocks through the browser intact.

The "frage KI" block in a kid's own program takes a shorter path: one `POST /api/ask` per question, with the
same code, hearts and guard, and a plain JSON answer ([ki-block.md](ki-block.md)).

## Who owns what

- **Browser:** the conversation (all messages, with tool calls and signed thinking) and the project (the VM in
  the iframe). Nothing is persisted: closing the tab loses both, hence the `beforeunload` warning
  ([App.tsx](../src/client/App.tsx)). Kids save projects via Scratch's *Datei* menu, to a file or to their
  CoderDojo Locker ([locker.md](locker.md)).
- **Undo per AI answer** (Rainer's decision, against the model breaking a big sprite when it rewrites all its
  scripts): each kid message saves a copy of the whole project in browser memory; "Rückgängig" under an answer
  that changed the project restores it at once, without asking. That also discards everything after it, the
  kid's own edits included, so later answers count as undone too, and the model input says so
  ([undo.ts](../src/client/chat/undo.ts)). Scratch's own Ctrl+Z can't do this: an AI change empties
  Blockly's undo stack. The copies don't survive a reload, "Neu anfangen" or "Zusammenfassen".
  The trap: `vm.toJSON()` holds only asset ids, and drawn or painted costumes exist only in memory, so the
  backups keep the asset objects and serve them back to storage on restore
  ([project-backup.ts](../src/shared/scratch/project-backup.ts)).
- **Server:** only in-memory hearts and `/api/stats` counters, per instance. Everything else arrives with
  each request.
- **Trust:** the client sends the whole history, so a kid with dev tools could forge it. Accepted: hobby-grade
  threat in a supervised room. The server re-checks only what protects kids or money: the guard, hearts,
  Gedächtnis, the step limit and the text cap ([limits-and-safety.md](limits-and-safety.md)).

## Identity

- **Access code:** one per school, sent as `X-Access-Code` on every `/api` call. It grouped the research log
  by school; it is not security.
- **Session:** `crypto.randomUUID()` per page load, sent as `X-Session-Id` (no cookie). A reload starts a
  new session: fresh hearts, empty chat. Hearts are keyed by it.

## Why an iframe

The editor is the unmodified Scratch standalone bundle in a same-origin iframe (`editor.html`). The iframe
isolates Scratch's global CSS from Tailwind and its bundled React 18 from our React 19, and lets the editor
mount exactly once. Same origin means the host still reaches the VM directly via `iframe.contentWindow.ki`
([bridge.ts](../src/editor/bridge.ts)). Details: [scratch-editor.md](scratch-editor.md).

## Where code runs

`src/shared` (both), `src/editor` (iframe), `src/client` (React host), `src/server` (Hono). Tool
*definitions* live in `src/shared` because the server sends them to the model; tool *executors* run in the
browser. The server's TypeScript runs in Node without a build step, so only erasable syntax.

## Error conventions

- **To kids:** the server answers errors as JSON `{error}` in short German; the client shows that text as is
  and maps network failures to its own German messages ([errors.ts](../src/client/chat/errors.ts)). Refusals
  that should read like a chat answer (guard, step limit) are streamed as a fixed assistant message instead.
- **To the model:** tool errors are English and say what to fix; the model reads them and retries. That
  includes inputs the model got wrong before any tool ran ([tool-input.ts](../src/server/tool-input.ts)):
  one or two brackets too many or too few are repaired (Haiku's typical mistake in long `add_scripts`
  calls; the call log keeps the original), other broken JSON gets the spot where it broke instead of
  the whole input again, and a tool call cut short by `max_tokens` becomes a tool error too (see
  limits-and-safety.md).
- **Never fail a chat for a side concern:** logging, the editor tidy-up after `add_scripts` and Jev outages
  all degrade silently (console) instead of breaking the turn.
