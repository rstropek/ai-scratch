# The Scratch editor

How we embed and drive Scratch without modifying it. Read before touching `src/editor`, the VM types,
the UI tools or the build of the Scratch bundle.

## Unmodified, from npm

- We use the **standalone build** of `@scratch/scratch-gui` (it bundles its own React 18) and the public
  scratch-vm API. No fork, no patches: an upgrade is a version bump, not a rebase. Alternatives (library
  build, fork, TurboWarp, browser extension) were evaluated and rejected in ki-scratch report §3.
- [mount-scratch.ts](../src/editor/mount-scratch.ts) is the only place that mounts Scratch; the internal hooks
  live in [ui-guide.ts](../src/editor/ui-guide.ts) (below). The iframe exposes `window.ki = { vm, store, uiGuide }`
  ([bridge.ts](../src/editor/bridge.ts)); the host polls for it.
- **Mount once, never unmount:** the editor crashes on unmount (Blockly focus manager). This is one reason
  for the iframe, and why the chat, not the editor, is what folds away.
- **Keys need focus in the iframe:** the GUI listens for game keys on the iframe's `document`, but the stage
  calls `preventDefault()` on mousedown, so a click on it never moves focus out of the chat input.
  [main.ts](../src/editor/main.ts) focuses the iframe window on any mousedown there
  ([e2e/keyboard.spec.ts](../e2e/keyboard.spec.ts)).
- **Web root:** the bundle loads its files from `/` (webpack publicPath), see
  [vite.config.ts](../vite.config.ts) and [prepare-scratch.ts](../scripts/prepare-scratch.ts). In production
  [app.ts](../src/server/app.ts) serves `dist/client` first, then `dist/scratch`, both at `/`: a host file
  whose path matches a Scratch file (`static/`, `libraries/`, `chunks/` …) silently shadows it. Host HTML is
  `no-cache`, Scratch files are cached for a day. The slide deck sits under `/slides/`, before both
  ([deployment.md](deployment.md#image)).
- **Library pictures** come from Scratch's CDN (`cdn.assets.scratch.mit.edu`); only the library index
  (`/libraries/*.json`) is ours. A school network that blocks that host breaks `add_library_*`, not the rest.
- scratch-vm ships no types; the subset we use is **typed by hand** in
  [vm-types.ts](../src/shared/scratch/vm-types.ts). Add members as you use them, and stay on the public API
  (plus `target.blocks`, which the GUI uses too). Reading `blocks._blocks` is accepted (the `add_scripts`
  checks do); never write private fields, change blocks through the VM.

## Driving the UI: access paths, best first

[ui-guide.ts](../src/editor/ui-guide.ts) runs inside the iframe (it draws its pointer into the editor
document; its styles live there, not in the host CSS). Prefer the higher path:

1. **Public VM API**, e.g. `vm.setEditingTarget()`: the GUI follows by itself.
2. **The GUI's redux actions** (stable action type strings), e.g. switching tabs.
3. **ScratchBlocks (Blockly)**: not exported, so it is found inside the webpack runtime by *capability*
   (a module with `getMainWorkspace` + `centerOnBlock`), never by module id. This is the one internal hook;
   [e2e/ui-guide.spec.ts](../e2e/ui-guide.spec.ts) guards it.

GUI elements have CSS-module classes like `green-flag_green-flag_1kiAo`: match the stable
`<file>_<class>_` prefix, never the hash. Menu items have no distinguishing class, so they go by label.

## Traps found the hard way

- **Editor and VM can disagree.** When the editor can't load a block it silently drops every later script of
  that sprite, or shows a script's top block without the rest (the error only reaches the console).
  `add_scripts` therefore compares every block of the workspace with the VM afterwards and warns the model
  ([project-tools.ts](../src/shared/tools/project-tools.ts)).
- **A custom block's prototype needs an argument reporter per parameter** in its inputs, or the editor shows
  the definition as a bare prototype (it looks like a call) and drops its body;
  [script-dsl.ts](../src/shared/scratch/script-dsl.ts) adds them.
- **Fields that reference a variable, list or broadcast need their variable type**, or the editor fails to
  load the sprite's workspace (see the trap above); [sb3-blocks.ts](../src/shared/scratch/sb3-blocks.ts) sets it.
- **New scripts land on top of each other** unless the editor tidies up; `add_scripts` runs Scratch's own
  "Blöcke aufräumen" afterwards and copies the new positions into the VM, so the .sb3 keeps the layout. Not
  through the editor's own events: Blockly fires them on the next animation frame, and when the model sends
  several `add_scripts` in one step the next one has already switched the sprite, so the VM dropped the moves
  and scripts piled up at the top. It needs the code tab open (a hidden workspace has no block sizes), so **every `add_scripts`
  switches the kid's view** to that sprite's Code tab. Keep that in mind for a "show, don't do" mode.
- **scratch-vm switches a target to every costume it adds.** For a sprite that changes its starting look
  and that of all its clones (a new „Bombe“ costume turned every Minesweeper cell into a bomb), so
  `draw_costume` and `add_library_costume` switch a sprite back; a new backdrop stays shown.
- **Sprite thumbnails:** the GUI throttles thumbnail renders and drops an update that follows another
  within about 500 ms, so a drawn sprite keeps the "?" placeholder. `draw_sprite` repeats the update later.
  Only the real browser showed this ([e2e/pictures.spec.ts](../e2e/pictures.spec.ts)).
- **The palette missed variables the VM created** (`add_scripts`, undo): the GUI reloads the workspace with
  Blockly's events off and re-renders the palette only when the toolbox XML changes, which the Variables
  category (filled at render time) doesn't. The kid saw a script use „Verlauf“, but no „Verlauf“ block to
  drag. The ui-guide's `keepPaletteVariablesCurrent` re-renders it after a workspace update when its
  variables differ ([e2e/palette-variables.spec.ts](../e2e/palette-variables.spec.ts)).
- **Our three Locker entries in the *Datei* menu** are cloned from Scratch's "Auf deinem Computer speichern"
  item each time the menu opens, found by that item's label in the current language (redux `locales`); a
  click closes the menu with an Escape keydown.
  A project the host hands to `vm.loadProject` must be a `Uint8Array`, not an `ArrayBuffer` (another
  window's `instanceof` fails). Details: [locker.md](locker.md).
- **Our own block extension** ("frage KI") is registered in-process, before any project loads; its traps
  (load order, `color3`, scratch.mit.edu can't open such projects) are in [ki-block.md](ki-block.md).
- **`requestAnimationFrame` never fires in background tabs:** every wait in the ui-guide races it against
  a timer, so a UI helper can never block the turn.

## Tests and Node

- Unit tests use the Node build of scratch-vm as a headless VM
  ([headless-vm.ts](../test/support/headless-vm.ts)); it needs the postinstall workaround
  [fix-vm-node.ts](../scripts/fix-vm-node.ts). It registers the "frage KI" extension like the editor, so
  projects with KI blocks load (otherwise scratch-vm tries to load an unknown extension in a Worker).
- Keep `@scratch/scratch-vm` and `@scratch/scratch-storage` (headless tests) on the same pinned version as
  `@scratch/scratch-gui` (the app).

## Upgrading Scratch

Not during the event season. Otherwise: bump all three `@scratch/*` packages together; re-extract the block catalog and diff it; run
unit, e2e (they cover the internal paths) and the game harness ([testing.md](testing.md#game-tests-the-real-model)). The catalog
([block-catalog.json](../src/shared/scratch/block-catalog.json)) was extracted from the live palette in the
ki-scratch prototype; that extractor is not in this repo.
