# Docs

Architecture notes per topic: the decisions, constraints and traps that the code doesn't show. They are
maintained by agents, for agents; read [AGENTS.md](../AGENTS.md) first. As brief as possible: gotchas, patterns,
principles, never a prose version of the code.

| Doc | Read it before you touch… |
|---|---|
| [architecture.md](architecture.md) | anything: how a turn flows, who owns which state, identity, error conventions |
| [scratch-editor.md](scratch-editor.md) | `src/editor`, VM types, UI tools, the Scratch bundle or a Scratch upgrade |
| [tools-and-scripts.md](tools-and-scripts.md) | a tool, its wording, the script format or the system prompt |
| [conversation.md](conversation.md) | the model input, prompt caching, "Zusammenfassen" or the Gedächtnis gauge |
| [limits-and-safety.md](limits-and-safety.md) | access codes, hearts, the kids-protection guard or the output limits |
| [research-log.md](research-log.md) | the opt-in call log, `/api/stats`, cost, or the stored event logs in Azure |
| [deployment.md](deployment.md) | the Dockerfile, the workflows, `scripts/azure`, any Azure setting, or how `/slides/` is served |
| [ki-block.md](ki-block.md) | the "frage KI" block in kids' own programs, `/api/ask` or its guard |
| [locker.md](locker.md) | saving and loading games in the CoderDojo Locker: the Datei menu entries, the dialog, `/api/locker` |
| [database.md](database.md) | `packages/db`, the schema, migrations, Postgres roles or the connection |
| [testing.md](testing.md) | tests, or when debugging a real session from the logs |

More files, not architecture notes:

- [kids-protection.md](kids-protection.md) is **generated** by `npm run eval:guard`; never edit it by hand.
- [platform-plan.md](platform-plan.md): the plan from event app to classroom offering (office, codes, budgets,
  key pool), each point decided, proposed or open.
- [to-check.md](to-check.md) is Rainer's checklist of open checks before the event.
- [night-test-2026-10-24.md](night-test-2026-10-24.md): the game-harness rounds before the event, what each
  found and what changed.

The slide deck for the video has its own notes: [slides/README.md](../apps/app/slides/README.md) (how it is built) and
[slides/DESIGN.md](../apps/app/slides/DESIGN.md) (its design system); how the app serves it is in
[deployment.md](deployment.md#image).

Keep these notes current: when a change alters a decision or a trap described here, update the doc in the
same change. Keep them short, and don't retell what a source file shows.
