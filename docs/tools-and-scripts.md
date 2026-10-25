# Tools and the script format

How the assistant reads and changes the project. Read before changing a tool, its wording, the script
format or the system prompt.

## Families and where they run

- Three families: **project** (read, add, remove and clear scripts, green flag, `test_run`), **ui** ("show, don't do": select a
  sprite, switch tabs, point at blocks and GUI elements) and **asset** (library sprites/backdrops/costumes,
  SVG drawings). Index: [tools/index.ts](../src/shared/tools/index.ts).
- Not a tool: the "frage KI" block ([ki-block.md](ki-block.md)) is a block kids use in their own programs.
  The model builds it like any block (`ki_ask`, added to the catalog by hand), and the prompt has a short
  section on chatbots.
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

- **Changing a script: remove it, add the new version** (`remove_scripts` by position in the snapshot's
  script list, then `add_scripts`). Until 2026-10-25 the model cleared all of a sprite's scripts and added
  them all again: one huge `add_scripts` per change, which in the game harness caused most broken JSON and
  `max_tokens` cuts, left sprites empty when it failed, and wiped scripts the kid had built by hand. There
  is still no edit tool for single blocks. The safety net is the kid's undo button per AI answer
  ([architecture.md](architecture.md)). In the next harness round (10 games) the model used
  `remove_scripts` 61 times and `clear_scripts` never, and broken `add_scripts` inputs that reached it
  fell from 14 to 4. Rainer decided on 2026-10-25 to keep it; `clear_scripts` stays for a full rebuild.
- **`test_run` lets the assistant see a bug instead of guessing** (Rainer's decision, 2026-10-25). It plays
  the project on the live VM in real time (green flag, then the kid's keys and clicks) and returns a timeline
  of what changed, sampled every 0.5 s, plus speech, broadcasts and „stoppe alles“. The kid watches it run.
  Teaching mode: the prompt allows it only when the kid says something doesn't work, not to check every
  change. It changes no scripts, so it can't be undone and needn't be; the game is stopped at the end.
  Clicks go through the renderer at a point where the sprite is drawn on top (the headless VM has none, so
  only e2e tests clicks).
- **The snapshot replaces the first `get_project`.** Each kid message carries the project as it was when sent,
  with a note that `get_project` isn't needed; the system prompt says the same (read the `<projekt>` block,
  `get_project` only to see the state after its own changes). Keep the two texts in line.
- **Tool wording and shapes were measured** in the prototype eval. Change them deliberately, and check a
  change with the game harness ([testing.md](testing.md#game-tests-the-real-model)); the prototype's eval
  was not ported.
- **Deterministic checks beat prompt text.** In a replayed session ("Fang mich") Haiku ignored the prompt's
  Scratch tips while building, but it fixed the pitfalls as soon as an `add_scripts` result carried a
  warning. So `add_scripts` checks the result (scripts missing in the editor, two sprites testing the same
  touch, a sprite that hides itself and is never shown at the start, a sprite that polls for clicks with
  "mouse down" + "touching mouse-pointer" instead of the click hat) and returns a `warning` that tells the
  model what to fix and to explain it in one sentence. For a new recurring mistake, add such a check rather
  than more prompt.
- **Variables are for all sprites unless named in `local_variables`.** Missing variables are created on the
  Stage (scratch-vm's `fixUpVariableReferences` in `shareBlocksToTarget`). Per-clone values (which picture a
  Memory card shows) need the sprite's own variable, so `add_scripts` creates the names in `local_variables` on
  the sprite first, and the VM then maps the scripts' references to them by name. Before that, the model asked
  the kid to create them in the editor.
- **Library first, drawing second:** the prompt sends the model to `search_library` (English keywords) before
  it draws SVG; drawings are checked cheaply (viewBox, size) and the editor's SVG loader sanitizes the rest.
- **The kid picks library items by picture** (Rainer's decision, 2026-10-25, instead of a question tool):
  a kid can't tell "Shark" from "Shark 2" by name. The chat shows what `search_library` found as pictures
  from the Scratch CDN, always, not only in the tool view, each item once per answer
  ([LibraryPictures.tsx](../src/client/chat/LibraryPictures.tsx)). They are not clickable; the kid answers in
  text. Searches the model makes only for itself show too; Rainer chose to drop only duplicates (round 7). The tool result keeps names only (pictures would cost the model tokens); the client looks the
  pictures up in the same library files. The prompt says: if several fit, add none yet and ask which one.

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

The Scratch tips and „Wenn etwas nicht geht“ in the prompt are technical, not pedagogy: they come from
game-harness runs. Without the second, Haiku answered bug reports with „die Skripte sehen richtig aus“,
blamed the kid's keyboard or screen and kept guessing for 10–20 turns. Its first rule says to take the
kid's observation seriously and check it with `test_run`, not to believe it blindly: real kids misreport too.
