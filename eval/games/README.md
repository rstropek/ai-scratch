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

```bash
npm run build                                   # the harness serves dist/, like production
node eval/games/reference.ts                    # once: the hand-built reference games
npm run eval:games -- --references              # the checks against them (no model calls)
npm run eval:games -- --games memory --report   # one Memory run with a Markdown report
npm run eval:games -- --model claude-haiku-5-5,claude-sonnet-5-5 --reps 3   # compare models
npm run eval:games -- --dump-prompt my.txt      # write the built-in prompt, edit it, then:
npm run eval:games -- --prompt default,my.txt --reps 3
```

Options: `--games memory,fangspiel`, `--model`, `--effort` and `--prompt` (comma lists; every
combination is a variant with its own server), `--reps`, `--max-turns` (30), `--concurrency` (2 runs at
once), `--report` (Markdown + screenshots + the judge), `--skip-judge`, `--kid-model` and `--judge-model`
(both `claude-opus-5-5`), `--headed` (watch it), `--out`.

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
- **The checks** ([games.ts](games.ts)) find the game's parts by behaviour, not by name:
  - what falls by itself, what the arrow keys move;
  - which variable counts (by name pattern: Punkte, Leben…);
  - which sprites have a click script (the cards).
- **The judge** (with `--report`): Claude reads the transcript and rates the teaching mode (1–5) with findings.
- **Cost:** the app's calls come from the run's research log, the kid's and the judge's from the AI SDK
  ([pricing.ts](pricing.ts)). The kid and the judge on Opus usually cost more than the app on Haiku.

## Adding a game

Add a `Game` to [games.ts](games.ts): a German brief and a `check(player, sb3)` that plays it and returns
checks. Each check has a pass and a fail sentence for the kid. Build a working version and one broken
version per check in [reference.ts](reference.ts), and run `--references`: the working one must pass
everything, and each broken one must fail its check. A check that fails on the reference is wrong, not the
game.

## Traps

- The harness serves `dist/`: rebuild after client changes. The server runs from `src/` (no build needed).
- Without a renderer, `vm.updateSvg` drops the rotation center (the headless VM in reference.ts). In the
  browser it's kept; reference.ts sets it by hand.
- Scratch keeps sprites on the stage ("fencing"): a falling object never gets below about y = -165. So
  `wiederhole bis y < -170` never ends. That's a real kid bug; the Fangspiel checks catch it as „Leben
  gehen nicht weg“.
- Runs never log to Azure Blob (the server gets `LOG_BLOB_URL=''`), so eval sessions don't mix with the
  kids' research data.
