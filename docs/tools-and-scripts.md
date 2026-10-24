# Tools and the script format

How the assistant reads and changes the project. Read before changing a tool, its wording, the script
format or the system prompt.

## Families and where they run

- Three families: **project** (read, add and clear scripts, green flag), **ui** ("show, don't do": select a
  sprite, switch tabs, point at blocks and GUI elements) and **asset** (library sprites/backdrops/costumes,
  SVG drawings). Index: [tools/index.ts](../src/shared/tools/index.ts).
- Definitions and prompt text live in `src/shared/tools`; the server sends them to the model. The tools have
  no `execute` on the server: executors are `ToolHandlers` that run in the browser on the live VM, strictly
  one at a time ([tool-runner.ts](../src/client/scratch/tool-runner.ts)).
- System prompt + all tool instructions form one static block, so it is cached across all kids
  ([conversation.md](conversation.md)). Anything per-kid or per-turn must not go into it. `INSTRUCTIONS_FILE`
  replaces the whole block, so the game harness ([eval/games](../eval/games/README.md)) can compare prompt
  variants. Check a prompt or tool wording change there before shipping it.

## Why the nested-JSON script format

- Measured in the prototype (ki-scratch report §10, ~900 runs): raw sb3 80% correct, our nested JSON 96%,
  with fewer tool errors and about 40% of the output tokens. Models know the opcodes but break sb3's
  bookkeeping (ids, next/parent links, shadows, primitive codes); the compiler
  ([script-dsl.ts](../src/shared/scratch/script-dsl.ts)) does all of that.
- **Real Scratch opcodes**, no invented names: models know them from training.
- **The same format for reading and writing** (`get_project` decompiles), so the model edits what it sees.
- **Validate before the VM is touched**, against the block catalog, with errors that say what to do
  ("did you mean `motion_movesteps`?"). Nothing is half-applied.
- The prototype's `code` format (JS calls) scored slightly higher but needs a safe interpreter; it was not
  ported. Neither were the raw sb3 representations and their validator.

## Decisions

- **No edit tool (yet).** To change a script, the model clears the sprite's scripts and adds them all again.
  Simple, but in a big sprite it can drop or alter scripts the kid didn't ask about; finer-grained edit tools
  were an open point in the prototype report. The safety net for now is the kid's undo button per AI answer
  ([architecture.md](architecture.md)). Rainer decides on further steps after testing.
- **The snapshot replaces the first `get_project`.** Each kid message carries the project as it was when sent,
  with a note that `get_project` isn't needed; the system prompt says the same (read the `<projekt>` block,
  `get_project` only to see the state after its own changes). Keep the two texts in line.
- **Tool wording and shapes were measured** in the prototype eval. Change them deliberately; the model eval is
  not ported yet (it needs rebuilding on the server's request builder), so a change can only be checked by
  hand or by replaying logs.
- **Deterministic checks beat prompt text.** In a replayed session ("Fang mich") Haiku ignored the prompt's
  Scratch tips while building, but it fixed the pitfalls as soon as an `add_scripts` result carried a
  warning. So `add_scripts` checks the result (scripts missing in the editor, two sprites testing the same
  touch, a sprite that hides itself and is never shown at the start) and returns a `warning` that tells the
  model what to fix and to explain it in one sentence. For a new recurring mistake, add such a check rather
  than more prompt.
- **Library first, drawing second:** the prompt sends the model to `search_library` (English keywords) before
  it draws SVG; drawings are checked cheaply (viewBox, size) and the editor's SVG loader sanitizes the rest.

## Robustness

- Be lenient with what models send (a nested argument as a JSON string, SVG in a code fence) and precise in
  what you return: tool errors are English, say what to fix, and go to the model, never to the kid.
- A tool must not fail after it has changed the project: the model would retry and do it twice.
- `add_scripts` switches the kid's view to the sprite's Code tab ([scratch-editor.md](scratch-editor.md)).

## Teaching mode

The kid designs the game; the assistant asks guiding questions and builds only small, clearly defined parts
(usually one script). This lives entirely in the system prompt ([prompt.ts](../src/shared/prompt.ts)),
which is Rainer's own experiment: discuss changes to its pedagogy with him. A stricter "AI supports" mode
(the assistant only guides and points, the kid builds) may follow; keep the prompt and the tool selection
easy to switch (for example, the ui tools without `add_scripts`).
