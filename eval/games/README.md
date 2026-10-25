# Game harness

Two ways to use it:

- **Interactive** (`session.ts`, for an agent): you play the kid and send one command per action; each
  answer comes back as compact text (answer, tool calls, checks, screenshot paths). The workflow is the
  `game-test` skill ([.agents/skills/game-test/SKILL.md](../../.agents/skills/game-test/SKILL.md)).
- **Batch** (`run.ts`, below): a simulated kid plays, for comparing variants over many runs.

Can the assistant build a real game with a kid? A simulated kid builds a game with the **real app** (the
production build, the real model, the real Scratch editor in headless Chromium). After every answer that
changed the project, a **bot plays the game** and checks it. Use it to compare system prompts, models and
efforts.

The games: Memory and Fangspiel ([games.ts](games.ts)), and three CoderDojo Linz classics, Fang mich, Space
Shooter and Minesweeper ([coderdojo.ts](coderdojo.ts); the exercises are on linz.coderdojo.net). Each game
has **core checks** (its basic idea; all passing = green) and **extras** (details of the classic version,
reported but not required), because there are many ways to build the same game. The briefs simplify a rule
where that makes it testable (Minesweeper is won by opening all safe cells, flags are an extra).
`minesweeper-mini` is the tutorial's simpler version (5 × 5, 4 bombs, no flags, no cascade): the same
checks without those two extras, so its reference is the full game.

```bash
npm run build                                   # the harness serves dist/, like production
node eval/games/reference.ts                    # once: the reference games (downloads the CoderDojo originals)
npm run eval:games -- --references              # the checks against them (no model calls; --games filters)
npm run eval:games -- --games memory --report   # one Memory run with a Markdown report
npm run eval:games -- --model claude-haiku-5-5,claude-sonnet-5-5 --reps 3   # compare models
npm run eval:games -- --dump-prompt my.txt      # write the built-in prompt, edit it, then:
npm run eval:games -- --prompt default,my.txt --reps 3
```

Options: `--games memory,fangspiel`, `--model`, `--effort` and `--prompt` (comma lists; every
combination is a variant with its own server), `--reps`, `--max-turns` (30), `--concurrency` (2 runs at
once), `--report` (Markdown + screenshots + the judge), `--skip-judge`, `--kid-model` and `--judge-model`
(`claude-sonnet-5-5` and `claude-opus-5-5`; the Opus kid was ~75 % of a run's cost), `--headed` (watch it), `--out`.

Output: `eval/games/runs/<time>/` (git-ignored; sessions go to `eval/games/sessions/`). The folder holds `summary.md` (one row per run), the
research log of every variant (`logs-N/`), and one folder per run. Each run folder has `result.json`,
`final.sb3` (open it in Scratch), and with `--report` also `report.md` plus screenshots.

## How it works

- **The kid** ([kid.ts](kid.ts)): Claude plays an 11-year-old with the game's brief ([games.ts](games.ts)). It
  reveals the idea bit by bit, answers the assistant's questions, and reports what it noticed when trying
  the game. That report comes from the checks' German `kid` sentences plus a stage screenshot. It can't
  drag blocks, so it asks the assistant to do it. It writes `FERTIG` when everything works.
- **The chat** ([chat.ts](chat.ts)): Playwright types into the real chat and waits until the Stopp button is
  gone. It reads the answer from the page and the tool calls from the app's `/api/chat` request bodies.
  The names of the library pictures the chat shows go to the kid as text (it can't see them).
  When the Gedächtnis is full, it clicks „Zusammenfassen“ like a kid would. The access code is
  `admin_eval`, so there are no hearts.
- **The bot** ([player.ts](player.ts)): plays the saved project in a second page of the app, in the real
  editor with the real renderer, so `wird berührt?` and clicks hit the drawn pixels. **The test controls
  time:**
  - The VM's 30 fps interval is stopped and the bot steps it frame by frame.
  - `Date.now` (the VM's only clock) advances one frame per step, so `warte 1 Sekunde` lasts 30 frames
    however long the bot thinks.
  - `Math.random` is seeded per green flag, so a run plays the same way every time.
  - 30 s of Fangspiel take about 0.3 s, and a whole check run about 1.5 s.
- **The checks** ([games.ts](games.ts), [coderdojo.ts](coderdojo.ts), helpers in [checks.ts](checks.ts)) find
  the game's parts by behaviour, not by name:
  - what falls or swims by itself, what the arrow keys move, what flies up after the space key;
  - which variable counts (by name pattern: Punkte, Leben, Treffer…);
  - which sprites react to clicks (a „Wenn diese Figur angeklickt wird“ script, or polling „Maus gedrückt?“
    with „wird Mauszeiger berührt?“).

  Bot policies ([player.ts](player.ts)): hold keys, catch or avoid what falls, shoot at it, steer one sprite
  towards another. Minesweeper learns the board by playing it cell by cell (the same seed gives the same
  board), then compares every number with the bombs around it. It reads numbers and bombs from the
  costume names („1“, „bomb“…), because the bot can't read the drawing.
- **The judge** (with `--report`): Claude reads the transcript and rates the teaching mode (1–5) with findings.
- **Cost:** the app's calls come from the run's research log, the kid's and the judge's from the AI SDK
  ([pricing.ts](pricing.ts)). The kid and the judge usually cost more than the app on Haiku.

## Adding a game

Add a `Game` (a German brief and a `check(player, sb3)` that plays it and returns checks) and register it in
`GAMES` in [games.ts](games.ts). Each check has a pass and a fail sentence for the kid; mark the ones that
aren't the basic idea as extras. Build a working version and one broken version per check in
[reference.ts](reference.ts): by hand with the assistant's tools, or from a finished `.sb3` with one value
changed in `project.json` (the CoderDojo games). Run `--references`: the working one must pass everything,
and each broken one must fail its check. A check that fails on the reference is wrong, not the game.

## Traps

- The harness serves `dist/`: rebuild after client changes. The server runs from `src/` (no build needed).
- Without a renderer, `vm.updateSvg` drops the rotation center (the headless VM in reference.ts). In the
  browser it's kept; reference.ts sets it by hand.
- Scratch keeps sprites on the stage ("fencing"): a falling object never gets below about y = -165. So
  `wiederhole bis y < -170` never ends. That's a real kid bug; the Fangspiel checks catch it as „Leben
  gehen nicht weg“.
- Blocks that wait on the browser („spiele Klang ganz“) need its event loop and real time: while a script
  waits on one, the bot runs frames at real speed, and Chromium starts with autoplay allowed (otherwise the
  sound never ends and the game never gets to „stoppe alles“).
- A broken copy that renames a message must change its id too: the VM finds a broadcast by id first.
- The original CoderDojo Minesweeper picks bomb positions from 0 to 99, but list items start at 1. A bomb at 0
  is lost, and that game can never be won. The reference picks from 1 to 100.
- The simulated kid only knows the checks' sentences and a still picture. A skipped check tells it nothing,
  and it used to invent bugs there („ich sehe keinen Laser“, while the shoot check waited for meteors);
  the assistant then spent ten turns on them. So a check runs as soon as the parts it needs exist, and the
  kid is told that a part nobody mentions is untested, not broken. A misleading sentence costs a whole run,
  so the checks accept what kids' games really do: a Minesweeper cell that hides or turns fully ghost
  when clicked is opened, its number may be in a speech bubble, and a board with unopened cells isn't
  judged; a flag may be a flag sprite put on top of the cell, and to take it away the bot clicks a
  visible part of it (the cell's centre was see-through, so its click set a second flag); a hunter that pauses after a catch isn't stuck; a message may be a shown variable monitor
  („Gewonnen!“), and the points variable is the one shown on the stage, not an unused leftover.
- Runs never log to Azure Blob (the server gets `LOG_BLOB_URL=''`), so eval sessions don't mix with the
  kids' research data.
