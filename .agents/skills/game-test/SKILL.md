---
name: game-test
description: Test whether the AI assistant of this app can build a real Scratch game with a kid (Memory, Fangspiel, Fang mich, Space Shooter, Minesweeper, or any game). You play the kid in a headless session of the real app; each command returns the AI's answer, its tool calls, automatic game checks and screenshot paths. Use it for end-to-end game tests, after prompt/tool/model changes, and to compare variants. Prefer it over driving the browser with Claude in Chrome.
---

# Game test

`eval/games/session.ts` keeps the real app open in headless Chromium: the production build, the real model,
and the real Scratch editor. You play the kid, one command per action. Every command answers in compact
text, so you don't need screenshots or clicks to know what happened. Details: `eval/games/README.md`.

## Setup (once per test)

Needs a filled `.env` (the Anthropic key and workspace id, and the Jev key: every kid message goes through
the kids-protection guard; access codes are not needed) and Playwright's Chromium (`npx playwright install
chromium`).

```bash
npm run build                                      # the harness serves dist/; serve warns when it's stale
node eval/games/session.ts serve --game memory     # run_in_background
```

The other commands wait for the session (about 10 s to start), so you can `send` right away. The first
reply names the session folder (`eval/games/sessions/<local time>-<game>/`).

- `--game memory|fangspiel|fang-mich|space-shooter|minesweeper|none`: which automatic checks run after
  every change; each game's brief is in `eval/games/games.ts` and `coderdojo.ts` (the last three are
  CoderDojo Linz exercises). With `none`, test any game idea with `try`, `play` and the screenshots.
- `--model`, `--effort`, `--prompt <file>` set the variant under test. Write the current prompt to a file
  with `npm run eval:games -- --dump-prompt my.txt`, then edit it.
- `--port 3040` (default). Parallel sessions, such as one subagent per game, need different ports:
  3040, 3050, … Pass the same `--port` to every command.
- `--headed` shows the browser, if a human wants to watch.

## Commands

| Command | What you get |
|---|---|
| `send "<kid message>"` | the AI's answer text, every tool call (✓/✗ with error), and if the project changed: the checks (✅/❌ with what the bot measured), what a kid would notice (German), and stage screenshot paths |
| `check [--turn n]` | the checks again, with fresh screenshots; `--turn n` checks the project as it was after turn n (saved after every change) |
| `play [seconds] [--turn n]` | green flag, no input: sprites, positions, variables, speech, broadcasts, a stage screenshot |
| `try <action>… [--turn n]` | green flag, then plays like a kid: `click:Karte#2` (the 2nd visible `Karte`, top left first), `click:0,-100` (stage position), `key:space`, `key:left:2` (hold 2 s), `wait:3`. After each action: what changed (costumes, positions, variables, speech, broadcasts) |
| `project` | every sprite with costumes and variables, and its scripts in the assistant's script format |
| `shot` | a screenshot of the whole app (chat + editor) as the kid sees it *before* clicking the green flag: no clones, start positions not set yet. To see the game running, use `play` or `check` |
| `undo` | clicks „Rückgängig“ under the last answer that changed the project |
| `compact` | „Zusammenfassen“, if the Gedächtnis is full (`send` also does this by itself) |
| `note "<text>"` | records what you checked by hand (with `try`, `play`, a screenshot); it goes into the report's findings and to the judge |
| `report [--judge]` | `report.md` in the session folder: the conversation, the checks per turn, screenshots, findings; `--judge` adds a Claude review of the teaching mode (Opus, about 7 ct) |
| `stop` | ends the session (the app server and the browser) |

## Playing the kid

- Write like a 10–14-year-old: short German, casual, no Scratch jargon. Start with the rough idea only.
  Answer the assistant's questions, and let it lead step by step (teaching mode).
- After an answer that changed the project, read the checks and „A kid trying it would notice“, then
  report problems the way a kid sees them („die Äpfel fallen nicht runter“). Don't say how to fix them.
- Look at a screenshot only when the text isn't enough (a layout or drawing question). Use `Read` on the
  PNG path.
- The kid can't drag blocks or delete sprites; ask the assistant. That is part of what's tested.
- If the assistant asks the kid to do something in the editor (make a variable, drag a block), answer as a
  kid who can't find it: there is no command for editor actions. Note it as a finding.
- If the assistant makes a mistake, test `undo`, then ask again. If it repeats the mistake, note it as a
  problem and move on. The assistant isn't told about an undo; it only knows if the kid says so (a real kid
  might not). After an undo, the project is the last `turn-NN.sb3` before the undone turn: use that number
  with `--turn`.
- Stop when the checks are all ✅ and the game matches the idea, or after about 25 turns.

## Finding and reporting

- Every `send` is one real model turn (Haiku: about a cent). `check`, `play` and `project` cost nothing.
- The checks find game parts by behaviour (what falls, what the arrow keys move, which variable counts),
  not by name. A ❌ with a surprising detail may be a check limitation. Confirm it with `play`, `project`,
  `check --turn n` or a screenshot before blaming the assistant. If a check is wrong, say so in your
  report (and fix it in `eval/games/games.ts` if asked).
- The assistant never sees the checks; it only knows what the kid tells it.
- "x/y (k not testable yet), extras a/b": x/y are the core checks (the basic idea of the game; all ✅ =
  green). Extras are details of the classic version (the fish comes back, flags in Minesweeper); a
  variation of the rules is fine. Checks that need a missing part (no cards, nothing falling) are skipped,
  not failed.
- While checks are skipped or fail and you can't tell why, try the game yourself with `try` before you let
  the kid say it works, and record what you saw with `note`. Otherwise the report and the judge only see
  the automatic checks.
- A failed tool call's error is cut to 400 characters; the full text is in `result.json`.
- At the end, run `report --judge` and give the user the report path, plus your own findings: what broke,
  in which turn, whether undo helped, prompt or tool weaknesses. Include the session folder; it also holds
  `final.sb3` and the research log (`logs/calls.jsonl`, one line per model call with the exact model input
  and the answer, including what each tool returned: [docs/research-log.md](../../../docs/research-log.md)).

## Comparing variants without playing yourself

`npm run eval:games -- --games memory,fangspiel --prompt default,my.txt --reps 3 --report` runs the
same with a simulated kid (Claude) and writes `summary.md`, one row per run. Use it to compare prompts or
models over several runs. Then read the reports of the bad runs yourself.

## Adding a game

Add a `Game` to `eval/games/games.ts` (a German brief and checks), plus a working version and one broken
version per check in `eval/games/reference.ts`. Then run `node eval/games/reference.ts` and
`npm run eval:games -- --references`: the working version must pass everything, and each broken one must
fail its check.
